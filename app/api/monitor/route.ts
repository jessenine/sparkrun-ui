import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMonitorMetrics, collectMetrics } from "@/lib/metrics-collector";

// Transform monitor metrics into the format expected by the dashboard
// where hosts is a record keyed by IP address
function transformMonitorMetrics(metrics: any[]): any {
  const hosts: Record<string, any> = {};
  
  for (const m of metrics) {
    const hostIp = m.host || "unknown";
    if (!hosts[hostIp]) {
      hosts[hostIp] = {
        hostname: m.cluster || "",
        uptime_sec: "0",
        cpu_usage_pct: String(m.cpu || 0),
        cpu_temp_c: "0",
        cpu_load_1m: "0",
        mem_total_mb: "0",
        mem_used_mb: String(Math.round(m.memory || 0)),
        mem_used_pct: String(Math.round((m.memory || 0) / 100)),
        gpu_name: m.gpu ? "NVIDIA" : "",
        gpu_util_pct: m.gpu ? String(Math.round((m.gpu.used / (m.gpu.total || 1)) * 100)) : "0",
        gpu_mem_used_mb: m.gpu ? String(m.gpu.used) : "0",
        gpu_mem_total_mb: m.gpu ? String(m.gpu.total) : "0",
        gpu_temp_c: "0",
        gpu_power_w: "0",
        gpu_power_limit_w: "0",
        sparkrun_jobs: "0",
        sparkrun_job_names: "",
      };
    }
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
    // Trigger metrics collection on first access
    await collectMetrics();
    
    const cachedMetrics = getMonitorMetrics();
    
    if (!cachedMetrics || cachedMetrics.length === 0) {
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
