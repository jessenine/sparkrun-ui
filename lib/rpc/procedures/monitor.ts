import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { streamSparkrunNdjson } from "@/lib/sparkrun";

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
      const sample = sampleRaw !== null && sampleRaw !== undefined && typeof sampleRaw === "object"
        ? sampleRaw as Record<string, string | undefined>
        : {};
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
