import { serverClient as _serverClient } from "@/lib/rpc/server";
import { ChatPage } from "@/app/components/chat/ChatPage";

export const dynamic = "force-dynamic";

// Suppress type error - ORPC framework type inference issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const serverClient = _serverClient as any;

export default async function ChatRoute({
  searchParams,
}: {
  searchParams: Promise<{ clusterId?: string }>;
}) {
  const [initial, sp] = await Promise.all([serverClient.status.get(), searchParams]);
  return <ChatPage initial={initial} initialClusterId={sp.clusterId} />;
}
