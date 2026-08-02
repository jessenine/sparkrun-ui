import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMonitorMetrics } from "@/lib/metrics-collector";

// Transform process info from monitor metrics into the format expected by ProcessList component
function transformProcessesFromMonitor(metrics: any[]): any {
  // Take the most recent metrics snapshot
  const latest = metrics[metrics.length - 1] || { hosts: [] };
  
  const hostProcesses: Record<string, any[]> = {};
  
  for (const h of latest.hosts || []) {
    const hostIp = h.host || "unknown";
    if (!hostProcesses[hostIp]) {
      hostProcesses[hostIp] = [];
    }
    
    // Extract workloads as process info
    for (const w of h.workloads || []) {
      for (const c of w.containers || []) {
        hostProcesses[hostIp].push({
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
  }
  
  const hosts: Record<string, any> = {};
  for (const [host, entries] of Object.entries(hostProcesses)) {
    hosts[host] = {
      processes: entries,
    };
  }
  
  return {
    hosts: hosts,
    source: "cached",
    stale: false,
    lastUpdate: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const cachedMetrics = getMonitorMetrics();
    console.log("[api/processes] Got metrics:", cachedMetrics ? `count=${cachedMetrics.length}` : "null");
    
    if (!cachedMetrics || cachedMetrics.length === 0) {
      return NextResponse.json({
        hosts: {},
        source: "cached",
        stale: true,
        message: "No process data available yet. Wait a moment and try again."
      });
    }
    
    return NextResponse.json(transformProcessesFromMonitor(cachedMetrics));
  } catch (err) {
    console.error("[api/processes/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch process data" },
      { status: 500 }
    );
  }
}
