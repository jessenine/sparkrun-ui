"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Rocket, List } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus, Job } from "@/lib/schemas";
import type { RunningRecipeDisplay } from "@/lib/runningRecipes";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { WorkloadCard } from "./WorkloadCard";
import { AggregateStats } from "./AggregateStats";

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
  const [status, setStatus] = useState<ClusterStatus>(initial);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const iter = await rpc.status.stream({ intervalMs: 3000 }, { signal: ac.signal });
        for await (const next of iter) {
          if (cancelled) break;
          setStatus(next);
          setConnected(true);
        }
      } catch (err) {
        if (!cancelled) setConnected(false);
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[status.stream]", err);
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const fetchedJobs = await rpc.status.jobs({ signal: ac.signal });
        if (!cancelled) {
          setJobs(fetchedJobs.jobs);
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[status.jobs]", err);
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

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

      <AggregateStats />

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

      {jobs.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Active Jobs
            <span className="ml-2 text-xs text-zinc-500">({jobs.length} total)</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {jobs.map((job) => (
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
