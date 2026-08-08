import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { ClusterStatusSchema, type ClusterStatus } from "@/lib/schemas";
import { runSparkrunJson } from "@/lib/sparkrun";

const JobSchema = z.object({
  cluster_id: z.string(),
  recipe: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  status: z.string().optional(),
});
export type Job = z.infer<typeof JobSchema>;

const JobsListSchema = z.object({
  jobs: z.array(JobSchema),
});

/** Map a ClusterStatus to a flat list of jobs (groups + solo_entries). */
export function mapStatusToJobs(status: ClusterStatus): Job[] {
  return [
    ...Object.entries(status.groups).map(([clusterId, group]: [string, unknown]) => {
      const g = group as {
        cluster_id?: string;
        meta?: { recipe?: string; port?: number };
        hosts?: string[];
        containers?: { status?: string }[];
      };
      return {
        cluster_id: clusterId,
        recipe: g.meta?.recipe,
        host: g.hosts?.[0],
        port: g.meta?.port,
        status: g.containers?.[0]?.status,
      };
    }),
    ...status.solo_entries.map((entry) => ({
      cluster_id: entry.cluster_id,
      recipe: entry.meta?.recipe,
      host: entry.host,
      port: entry.meta?.port,
      status: entry.status,
    })),
  ].filter((job) => job.cluster_id);
}

async function fetchStatus(): Promise<ClusterStatus> {
  const raw = await runSparkrunJson<unknown>(["cluster", "status", "--json"]);
  return ClusterStatusSchema.parse(raw);
}

async function fetchStatusWithFallback(): Promise<ClusterStatus> {
  try {
    return await fetchStatus();
  } catch (err) {
    console.warn("[status.get] sparkrun unavailable, returning empty status:", err);
    return {
      host_count: 0,
      groups: {},
      solo_entries: [],
      idle_hosts: [],
      pending_ops: [],
      errors: {},
      total_containers: 0,
    };
  }
}

export const get = os.output(ClusterStatusSchema).handler(fetchStatusWithFallback);

export const stream = os
  .input(z.object({ intervalMs: z.number().int().min(500).max(30_000).default(3000) }).optional())
  .output(eventIterator(ClusterStatusSchema))
  .handler(async function* ({ input, signal }) {
    const interval = input?.intervalMs ?? 3000;
    while (!signal?.aborted) {
      try {
        yield await fetchStatusWithFallback();
      } catch (err) {
        console.error("[status.stream]", err);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  });

export const jobs = os.output(JobsListSchema).handler(async () => {
  const status = await fetchStatusWithFallback();
  return { jobs: mapStatusToJobs(status) };
});
