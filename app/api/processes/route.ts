import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProcesses } from "@/lib/metrics-collector";

// Transform process info into the format expected by ProcessList component
function transformProcesses(processes: any[]): any {
  const hostProcesses: Record<string, any[]> = {};
  
  for (const p of processes) {
    const hostIp = p.host || "unknown";
    if (!hostProcesses[hostIp]) {
      hostProcesses[hostIp] = [];
    }
    
    hostProcesses[hostIp].push({
      pid: p.id,
      user: p.name,
      cpu: String(p.cpu || 0),
      mem: String(p.memory || 0),
      command: p.name,
    });
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
    const cachedProcesses = getProcesses();
    
    if (!cachedProcesses || cachedProcesses.length === 0) {
      return NextResponse.json({
        hosts: {},
        source: "cached",
        stale: true,
        message: "No process data available yet. Wait a moment and try again."
      });
    }
    
    return NextResponse.json(transformProcesses(cachedProcesses));
  } catch (err) {
    console.error("[api/processes/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch process data" },
      { status: 500 }
    );
  }
}
