import { serverClient as _serverClient } from "@/lib/rpc/server";
import { BenchmarksList } from "@/app/components/benchmarks/BenchmarksList";

export const dynamic = "force-dynamic";

// Suppress type error - ORPC framework type inference issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ORPC server-client type-inference escape
const serverClient = _serverClient as any;

export default async function BenchmarksPage() {
  const benchmarks = await serverClient.benchmarks.list();
  return <BenchmarksList benchmarks={benchmarks} />;
}
