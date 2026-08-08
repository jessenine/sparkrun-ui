import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamSparkrunNdjson: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  streamSparkrunNdjson: mocks.streamSparkrunNdjson,
}));

import { stream, processes } from "./monitor";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
type Tick = { timestamp: number; hosts: Record<string, { hostname?: string }> };
type ProcResult = {
  timestamp: number;
  processes: { user: string; pid: number; cpu: number; mem: number; command: string }[];
};

const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

function streamOf<T>(items: T[]): AsyncGenerator<T> {
  return (async function* () {
    for (const i of items) yield i;
  })();
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

const tickRaw = {
  timestamp: 1750000000,
  hosts: { gx10: { hostname: "gx10", cpu_usage_pct: "45.5" } },
};

describe("monitor.stream", () => {
  it("yields normalized ticks from the ndjson stream, then respects abort", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(streamOf([tickRaw]));
    const ac = new AbortController();
    const gen = handler(stream)({
      input: { intervalSec: 2 },
      signal: ac.signal,
    }) as AsyncGenerator<Tick>;
    const first = await gen.next();
    expect((first.value as Tick).hosts.gx10.hostname).toBe("gx10");
    ac.abort();
    const done = await gen.next();
    expect(done.done).toBe(true);
  });

  it("yields an empty tick when the stream errors", async () => {
    mocks.streamSparkrunNdjson.mockImplementation(function* () {
      throw new Error("sparkrun unavailable");
    });
    const gen = handler(stream)({ input: undefined, signal: undefined }) as AsyncGenerator<Tick>;
    const first = await gen.next();
    expect((first.value as Tick).hosts).toEqual({});
  });
});

describe("monitor.processes", () => {
  const proc = (pid: number, cpu: number) => ({
    user: "root",
    pid,
    cpu,
    mem: 12.5,
    command: `/proc/${pid}`,
  });

  it("collects processes from the stream and sorts by CPU descending (top 10)", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(
      streamOf([
        {
          timestamp: 1,
          hosts: {
            h1: { processes: [proc(1, 30), proc(2, 90)] },
            h2: { processes: [proc(3, 40)] },
          },
        },
      ]),
    );
    const r = (await handler(processes)({ input: undefined })) as ProcResult;
    expect(r.processes.map((p) => p.pid)).toEqual([2, 3, 1]);
  });

  it("parses string-encoded processes", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(
      streamOf([{ timestamp: 1, hosts: { h1: { processes: JSON.stringify([proc(9, 70)]) } } }]),
    );
    const r = (await handler(processes)({ input: undefined })) as ProcResult;
    expect(r.processes.map((p) => p.pid)).toEqual([9]);
  });

  it("falls back to the host agent when the stream has no process data", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(streamOf([{ timestamp: 1, hosts: {} }]));
    mockFetch(
      async () =>
        new Response(JSON.stringify({ processes: [proc(5, 80), proc(6, 20)] }), { status: 200 }),
    );
    const r = (await handler(processes)({ input: undefined })) as ProcResult;
    expect(r.processes.map((p) => p.pid)).toEqual([5, 6]);
  });

  it("returns an empty list when both stream and agent are unavailable", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(streamOf([{ timestamp: 1, hosts: {} }]));
    mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = (await handler(processes)({ input: undefined })) as ProcResult;
    expect(r.processes).toEqual([]);
  });
});
