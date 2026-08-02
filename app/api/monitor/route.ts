import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMonitorMetrics, collectMetrics } from "@/lib/metrics-collector";

// Transform monitor metrics into the format expected by the dashboard
// where hosts is a record keyed by IP address
function transformMonitorMetrics(metrics: any[]): any {
  // Take the most recent metrics snapshot (last in the array)
  const latest = metrics[metrics.length - 1] || { hosts: [] };
  
  // Build hosts record from the array of hosts in the snapshot
  const hosts: Record<string, any> = {};
  
  for (const h of latest.hosts || []) {
    const hostIp = h.host || "unknown";
    const sample = h.sample || {};
    
    hosts[hostIp] = {
      hostname: sample.hostname || "",
      uptime_sec: sample.uptime_sec || "0",
      cpu_usage_pct: sample.cpu_usage_pct || "0",
      cpu_temp_c: sample.cpu_temp_c || "0",
      cpu_load_1m: sample.cpu_load_1m || "0",
      mem_total_mb: sample.mem_total_mb || "0",
      mem_used_mb: sample.mem_used_mb || "0",
      mem_used_pct: sample.mem_used_pct || "0",
      gpu_name: sample.gpu_name || "",
      gpu_util_pct: sample.gpu_util_pct || "0",
      gpu_mem_used_mb: sample.gpu_mem_used_mb || "0",
      gpu_mem_total_mb: sample.gpu_mem_total_mb || "0",
      gpu_temp_c: sample.gpu_temp_c || "0",
      gpu_power_w: sample.gpu_power_w || "0",
      gpu_power_limit_w: sample.gpu_power_limit_w || "0",
      sparkrun_jobs: sample.sparkrun_jobs || "0",
      sparkrun_job_names: sample.sparkrun_job_names || "",
    };
  }
  
  return {
    results: [
      {
        timestamp: Date.now(),
        hosts: hosts,
      },
    ],
    source: "cached",
    stale: false,
    lastUpdate: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log("[api/monitor] POST request received, calling collectMetrics...");
    
    // Trigger metrics collection on first access
    await collectMetrics();
    console.log("[api/monitor] collectMetrics complete, getting cached metrics...");
    
    const cachedMetrics = getMonitorMetrics();
    console.log("[api/monitor] Got metrics:", cachedMetrics ? `count=${cachedMetrics.length}` : "null");
    
    if (!cachedMetrics || cachedMetrics.length === 0) {
      console.log("[api/monitor] No metrics available");
      return NextResponse.json({
        results: [],
        source: "cached",
        stale: true,
        message: "No metrics available yet. Wait a moment and try again."
      });
    }
    
    return NextResponse.json(transformMonitorMetrics(cachedMetrics));
  } catch (err) {
    console.error("[api/monitor/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch monitor data" },
      { status: 500 }
    );
  }
}
