import { resolveRunningRecipeDisplay, type RunningRecipeDisplay } from "@/lib/runningRecipes";
import { DashboardLive } from "@/app/components/dashboard/DashboardLive";
import { runSparkrunJson } from "@/lib/sparkrun";
import { ClusterStatusSchema } from "@/lib/schemas";
import { serverClient as _serverClient } from "@/lib/rpc/server";

// Suppress type error - ORPC framework type inference issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const serverClient = _serverClient as any;

async function getStatus() {
  try {
    const data = await runSparkrunJson<Record<string, unknown>>(["cluster", "status", "--json"]);
    return ClusterStatusSchema.parse(data);
  } catch (err) {
    console.error("[getStatus]", err);
    return { groups: {}, solo_entries: [], idle_hosts: [], pending_ops: [], errors: {}, total_containers: 0, host_count: 0 };
  }
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [initial, recipes] = await Promise.all([
    getStatus(),
    serverClient.recipes.list({ all: true }),
  ]);
  const recipeByCluster = new Map<string, RunningRecipeDisplay>();
  for (const w of initial.solo_entries) {
    const display = await resolveRunningRecipeDisplay(w, recipes);
    if (display) recipeByCluster.set(w.cluster_id, display);
  }
  return <DashboardLive initial={initial} recipeByCluster={recipeByCluster} />;
}
