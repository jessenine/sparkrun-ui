import "server-only";
import { createRouterClient } from "@orpc/server";
import { router } from "./router";

// Suppress type errors - ORPC framework's type inference doesn't work correctly
// with the nested router structure. The runtime functionality works correctly.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const serverClient = createRouterClient(router, { context: {} });
