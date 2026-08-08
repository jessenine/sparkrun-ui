import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { streamSparkrunNdjson } from "@/lib/sparkrun";
import type { ProcessEntry } from "./processes";

/**
 * Attempt to fetch process data from a host-local agent on port 8081.
 * The agent runs on each host outside the Docker container and has proper
 * SSH/sparkrun access, unlike sparkrun inside the container.
 */
async function fetchFromHostAgent(): Promise<ProcessEntry[] | null> {
  try {
    const url = new URL("http://127.0.0.1:8081/processes");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        console.warn("[monitor.processes] Host agent returned status", response.status);
        return null;
      }
      const data = (await response.json()) as { processes?: ProcessEntry[] };
      return data.processes ?? null;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn("[monitor.processes] Host agent unreachable:", error);
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

  // Handle both array format [{ host, sample, ... }] and flat record format { "host": { ... } }
  if (Array.isArray(hostsInput)) {
    // Array format: [{ host, sample, ... }, ...]
    for (const h of hostsInput) {
      if (!h || typeof h !== "object") continue;
      const entry = h as Record<string, unknown>;
      // Handle null/undefined samples gracefully - use an empty object instead of skipping
      const sampleRaw = entry.sample;
      let sample =
        sampleRaw !== null && sampleRaw !== undefined && typeof sampleRaw === "object"
          ? (sampleRaw as Record<string, string | undefined | ProcessEntry[]>)
          : ({} as Record<string, string | undefined | ProcessEntry[]>);
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
      if (hostData && typeof hostData === "object") {
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
  )
  .handler(async function ({ input, signal }) {
    // Fetch a single snapshot from the monitor stream.
    // sparkrun cluster monitor --json streams process data per host.
    // We take one tick and extract the process lists.
    // Don't pass --hosts filter: sparkrun inside the Docker container can't SSH
    // to explicit IPs (host key verification fails). Without --hosts, sparkrun uses
    // its default cluster SSH config which works. Additionally, all hosts' process
    // data is aggregated regardless of filter.
    const args = ["cluster", "monitor", "--json", "--interval", "1"];
    console.log("[monitor.processes] Running command:", args.join(" "));

    const allProcesses: ProcessEntry[] = [];
    let gotData = false;

    for await (const obj of streamSparkrunNdjson<unknown>(args, {
      signal,
    }) as AsyncIterable<unknown>) {
      if (signal?.aborted) break;
      if (gotData) break; // Only one tick with data needed

      const tick = normalizeMonitorOutput(obj);

      // Extract process data from each host's metrics
      let hostHasProcesses = false;
      for (const [, hostData] of Object.entries(tick.hosts)) {
        if (!hostData.processes) continue;

        let processes: ProcessEntry[] = [];
        if (Array.isArray(hostData.processes)) {
          processes = hostData.processes as ProcessEntry[];
        } else if (typeof hostData.processes === "string") {
          try {
            processes = JSON.parse(hostData.processes) as ProcessEntry[];
          } catch {
            continue;
          }
        }

        if (processes.length > 0) {
          hostHasProcesses = true;
          allProcesses.push(...processes);
        }
      }

      if (hostHasProcesses) {
        gotData = true;
      }
      // If this tick had no process data (e.g. SSH errors for all hosts),
      // continue to the next tick or fall through to host agent fallback
      break;
    }

    if (!gotData) {
      console.warn("[monitor.processes] No process data from sparkrun monitor stream");
      // Fallback: try the host-local agent (runs outside container with proper SSH/sparkrun access)
      const agentProcesses = await fetchFromHostAgent();
      if (agentProcesses && agentProcesses.length > 0) {
        console.log(
          "[monitor.processes] Falling back to host agent —",
          agentProcesses.length,
          "processes",
        );
        const valid = agentProcesses.filter((p) => !isNaN(p.cpu) && !isNaN(p.mem));
        valid.sort((a, b) => b.cpu - a.cpu);
        return {
          timestamp: Date.now(),
          processes: valid.slice(0, 10),
        };
      }
      console.warn("[monitor.processes] Host agent also unavailable — returning empty");
    }

    // Filter out entries where cpu or mem is NaN before sorting
    // to prevent unstable sort and Zod runtime rejection
    const valid = allProcesses.filter((p) => !isNaN(p.cpu) && !isNaN(p.mem));

    // Sort by CPU descending and return top 10
    valid.sort((a, b) => b.cpu - a.cpu);

    return {
      timestamp: Date.now(),
      processes: valid.slice(0, 10),
    };
  });
