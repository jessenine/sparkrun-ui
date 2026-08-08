import { serverClient as _serverClient } from "@/lib/rpc/server";
import { BenchmarkDetail } from "@/app/components/benchmarks/BenchmarkDetail";
import type { BenchmarkState, Consolidated } from "@/lib/state";

export const dynamic = "force-dynamic";

// Suppress type error - ORPC framework type inference issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ORPC server-client type-inference escape
const serverClient = _serverClient as any;

export default async function BenchmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Best-effort initial fetch so SSR has content; client stream will keep it updated.
  // If the benchmark dir doesn't exist yet (just-started run racing the redirect),
  // initial state is null and the client takes over via watch().
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const data = await serverClient.benchmarks.get({ id }).catch(() => null);

  return (
    <BenchmarkDetail
      id={id}
      initialState={(data?.state as BenchmarkState) ?? null}
      initialConsolidated={(data?.consolidated as Consolidated | null) ?? null}
    />
  );
}
