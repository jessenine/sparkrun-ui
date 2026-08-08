import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { router } from "@/lib/rpc/router";

export const dynamic = "force-dynamic";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error("[rpc] ORPC error:", error);
    }),
  ],
});

async function handle(request: Request): Promise<Response> {
  console.log("[rpc] Received:", request.method, request.url, request.headers.get("content-type"));
  try {
    const { response } = await handler.handle(request, {
      prefix: "/rpc",
      context: {},
    });
    if (response) {
      console.log(
        "[rpc] Response:",
        response.status,
        response.statusText,
        response.headers.get("content-type"),
      );
      return response;
    }
    console.log("[rpc] No response from ORPC handler for:", request.url);
  } catch (e) {
    console.error("[rpc] Exception in handler:", e);
  }
  return new Response("Not found", { status: 404 });
}

export const HEAD = handle;
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
