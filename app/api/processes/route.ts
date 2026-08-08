import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMonitorMetrics, collectMetrics } from "@/lib/metrics-collector";

// Transform process info from monitor metrics into the format expected by DashboardLive
// Dashboard expects: { processes: [{ host, entries }] }
type ProcessContainer = { name?: string };
type ProcessWorkload = { recipe?: string; containers?: ProcessContainer[] };
type ProcessHost = { host?: string; workloads?: ProcessWorkload[] };
type ProcessesLatest = { hosts?: ProcessHost[] };

function transformProcessesForDashboard(metrics: unknown[]): Record<string, unknown> {
  // Take the most recent metrics snapshot
  const latest = (metrics[metrics.length - 1] as ProcessesLatest | undefined) ?? { hosts: [] };

  // Build array of { host, entries } objects for dashboard
  const processes: Array<{ host: string; entries: Array<Record<string, unknown>> }> = [];

  for (const h of latest.hosts ?? []) {
    const hostIp = h.host || "unknown";
    const entries: Array<Record<string, unknown>> = [];

    // Extract workloads as process info
    for (const w of h.workloads ?? []) {
      for (const c of w.containers ?? []) {
        entries.push({
          user: w.recipe || "unknown",
          pid: 0, // No PID available from sparkrun - use 0 as placeholder
          cpu: 0, // No CPU % available from sparkrun - use 0 as placeholder
          mem: 0, // No MEM % available from sparkrun - use 0 as placeholder
          command: c.name || "unknown",
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
        message: "No process data available yet. Wait a moment and try again.",
      });
    }

    return NextResponse.json(transformProcessesForDashboard(cachedMetrics));
  } catch (err) {
    console.error("[api/processes/error]", err);
    return NextResponse.json({ error: "Failed to fetch process data" }, { status: 500 });
  }
}
