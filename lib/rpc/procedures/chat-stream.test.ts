import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSparkrunJson: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrunJson: mocks.runSparkrunJson,
}));

import { stream } from "./chat";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

const input = {
  clusterId: "sparkrun_c1",
  messages: [{ role: "user" as const, content: "hi" }],
  model: "qwen",
};

const statusWith = (clusterId: string) => ({
  host_count: 1,
  groups: {},
  solo_entries: [{ cluster_id: clusterId, host: "127.0.0.1", meta: { port: 8000 }, status: "Up" }],
  idle_hosts: [],
  pending_ops: [],
  errors: {},
  total_containers: 1,
});

describe("chat.stream", () => {
  it("streams SSE content deltas from the vLLM endpoint", async () => {
    mocks.runSparkrunJson.mockResolvedValue(statusWith("sparkrun_c1"));
    const sse =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      "data: [DONE]\n\n";
    const enc = new TextEncoder();
    mockFetch(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(enc.encode(sse));
              c.close();
            },
          }),
          { status: 200 },
        ),
    );
    const gen = handler(stream)({ input, signal: undefined }) as AsyncGenerator<string>;
    const chunks: string[] = [];
    for await (const ev of gen) chunks.push(ev);
    expect(chunks).toEqual(["Hel", "lo"]);
    const firstUrl = String(
      (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
    );
    expect(firstUrl).toContain("/v1/chat/completions");
  });

  it("throws NOT_FOUND when the workload is missing", async () => {
    mocks.runSparkrunJson.mockResolvedValue(statusWith("other"));
    const gen = handler(stream)({ input, signal: undefined }) as AsyncGenerator<unknown>;
    await expect(gen.next()).rejects.toThrow(/Workload "sparkrun_c1" not found/);
  });

  it("surfaces a non-ok vLLM response as an error", async () => {
    mocks.runSparkrunJson.mockResolvedValue(statusWith("sparkrun_c1"));
    mockFetch(async () => new Response("model overloaded", { status: 429 }));
    const gen = handler(stream)({ input, signal: undefined }) as AsyncGenerator<unknown>;
    await expect(gen.next()).rejects.toThrow(/vLLM returned 429/);
  });

  it("resolves the served model via /v1/models when model is omitted", async () => {
    mocks.runSparkrunJson.mockResolvedValue(statusWith("sparkrun_c1"));
    const enc = new TextEncoder();
    mockFetch(async (url) => {
      if (String(url).includes("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "auto-model" }] }), { status: 200 });
      }
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(
              enc.encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n\n'),
            );
            c.close();
          },
        }),
        { status: 200 },
      );
    });
    const gen = handler(stream)({
      input: { ...input, model: undefined },
      signal: undefined,
    }) as AsyncGenerator<string>;
    const chunks: string[] = [];
    for await (const ev of gen) chunks.push(ev);
    expect(chunks).toEqual(["x"]);
  });
});
