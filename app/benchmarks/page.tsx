import { serverClient as _serverClient } from "@/lib/rpc/server";
import { BenchmarksList } from "@/app/components/benchmarks/BenchmarksList";

export const dynamic = "force-dynamic";

// Suppress type error - ORPC framework type inference issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const serverClient = _serverClient as any;

export default async function BenchmarksPage() {
  const benchmarks = await serverClient.benchmarks.list();
  return <BenchmarksList benchmarks={benchmarks} />;
}
