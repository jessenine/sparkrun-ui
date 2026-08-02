"use client";
import { useEffect, useState } from "react";
import { Cpu, MemoryStick, Server, Thermometer, Zap, HardDrive } from "lucide-react";

console.log("[AggregateStats] Component mounted");
import { Card, CardBody } from "@/app/components/ui/Card";
import type { DiskUsage } from "@/lib/schemas";

type HostMetrics = Record<string, string | undefined>;
type Tick = { timestamp: number; hosts: Record<string, HostMetrics> };

const HISTORY = 40;

type Aggregate = {
  hostCount: number;
  cpuAvg: number;
  gpuAvg: number;
  memUsedGb: number;
  memTotalGb: number;
  gpuMemUsedGb: number;
  gpuMemTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  powerW: number;
  cpuTempC: number;
  gpuTempC: number;
  jobsTotal: number;
};

function num(s: string | undefined): number {
  if (!s) return 0;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

function aggregate(tick: Tick | null, diskInfo: DiskUsage[]): Aggregate {
  if (!tick) {
    return {
      hostCount: 0,
      cpuAvg: 0,
      gpuAvg: 0,
      memUsedGb: 0,
      memTotalGb: 0,
      gpuMemUsedGb: 0,
      gpuMemTotalGb: 0,
      diskUsedGb: 0,
      diskTotalGb: 0,
      powerW: 0,
      cpuTempC: 0,
      gpuTempC: 0,
      jobsTotal: 0,
    };
  }
  const hosts = Object.values(tick.hosts);
  let cpuSum = 0;
  let gpuSum = 0;
  let memUsed = 0;
  let memTotal = 0;
  let gpuMemUsed = 0;
  let gpuMemTotal = 0;
  let power = 0;
  let cpuTemp = 0;
  let gpuTemp = 0;
  let jobs = 0;
  for (const m of hosts) {
    cpuSum += num(m.cpu_usage_pct);
    gpuSum += num(m.gpu_util_pct);
    memUsed += num(m.mem_used_mb);
    memTotal += num(m.mem_total_mb);
    gpuMemUsed += num(m.gpu_mem_used_mb);
    gpuMemTotal += num(m.gpu_mem_total_mb);
    power += num(m.gpu_power_w);
    cpuTemp += num(m.cpu_temp_c);
    gpuTemp += num(m.gpu_temp_c);
    jobs += num(m.sparkrun_jobs);
  }
  const n = hosts.length || 1;
  
  // Calculate total disk usage from the disk info
  let totalDiskUsed = 0;
  let totalDiskTotal = 0;
  for (const d of diskInfo) {
    totalDiskUsed += d.used_gb;
    totalDiskTotal += d.size_gb;
  }
  
  return {
    hostCount: hosts.length,
    cpuAvg: cpuSum / n,
    gpuAvg: gpuSum / n,
    memUsedGb: memUsed / 1024,
    memTotalGb: memTotal / 1024,
    gpuMemUsedGb: gpuMemUsed / 1024,
    gpuMemTotalGb: gpuMemTotal / 1024,
    diskUsedGb: totalDiskUsed,
    diskTotalGb: totalDiskTotal,
    powerW: power,
    cpuTempC: cpuTemp / n,
    gpuTempC: gpuTemp / n,
    jobsTotal: jobs,
  };
}

function push(arr: number[], value: number): number[] {
  const next = [...arr, value];
  if (next.length > HISTORY) next.shift();
  return next;
}

export function AggregateStats() {
  const [tick, setTick] = useState<Tick | null>(null);
  const [diskInfo, setDiskInfo] = useState<DiskUsage[]>([]);
  const [hist, setHist] = useState<{ cpu: number[]; gpu: number[] }>({ cpu: [], gpu: [] });
  const [connected, setConnected] = useState(false);

  // Fetch disk info once
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/disk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (response.ok) {
          const data = await response.json();
          setDiskInfo(data.results || []);
        }
      } catch (err) {
        console.error("[disk.list]", err);
      }
    })();
  }, []);

  // Poll monitor API for metrics
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    
    const pollMonitor = async () => {
      try {
        const response = await fetch("/api/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: ac.signal,
        });
        
        if (cancelled) return;
        
        if (!response.ok) {
          console.error("Monitor API error:", response.statusText);
          setConnected(false);
          return;
        }
        
        const data = await response.json();
        setConnected(true);
        
        // Use the latest result
        if (data.results && data.results.length > 0) {
          const latest = data.results[data.results.length - 1];
          console.log("[AggregateStats] Monitor data:", {
            resultsCount: data.results.length,
            latestHosts: latest.hosts ? Object.keys(latest.hosts).length : 0
          });
          setTick(latest);
          const agg = aggregate(latest as Tick, diskInfo);
          console.log("[AggregateStats] Aggregated:", agg);
          setHist((prev) => ({
            cpu: push(prev.cpu, agg.cpuAvg),
            gpu: push(prev.gpu, agg.gpuAvg),
          }));
        } else {
          console.warn("[AggregateStats] No results in monitor data");
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[AggregateStats] Error polling monitor:", err);
        }
      } finally {
        if (!cancelled) setConnected(false);
      }
    };
    
    // Poll every 2 seconds
    pollMonitor();
    const interval = setInterval(pollMonitor, 2000);
    
    return () => {
      cancelled = true;
      ac.abort();
      clearInterval(interval);
    };
  }, [diskInfo]);

  const agg = aggregate(tick, diskInfo);
  const memPct = agg.memTotalGb ? (agg.memUsedGb / agg.memTotalGb) * 100 : 0;
  const gpuMemPct = agg.gpuMemTotalGb ? (agg.gpuMemUsedGb / agg.gpuMemTotalGb) * 100 : 0;
  const diskPct = agg.diskTotalGb ? (agg.diskUsedGb / agg.diskTotalGb) * 100 : 0;

  return (
    <Card>
      <CardBody className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cluster overview
            </span>
            <span className="text-xs text-zinc-500">
              · {agg.hostCount || "—"} host{agg.hostCount === 1 ? "" : "s"} · {agg.jobsTotal} job
              {agg.jobsTotal === 1 ? "" : "s"}
            </span>
          </div>
          <span
            className={
              "inline-flex h-2 w-2 rounded-full " +
              (connected ? "animate-pulse bg-emerald-500" : "bg-zinc-300")
            }
            title={connected ? "live" : "reconnecting"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500">CPU</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {agg.cpuAvg.toFixed(1)}%
              </span>
              <span className="text-xs text-zinc-500">
                {agg.hostCount > 0 ? `avg across ${agg.hostCount} hosts` : ""}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500">GPU</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {agg.gpuAvg.toFixed(1)}%
              </span>
              <span className="text-xs text-zinc-500">
                {agg.hostCount > 0 ? `avg across ${agg.hostCount} hosts` : ""}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500">Memory</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {memPct.toFixed(1)}%
              </span>
              <span className="text-xs text-zinc-500">
                {agg.memUsedGb.toFixed(1)} / {agg.memTotalGb.toFixed(1)} GB
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500">Power</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {agg.powerW.toFixed(1)} W
              </span>
              <span className="text-xs text-zinc-500">
                across {agg.hostCount} hosts
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 h-16 flex items-end gap-1">
          <div className="flex-1">
            <p className="mb-1 text-xs text-zinc-500">CPU usage (last {HISTORY * 2}s)</p>
            <div className="flex h-8 w-full items-end gap-px rounded bg-zinc-100 dark:bg-zinc-800">
              {hist.cpu.slice(0, 40).map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-sky-500"
                  style={{ height: `${Math.min(v, 100)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-xs text-zinc-500">GPU usage (last {HISTORY * 2}s)</p>
            <div className="flex h-8 w-full items-end gap-px rounded bg-zinc-100 dark:bg-zinc-800">
              {hist.gpu.slice(0, 40).map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-purple-500"
                  style={{ height: `${Math.min(v, 100)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
