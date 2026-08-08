import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMonitorMetrics, collectMetrics } from "@/lib/metrics-collector";

// Transform monitor metrics into the format expected by the dashboard
// where hosts is a record keyed by IP address
function transformMonitorMetrics(metrics: unknown[]): Record<string, unknown> {
  // Take the most recent metrics snapshot (last in the array)
  const latest = (metrics[metrics.length - 1] as Record<string, unknown> | undefined) ?? { hosts: {} };
  
  // The hosts is already a record keyed by IP address, just use it directly
  const hosts = latest.hosts ?? {};
  
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
