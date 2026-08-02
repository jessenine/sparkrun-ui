import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamSparkrunNdjson } from "@/lib/sparkrun";

const MonitorSchema = z.object({
  timestamp: z.number(),
  hosts: z.record(z.string(), z.object({
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
  }).catchall(z.string().optional())),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const intervalSec = body?.intervalSec ?? 2;
    
    const args = ["cluster", "monitor", "--json", "--interval", String(intervalSec)];
    
    // Stream output from sparkrun
    const results: unknown[] = [];
    for await (const obj of streamSparkrunNdjson<unknown>(args)) {
      try {
        const validated = MonitorSchema.parse(obj);
        results.push(validated);
        // Yield a batch of results
        if (results.length >= 5) {
          // In production, you might want to batch these differently
          // For now, we just collect them
        }
      } catch (err) {
        console.error("Validation error:", err);
        continue;
      }
    }
    
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[api/monitor/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch monitor data" },
      { status: 500 }
    );
  }
}
