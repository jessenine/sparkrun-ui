import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { streamSparkrunNdjson } from "@/lib/sparkrun";
import type { ProcessEntry } from "./processes";

/**
 * Query a single host-local agent on port 8081 and return its own process list
 * plus the hostname/ip_address the agent reports for ITSELF.
 *
 * Each node runs this agent outside the Docker container and it has proper
 * ssh/sparkrun access (unlike sparkrun inside the container). The agent is the
 * authoritative per-node source: it returns the node's own real ip_address (so
 * a candidat of "127.0.0.1" resolves to the node's real LAN IP) + hostname, and
 * the top processes observed on that node. Returns null when the agent is
 * unreachable so callers can drop non-live hosts.
 */
async function fetchAgentProcesses(hostOrIp: string): Promise<{
  processes: ProcessEntry[];
  hostname?: string;
  ip_address?: string;
} | null> {
  try {
    const url = new URL(`http://${hostOrIp}:8081/processes`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        console.warn(
          "[monitor.processes] Host agent",
          hostOrIp,
          "returned status",
          response.status,
        );
        return null;
      }
      const data = (await response.json()) as {
        processes?: ProcessEntry[];
        hostname?: string;
        ip_address?: string;
      };
      return {
        processes: data.processes ?? [],
        hostname: data.hostname,
        ip_address: data.ip_address,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn("[monitor.processes] Host agent", hostOrIp, "unreachable:", error);
    return null;
  }
}

// Hostname/name validation to prevent argument injection into sparkrun
const namePattern = /^[a-zA-Z0-9._-]+$/;

const HostMetricsSchema = z
  .object({
    hostname: z.string().optional(),
    uptime_sec: z.string().optional(),
    cpu_usage_pct: z.string().optional(),
    cpu_temp_c: z.string().optional(),
    cpu_load_1m: z.string().optional(),
    mem_total_mb: z.string().optional(),
    mem_used_mb: z.string().optional(),
    mem_used_pct: z.string().optional(),
    gpu_name: z.string().optional(),
    gpu_util_pct: z.string().optional(),
    gpu_mem_used_mb: z.string().optional(),
    gpu_mem_total_mb: z.string().optional(),
    gpu_temp_c: z.string().optional(),
    gpu_power_w: z.string().optional(),
    gpu_power_limit_w: z.string().optional(),
    sparkrun_jobs: z.string().optional(),
    sparkrun_job_names: z.string().optional(),
    processes: z
      .union([
        z.array(
          z.object({
            user: z.string(),
            pid: z.number(),
            cpu: z.number(),
            mem: z.number(),
            command: z.string(),
          }),
        ), // Top 5 processes by CPU (already parsed)
        z.string(), // Raw JSON string (needs parsing)
      ])
      .optional(),
  })
  .loose();

const TickSchema = z.object({
  timestamp: z.number(),
  hosts: z.record(z.string(), HostMetricsSchema),
});

// Export for testing
export function normalizeMonitorOutput(raw: unknown): z.infer<typeof TickSchema> {
  const tick = raw as Record<string, unknown>;
  const ts = typeof tick.timestamp === "number" ? tick.timestamp : 0;
  const hostsInput = tick.hosts;

  const hosts: Record<string, z.infer<typeof HostMetricsSchema>> = {};

  // Skip hosts that are not running/returning metrics: those that errored
  // (non-null error) or that returned an empty/missing metrics sample.
  const isLiveSample = (s: unknown): s is Record<string, unknown> =>
    !!s && typeof s === "object" && !Array.isArray(s) && Object.keys(s).length > 0;

  // Handle both array format [{ host, sample, ... }] and flat record format { "host": { ... } }
  if (Array.isArray(hostsInput)) {
    // Array format: [{ host, sample, ... }, ...]
    for (const h of hostsInput) {
      if (!h || typeof h !== "object") continue;
      const entry = h as Record<string, unknown>;
      // Skip hosts that failed to be collected (not returning metrics)
      if (entry.error != null && entry.error !== "") continue;
      const sampleRaw = entry.sample;
      // Skip hosts that returned an empty/missing sample — no metrics to show
      if (!isLiveSample(sampleRaw)) continue;
      let sample = sampleRaw as Record<string, string | undefined | ProcessEntry[]>;
      // Parse processes array if present (either already an array or JSON string)
      if (sample.processes) {
        try {
          const parsed = Array.isArray(sample.processes)
            ? (sample.processes as ProcessEntry[])
            : (JSON.parse(sample.processes) as ProcessEntry[]);
          sample = { ...sample, processes: parsed };
        } catch {
          // Keep original if JSON parsing fails
          console.warn("[monitor] Failed to parse processes:", sample.processes);
        }
      }
      const hostKey = (entry.host as string) || "unknown";
      hosts[hostKey] = sample as z.infer<typeof HostMetricsSchema>;
    }
  } else if (hostsInput && typeof hostsInput === "object" && !Array.isArray(hostsInput)) {
    // Flat record format: { "host": { ...metrics... } }
    for (const [hostKey, hostData] of Object.entries(hostsInput)) {
      // Keep only hosts that are returning metrics (non-empty sample object)
      if (isLiveSample(hostData)) {
        hosts[hostKey] = hostData as z.infer<typeof HostMetricsSchema>;
      }
    }
  }

  const result = { timestamp: ts, hosts };
  // Validate with Zod schema to ensure correct structure
  const parsed = TickSchema.parse(result);
  return parsed;
}

/** Build args for sparkrun cluster monitor command */
function monitorArgs(
  input: { cluster?: string; hosts?: string[] } | undefined,
  intervalSec: number,
): string[] {
  const args = ["cluster", "monitor", "--json", "--interval", String(intervalSec)];
  if (input?.cluster) args.push("--cluster", input.cluster);
  else if (input?.hosts?.length) args.push("--hosts", input.hosts.join(","));
  return args;
}

export const stream = os
  .input(
    z
      .object({
        cluster: z.string().regex(namePattern).optional(),
        hosts: z.array(z.string().regex(namePattern)).optional(),
        intervalSec: z.number().int().min(1).max(30).default(2),
      })
      .optional(),
  )
  .output(eventIterator(TickSchema))
  .handler(async function* ({ input, signal }) {
    const args = monitorArgs(input, input?.intervalSec ?? 2);
    console.log("[monitor.stream] Running command:", args.join(" "));
    try {
      for await (const obj of streamSparkrunNdjson<unknown>(args, {
        signal,
      }) as AsyncIterable<unknown>) {
        if (signal?.aborted) break;
        console.log("[monitor.stream] Raw obj:", JSON.stringify(obj));
        const normalized = normalizeMonitorOutput(obj);
        console.log("[monitor.stream] Normalized:", JSON.stringify(normalized));
        yield normalized;
      }
    } catch (err) {
      console.warn("[monitor.stream] sparkrun unavailable, yielding empty tick:", err);
      yield { timestamp: Date.now(), hosts: {} };
    }
  });

export const processes = os
  .input(
    z
      .object({
        cluster: z.string().regex(namePattern).optional(),
        hosts: z.array(z.string().regex(namePattern)).optional(),
      })
      .optional(),
  )
  .output(
    z.object({
      timestamp: z.number(),
      hosts: z.array(
        z.object({
          host: z.string(),
          hostname: z.string().optional(),
          ip_address: z.string().optional(),
          processes: z.array(
            z.object({
              user: z.string(),
              pid: z.number(),
              cpu: z.number(),
              mem: z.number(),
              command: z.string(),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async function ({ input }) {
    // Candidate hosts to query. Each is a local-agent address on port 8081.
    // If none are given, default to the machine this server runs on.
    const candidates = input?.hosts && input.hosts.length > 0 ? input.hosts : ["127.0.0.1"];

    const rows = await Promise.all(
      candidates.map(async (host) => {
        const agent = await fetchAgentProcesses(host);
        if (!agent) return null;
        // Filter NaN before sorting to keep sorts stable and pass Zod.
        const valid = agent.processes.filter((p) => !isNaN(p.cpu) && !isNaN(p.mem));
        valid.sort((a, b) => b.cpu - a.cpu);
        return {
          host,
          hostname: agent.hostname,
          ip_address: agent.ip_address,
          processes: valid.slice(0, 10),
        };
      }),
    );

    // Keep only hosts with a live agent, in candidate order, dedup by the
    // canonical ip the agent reports (so e.g. 127.0.0.1 and 192.168.1.77 are
    // never shown as two cards for the same machine).
    const seen = new Set<string>();
    const hosts = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        const canonical = r.ip_address || r.host;
        if (seen.has(canonical)) return false;
        seen.add(canonical);
        return true;
      });

    return { timestamp: Date.now(), hosts };
  });
