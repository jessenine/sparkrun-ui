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
type ProcHostsResult = {
  timestamp: number;
  hosts: {
    host: string;
    hostname?: string;
    ip_address?: string;
    processes: { user: string; pid: number; cpu: number; mem: number; command: string }[];
  }[];
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

  it("excludes array-format hosts that errored or returned no sample", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(
      streamOf([
        {
          timestamp: 1,
          hosts: [
            {
              host: "dead",
              error: "ssh: connect refused",
              sample: { hostname: "dead", cpu_usage_pct: "0" },
            },
            { host: "empty", error: null, sample: null },
            { host: "alive", error: null, sample: { hostname: "alive", cpu_usage_pct: "45" } },
          ],
        },
      ]),
    );
    const gen = handler(stream)({ input: undefined, signal: undefined }) as AsyncGenerator<Tick>;
    const tick = (await gen.next()).value as Tick;
    expect(Object.keys(tick.hosts)).toEqual(["alive"]);
  });

  it("excludes flat-record hosts whose sample is an empty object", async () => {
    mocks.streamSparkrunNdjson.mockReturnValue(
      streamOf([
        { timestamp: 1, hosts: { dead: {}, alive: { hostname: "alive", cpu_usage_pct: "10" } } },
      ]),
    );
    const gen = handler(stream)({ input: undefined, signal: undefined }) as AsyncGenerator<Tick>;
    const tick = (await gen.next()).value as Tick;
    expect(Object.keys(tick.hosts)).toEqual(["alive"]);
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
  const agentReply = (pid: number, cpu: number, hostname: string, ip: string) => ({
    processes: [proc(pid, cpu)],
    hostname,
    ip_address: ip,
  });
  const urlOf = (input: RequestInfo | URL): string =>
    input instanceof Request ? input.url : String(input);

  it("queries each candidate host's agent and returns per-host live results", async () => {
    mockFetch(async (input) => {
      const u = urlOf(input);
      if (u.includes("192.168.1.22"))
        return new Response(JSON.stringify(agentReply(3, 90, "spark-30fc", "192.168.1.22")), {
          status: 200,
        });
      if (u.includes("127.0.0.1"))
        return new Response(JSON.stringify(agentReply(1, 40, "spark-c149", "192.168.1.77")), {
          status: 200,
        });
      return new Response("not found", { status: 404 });
    });
    const r = (await handler(processes)({
      input: { hosts: ["127.0.0.1", "192.168.1.22"] },
    })) as ProcHostsResult;
    expect(r.hosts).toHaveLength(2);
    expect(r.hosts.map((h) => h.host)).toEqual(["127.0.0.1", "192.168.1.22"]);
    expect(r.hosts[0].hostname).toBe("spark-c149");
    expect(r.hosts[0].ip_address).toBe("192.168.1.77");
    expect(r.hosts[1].hostname).toBe("spark-30fc");
    expect(r.hosts[1].processes.map((p) => p.pid)).toEqual([3]);
  });

  it("omits hosts whose agent is unreachable (only live agents)", async () => {
    mockFetch(async (input) => {
      const u = urlOf(input);
      if (u.includes("10.0.0.9")) throw new Error("ECONNREFUSED");
      return new Response(JSON.stringify(agentReply(5, 60, "alive", "10.0.0.5")), {
        status: 200,
      });
    });
    const r = (await handler(processes)({
      input: { hosts: ["10.0.0.5", "10.0.0.9"] },
    })) as ProcHostsResult;
    expect(r.hosts).toHaveLength(1);
    expect(r.hosts[0].host).toBe("10.0.0.5");
    expect(r.hosts[0].hostname).toBe("alive");
  });

  it("defaults to the local agent (127.0.0.1) when no hosts are given", async () => {
    mockFetch(async (input) => {
      expect(urlOf(input)).toContain("127.0.0.1");
      return new Response(JSON.stringify(agentReply(7, 20, "spark-c149", "192.168.1.77")), {
        status: 200,
      });
    });
    const r = (await handler(processes)({ input: { hosts: [] } })) as ProcHostsResult;
    expect(r.hosts).toHaveLength(1);
    expect(r.hosts[0].host).toBe("127.0.0.1");
    expect(r.hosts[0].processes.map((p) => p.pid)).toEqual([7]);
  });

  it("returns empty hosts when every agent is unreachable", async () => {
    mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = (await handler(processes)({
      input: { hosts: ["10.0.0.1", "10.0.0.2"] },
    })) as ProcHostsResult;
    expect(r.hosts).toEqual([]);
  });

  it("sorts each host's processes by CPU descending (top 10)", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ processes: [proc(1, 30), proc(2, 90)] }), {
          status: 200,
        }),
    );
    const r = (await handler(processes)({
      input: { hosts: ["10.0.0.1"] },
    })) as ProcHostsResult;
    expect(r.hosts[0].processes.map((p) => p.pid)).toEqual([2, 1]);
  });
});
