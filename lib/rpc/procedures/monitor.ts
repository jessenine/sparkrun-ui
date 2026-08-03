import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { streamSparkrunNdjson, runSparkrunJson, runSparkrunText } from "@/lib/sparkrun";
import { normalizeProcessList } from "./processes";
import { getMonitorMetrics, collectMetrics } from "@/lib/metrics-collector";
import { queryAgentProcesses } from "@/lib/rpc/agent/client";

// Process entry interface (duplicate of ProcessEntry in processes.ts to avoid circular deps)
interface ProcessEntry {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  command: string;
}

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
    processes: z.union([
      z.array(z.object({
        user: z.string(),
        pid: z.number(),
        cpu: z.number(),
        mem: z.number(),
        command: z.string(),
      })),  // Top 5 processes by CPU (already parsed)
      z.string(),  // Raw JSON string (needs parsing)
    ]).optional(),
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
      let sample = sampleRaw !== null && sampleRaw !== undefined && typeof sampleRaw === "object"
        ? sampleRaw as Record<string, string | undefined | ProcessEntry[]>
        : {} as Record<string, string | undefined | ProcessEntry[]>;
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

export const stream = os
  .input(
    z
      .object({
        cluster: z.string().optional(),
        hosts: z.array(z.string()).optional(),
        intervalSec: z.number().int().min(1).max(30).default(2),
      })
      .optional(),
    )
    .output(eventIterator(TickSchema))
    .handler(async function* ({ input, signal }) {
      const args = ["cluster", "monitor", "--json", "--interval", String(input?.intervalSec ?? 2)];
      if (input?.cluster) args.push("--cluster", input.cluster);
      else if (input?.hosts?.length) args.push("--hosts", input.hosts.join(","));
      console.log("[monitor.stream] Running command:", args.join(" "));
      for await (const obj of streamSparkrunNdjson<unknown>(args, { signal }) as AsyncIterable<unknown>) {
        if (signal?.aborted) break;
        console.log("[monitor.stream] Raw obj:", JSON.stringify(obj));
        const normalized = normalizeMonitorOutput(obj);
        console.log("[monitor.stream] Normalized:", JSON.stringify(normalized));
        yield normalized;
      }
    });

export const processes = os
  .input(
    z.object({
      cluster: z.string().optional(),
      hosts: z.array(z.string()).optional(),
    }).optional(),
  )
  .output(z.object({
    timestamp: z.number(),
    processes: z.array(z.object({
      user: z.string(),
      pid: z.number(),
      cpu: z.number(),
      mem: z.number(),
      command: z.string(),
    })),
  }))
  .handler(async function ({ input, signal }) {
    // Fetch process data from the monitoring stream
    // We get a single snapshot by subscribing briefly to the stream
    const targetArgs = [];
    if (input?.cluster) targetArgs.push("--cluster", input.cluster);
    else if (input?.hosts?.length) targetArgs.push("--hosts", input.hosts.join(","));

    // Get list of target hosts first
    const statusResult = await runSparkrunJson<{ hosts: string[] }>(
      ["cluster", "status", "--json", ...targetArgs],
      { signal },
    );
    const targetHosts = input?.hosts || statusResult.hosts || [];

    // Collect process data from each host's local agent
    // This replaces the vulnerable SSH-based collection
    const allProcesses: ProcessEntry[] = [];
    
    for (const host of targetHosts) {
      try {
        // Each cluster member runs a local agent on port 8081
        // Query the agent for process data
        const agentProcesses = await queryAgentProcesses(host, 10);
        allProcesses.push(...agentProcesses);
        console.log(`[monitor.processes] Retrieved ${agentProcesses.length} processes from ${host}`);
      } catch (error: any) {
        console.error(`[monitor.processes] Error querying agent on ${host}:`, error?.message || error);
        // Continue with other hosts even if one fails
      }
    }

    // Sort by CPU descending and return top 5
    allProcesses.sort((a, b) => b.cpu - a.cpu);

    return {
      timestamp: Date.now(),
      processes: allProcesses.slice(0, 5),
    };
  });
