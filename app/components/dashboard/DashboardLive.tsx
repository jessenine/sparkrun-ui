"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, Rocket, List, Info } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus, Job } from "@/lib/schemas";
import type { RunningRecipeDisplay } from "@/lib/runningRecipes";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { WorkloadCard } from "./WorkloadCard";
import { AggregateStats } from "./AggregateStats";
import { SparklineGraph } from "./SparklineGraph";
import { ProcessList } from "./ProcessList";
import type { ProcessEntry } from "./ProcessList";

// Debug log to verify component is loaded
console.log('[DashboardLive] Component module loaded');

function formatHostError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message: unknown }).message);
  }
  return JSON.stringify(value);
}

export function DashboardLive({
  initial,
  recipeByCluster,
}: {
  initial: ClusterStatus;
  recipeByCluster: Map<string, RunningRecipeDisplay>;
}) {
  // Jobs are derived from initial status (server-side rendered)
  const computedJobs: Job[] = [
    ...Object.entries(initial.groups).map(([clusterId, group]: [string, unknown]) => {
      const g = group as { cluster_id?: string; meta?: { recipe?: string; port?: number }; hosts?: string[]; containers?: { status?: string }[] };
      return {
        cluster_id: clusterId,
        recipe: g.meta?.recipe,
        host: g.hosts?.[0],
        port: g.meta?.port,
        status: g.containers?.[0]?.status,
      };
    }),
    ...initial.solo_entries.map((entry) => ({
      cluster_id: entry.cluster_id,
      recipe: entry.meta?.recipe,
      host: entry.host,
      port: entry.meta?.port,
      status: entry.status,
    })),
  ].filter((job) => job.cluster_id);
  
  const [status, setStatus] = useState<ClusterStatus>(initial);
  // Note: status is passed from server-side render, no need for stream
  // The initial status contains host info for process data collection
  const [connected, setConnected] = useState(true);
  
  // Metrics history per host: hostIp -> metricName -> [values]
  const [metricHistory, setMetricHistory] = useState<Record<string, Record<string, number[]>>>(
    {}
  );
  
  // Process history per host: hostIp -> [ProcessEntry]
  const [processHistory, setProcessHistory] = useState<Record<string, ProcessEntry[]>>({});
  
  // Track if process data has been loaded at least once
  const [monitorLoaded, setMonitorLoaded] = useState(false);
  
  // Track process loading state per host: hostIp -> boolean
  const [processLoading, setProcessLoading] = useState<Record<string, boolean>>({});
  
  // Direct agent queries for process data
  const processQueryRef = useRef<NodeJS.Timeout | null>(null);
  
  const MAX_HISTORY = 15; // 15 data points at 2-3s intervals = ~30-45 seconds
  
  // Subscribe to monitor stream for per-host metrics
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    let firstDataReceived = false;
    
    (async () => {
      try {
        const iter = await rpc.monitor.stream({ intervalSec: 2 }, { signal: ac.signal });
        for await (const next of iter) {
          if (cancelled) break;
          
          // Mark that we've received at least one data point
          if (!firstDataReceived) {
            firstDataReceived = true;
            setMonitorLoaded(true);
          }
          
          // Update metric history per host
          setMetricHistory((prev) => {
            const nextHistory = { ...prev };
            
            // next is a Tick with hosts Record<string, HostMetrics>
            const hosts = next && typeof next === 'object' && 'hosts' in next
              ? (next as { hosts: Record<string, Record<string, string | undefined>> }).hosts
              : undefined;
            
            if (!hosts || Object.keys(hosts).length === 0) {
              console.warn('[monitor.stream] No hosts data in tick:', next);
              return nextHistory;
            }
            
            for (const [hostIp, metrics] of Object.entries(hosts)) {
              if (!nextHistory[hostIp]) {
                nextHistory[hostIp] = {};
              }
              
              // Update each metric history
              const hostHistory = nextHistory[hostIp];
              for (const [metricName, value] of Object.entries(metrics)) {
                if (value === undefined) continue;
                const numVal = parseFloat(value);
                if (!Number.isFinite(numVal)) continue;
                
                const history = hostHistory[metricName] || [];
                const newHistory = [...history, numVal];
                
                // Keep only last N values
                if (newHistory.length > MAX_HISTORY) {
                  newHistory.shift();
                }
                
                hostHistory[metricName] = newHistory;
              }
            }
            
            return nextHistory;
          });
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[monitor.stream]", err);
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  // Process data: Fetch from server-side RPC handler (reads sparkrun cluster monitor --json)
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    
    console.log('[dashboard] Process query effect started');
    
    const queryProcessData = async () => {
      // Get hosts from status.groups — authoritative source
      const clusterEntries = status?.groups ? Object.entries(status.groups) : [];
      if (clusterEntries.length === 0) {
        console.log('[dashboard] No cluster entries yet');
        return;
      }
      const firstCluster = clusterEntries[0][1] as { meta?: { hosts?: string[] } } | undefined;
      const hosts = firstCluster?.meta?.hosts ?? [];
      if (hosts.length === 0) {
        console.log('[dashboard] No hosts available yet');
        return;
      }
      
      console.log(`[dashboard] Fetching processes for ${hosts.length} hosts: ${hosts.join(', ')}`);
      
      const newProcessHistory: Record<string, ProcessEntry[]> = {};
      const newMetricHistory: Record<string, Record<string, number[]>> = {};
      
      try {
        const result = await rpc.monitor.processes({ hosts });
        console.log(`[dashboard] RPC processes result:`, result);
        
        if (result && Array.isArray(result.processes)) {
          // Result is a flat list — assign to all hosts for now
          for (const host of hosts) {
            newProcessHistory[host] = result.processes as ProcessEntry[];
          }
          
          // Populate basic metric history so sparklines render
          for (const host of hosts) {
            newMetricHistory[host] = {
              cpu_usage_pct: [0],
              mem_used_pct: [0],
              gpu_util_pct: [0],
              gpu_power_w: [0],
              cpu_temp_c: [0],
              gpu_temp_c: [0],
            };
          }
        }
      } catch (error) {
        console.warn('[dashboard] RPC processes failed:', error);
      }
      
      if (!cancelled) {
        setMetricHistory(prev => ({ ...prev, ...newMetricHistory }));
        setProcessHistory(newProcessHistory);
      }
    };
    
    // Initial query immediately
    queryProcessData();
    
    // Query every 10 seconds
    processQueryRef.current = setInterval(queryProcessData, 10000);
    
    return () => {
      cancelled = true;
      ac.abort();
      if (processQueryRef.current) {
        clearInterval(processQueryRef.current);
        processQueryRef.current = null;
      }
    };
  }, [status]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <Badge tone="sky">
            {status.host_count} host{status.host_count === 1 ? "" : "s"}
          </Badge>
          <Badge tone="green">{status.total_containers} running</Badge>
          <Badge tone={connected ? "neutral" : "amber"}>
            {connected ? "live" : "reconnecting…"}
          </Badge>
        </div>
      </div>

      {/* Debug: Show if mounted */}
      {/* <div style={{ display: 'none' }} data-mounted={mounted ? 'yes' : 'no'} /> */}
      
      <AggregateStats />

      {/* Individual host metrics with sparklines */}
      <div className="flex flex-col gap-3">
        {(Object.keys(metricHistory).length > 0 || Object.keys(processHistory).length > 0) ? (
          <div>
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Host metrics
              <span className="ml-2 text-xs text-zinc-500">
                ({Object.keys(metricHistory).length} hosts)
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Object.entries(metricHistory).map(([hostIp, history]) => (
                <Card key={hostIp}>
                  <CardBody className="p-4">
                    <div className="mb-3 flex items-baseline justify-between">
                      <div className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {hostIp}
                      </div>
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" title="online" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SparklineGraph
                        title="CPU"
                        data={history.cpu_usage_pct || []}
                        color="sky"
                        unit="%"
                      />
                      <SparklineGraph
                        title="GPU"
                        data={history.gpu_util_pct || []}
                        color="purple"
                        unit="%"
                      />
                      <SparklineGraph
                        title="Mem"
                        data={history.mem_used_pct || []}
                        color="green"
                        unit="%"
                      />
                      <SparklineGraph
                        title="Power"
                        data={history.gpu_power_w || []}
                        color="amber"
                        unit="W"
                      />
                      <SparklineGraph
                        title="Temp"
                        data={history.cpu_temp_c || []}
                        color="red"
                        unit="°C"
                      />
                      <SparklineGraph
                        title="GPU Temp"
                        data={history.gpu_temp_c || []}
                        color="red"
                        unit="°C"
                      />
                    </div>
                    {/* Process list - show top 5 processes */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <ProcessList
                        title="Top Processes"
                        processes={processHistory[hostIp] || []}
                        loading={processLoading[hostIp] || false}
                      />
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          !monitorLoaded && Object.keys(processHistory).length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-500 border-t-transparent" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Loading metrics...</p>
            </div>
          )
        )}
      </div>

      {/* Process list section - show even without metrics */}
      {Object.keys(processHistory).length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Top Processes
            <span className="ml-2 text-xs text-zinc-500">
              ({Object.keys(processHistory).length} hosts)
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(processHistory).map(([hostIp, processes]) => (
              <Card key={hostIp}>
                <CardBody className="p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {hostIp}
                    </div>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" title="online" />
                  </div>
                  <ProcessList
                    title=""
                    processes={processes}
                    loading={processLoading[hostIp] || false}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Show process list cards even when metrics are empty but process data exists */}
      {Object.keys(metricHistory).length === 0 && Object.keys(processHistory).length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Process Data Available
            <span className="ml-2 text-xs text-zinc-500">
              (metrics loading from agents)
            </span>
          </h2>
        </div>
      )}

      {Object.keys(status.errors).length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardBody className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              size={18}
            />
            <div className="flex flex-col gap-1 text-sm">
              <h3 className="font-medium text-amber-900 dark:text-amber-200">
                Cluster status reported errors
              </h3>
              <ul className="flex flex-col gap-1 text-amber-800 dark:text-amber-300">
                {Object.entries(status.errors).map(([host, err]) => (
                  <li key={host} className="font-mono text-xs">
                    <span className="font-semibold">{host}:</span> {formatHostError(err)}
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Workloads</h2>
        {status.solo_entries.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                <Rocket size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  No workloads running
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Launch a recipe to start an inference workload on your cluster.
                </p>
              </div>
              <Link href="/launch">
                <Button variant="primary">
                  <Rocket size={14} />
                  Launch a recipe
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {status.solo_entries.map((w) => (
              <WorkloadCard
                key={w.cluster_id}
                workload={w}
                recipe={recipeByCluster.get(w.cluster_id)}
              />
            ))}
          </div>
        )}
      </div>

      {computedJobs.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Active Jobs
            <span className="ml-2 text-xs text-zinc-500">({computedJobs.length} total)</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {computedJobs.map((job) => (
              <Card key={job.cluster_id}>
                <CardBody className="flex flex-col gap-3 text-sm">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-zinc-500 dark:text-zinc-400">Job ID</dt>
                    <dd className="font-mono text-zinc-700 dark:text-zinc-300">
                      {job.cluster_id}
                    </dd>
                    {job.recipe && (
                      <>
                        <dt className="text-zinc-500 dark:text-zinc-400">Recipe</dt>
                        <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                          {job.recipe}
                        </dd>
                      </>
                    )}
                    {job.host && (
                      <>
                        <dt className="text-zinc-500 dark:text-zinc-400">Host</dt>
                        <dd className="font-mono text-zinc-700 dark:text-zinc-300">
                          {job.host}
                        </dd>
                      </>
                    )}
                    {job.port && (
                      <>
                        <dt className="text-zinc-500 dark:text-zinc-400">Port</dt>
                        <dd className="font-mono text-zinc-700 dark:text-zinc-300">
                          {job.port}
                        </dd>
                      </>
                    )}
                    {job.status && (
                      <>
                        <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
                        <dd>
                          <Badge
                            tone={
                              job.status.toLowerCase().includes("running") ||
                              job.status.toLowerCase().includes("ready")
                                ? "green"
                                : job.status.toLowerCase().includes("error")
                                  ? "red"
                                  : "sky"
                            }
                          >
                            {job.status}
                          </Badge>
                        </dd>
                      </>
                    )}
                  </dl>
                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/logs/${job.cluster_id}`}
                      className="flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
                    >
                      <List size={14} />
                      View logs
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
