import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClusterStatus, ClusterStatusSchema } from "@/lib/metrics-collector";

const JobSchema = z.object({
  cluster_id: z.string(),
  recipe: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  status: z.string().optional(),
});

export type Job = z.infer<typeof JobSchema>;

export async function POST(request: NextRequest) {
  try {
    const cachedStatus = getClusterStatus();

    if (!cachedStatus) {
      return NextResponse.json({
        jobs: [],
        source: "cached",
        stale: true,
        message: "No cluster status available yet. Wait a moment and try again.",
      });
    }

    // Validate the cached status
    const validatedStatus = ClusterStatusSchema.parse(cachedStatus);

    // Map both groups (record) and solo_entries (array) to job format
    const jobs: Job[] = [
      ...Object.entries(validatedStatus.groups ?? {}).map(([clusterId, group]) => {
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
      ...(validatedStatus.solo_entries ?? []).map((entry) => ({
        cluster_id: entry.cluster_id,
        recipe: entry.meta?.recipe,
        host: entry.host,
        port: entry.meta?.port,
        status: entry.status,
      })),
    ].filter((job) => job.cluster_id);

    return NextResponse.json({
      jobs: jobs,
      source: "cached",
      stale: false,
      lastUpdate: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/jobs/error]", err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
