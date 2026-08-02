import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMonitorMetrics, collectMetrics } from "@/lib/metrics-collector";

// Transform process info from monitor metrics into the format expected by DashboardLive
// Dashboard expects: { processes: [{ host, entries }] }
function transformProcessesForDashboard(metrics: any[]): any {
  // Take the most recent metrics snapshot
  const latest = metrics[metrics.length - 1] || { hosts: [] };
  
  // Build array of { host, entries } objects for dashboard
  const processes: Array<{ host: string; entries: any[] }> = [];
  
  for (const h of latest.hosts || []) {
    const hostIp = h.host || "unknown";
    const entries: any[] = [];
    
    // Extract workloads as process info
    for (const w of h.workloads || []) {
      for (const c of w.containers || []) {
        entries.push({
          pid: c.name,
          user: w.recipe || "unknown",
          cpu: "N/A",
          mem: "N/A",
          command: c.name,
          status: c.status,
          role: c.role,
          image: c.image,
        });
      }
    }
    
    processes.push({ host: hostIp, entries });
  }
  
  return {
    processes: processes,
    source: "cached",
    stale: false,
    lastUpdate: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Trigger collection to ensure fresh data
    await collectMetrics();
    
    const cachedMetrics = getMonitorMetrics();
    
    if (!cachedMetrics || cachedMetrics.length === 0) {
      return NextResponse.json({
        processes: [],
        source: "cached",
        stale: true,
        message: "No process data available yet. Wait a moment and try again."
      });
    }
    
    return NextResponse.json(transformProcessesForDashboard(cachedMetrics));
  } catch (err) {
    console.error("[api/processes/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch process data" },
      { status: 500 }
    );
  }
}
