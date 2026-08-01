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

// sparkrun cluster monitor returns data in a different shape:
// { timestamp, hosts: [{ host, sample: { ... }, ... }] }
// but the UI expects:
// { timestamp, hosts: { "host": { ...sample keys... } } }
function normalizeMonitorOutput(raw: unknown): z.infer<typeof TickSchema> {
  const tick = raw as Record<string, unknown>;
  const ts = typeof tick.timestamp === "number" ? tick.timestamp : 0;
  const hostsList = Array.isArray(tick.hosts) ? tick.hosts : [];

  const hosts: Record<string, z.infer<typeof HostMetricsSchema>> = {};
  for (const h of hostsList) {
    if (!h || typeof h !== "object") continue;
    const entry = h as Record<string, unknown>;
    // Handle null samples gracefully - use an empty object instead of skipping
    const sampleRaw = entry.sample;
    const sample = sampleRaw !== null && sampleRaw !== undefined && typeof sampleRaw === "object"
      ? sampleRaw as Record<string, string | undefined>
      : {};
    const hostKey = (entry.host as string) || "unknown";
    // Flatten sample to top level so the UI can read m.gpu_util_pct etc.
    hosts[hostKey] = sample as z.infer<typeof HostMetricsSchema>;
  }

  console.log("[normalizeMonitorOutput] raw.hosts type:", Array.isArray(tick.hosts) ? "array" : typeof tick.hosts);
  console.log("[normalizeMonitorOutput] raw.hosts count:", hostsList.length);
  console.log("[normalizeMonitorOutput] normalized hosts:", Object.keys(hosts).length ? hosts : "(empty)");
  for (const [host, data] of Object.entries(hosts)) {
    console.log(`[normalizeMonitorOutput] host ${host}:`, Object.keys(data).length ? data : "(empty)");
  }

  return { timestamp: ts, hosts };
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
