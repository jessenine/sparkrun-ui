import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSparkrun: vi.fn(),
  runSparkrunJson: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrun: mocks.runSparkrun,
  runSparkrunJson: mocks.runSparkrunJson,
}));

import { stop, health } from "./workloads";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
type Health = { ready: boolean; state: string; reason?: string };

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

describe("workloads.stop", () => {
  it("runs sparkrun stop and returns ok", async () => {
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const r = (await handler(stop)({ input: { clusterId: "c1" } })) as {
      ok: boolean;
      clusterId: string;
    };
    expect(r).toEqual({ ok: true, clusterId: "c1" });
    expect(mocks.runSparkrun.mock.calls[0][0]).toEqual(["stop", "c1"]);
  });

  it("throws INTERNAL_SERVER_ERROR when sparkrun fails", async () => {
    mocks.runSparkrun.mockResolvedValue({ code: 1, stdout: "", stderr: "permission denied" });
    await expect(handler(stop)({ input: { clusterId: "c1" } })).rejects.toThrow(
      /Failed to stop c1/,
    );
  });
});

describe("workloads.health", () => {
  const status = (solo_entries: unknown[]) => ({
    host_count: solo_entries.length,
    groups: {},
    solo_entries,
    idle_hosts: [],
    pending_ops: [],
    errors: {},
    total_containers: solo_entries.length,
  });

  it("reports not_found when the workload is not in cluster status", async () => {
    mocks.runSparkrunJson.mockResolvedValue(status([]));
    const r = (await handler(health)({ input: { clusterId: "ghost" } })) as Health;
    expect(r).toEqual({
      ready: false,
      state: "not_found",
      reason: "Workload no longer running.",
    });
  });

  it("reports starting when the workload has no host:port yet", async () => {
    // meta.port = 0 is falsy, so !w.meta.port triggers the "starting" branch.
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 0 } }]),
    );
    const r = (await handler(health)({ input: { clusterId: "c1" } })) as Health;
    expect(r.state).toBe("starting");
    expect(r.ready).toBe(false);
  });

  it("returns ready when /health responds 200", async () => {
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 8000 } }]),
    );
    mockFetch(async (url) => {
      expect(String(url)).toBe("http://127.0.0.1:8000/health");
      return new Response("ok", { status: 200 });
    });
    const r = (await handler(health)({ input: { clusterId: "c1" } })) as Health;
    expect(r).toEqual({ ready: true, state: "ready" });
  });

  it("falls back to /v1/models when /health is not ok", async () => {
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 8000 } }]),
    );
    mockFetch(async (url) => {
      if (String(url).endsWith("/health")) return new Response("loading", { status: 503 });
      return new Response(JSON.stringify({ data: [{ id: "m" }] }), { status: 200 });
    });
    const r = (await handler(health)({ input: { clusterId: "c1" } })) as Health;
    expect(r).toEqual({ ready: true, state: "ready" });
  });

  it("reports starting with HTTP status when both probes fail", async () => {
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 8000 } }]),
    );
    mockFetch(async (url) =>
      String(url).endsWith("/health")
        ? new Response("x", { status: 503 })
        : new Response("x", { status: 404 }),
    );
    const r = (await handler(health)({ input: { clusterId: "c1" } })) as Health;
    expect(r.state).toBe("starting");
    expect(r.reason).toContain("503");
  });

  it("reports unreachable when fetch rejects", async () => {
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 8000 } }]),
    );
    mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = (await handler(health)({ input: { clusterId: "c1" } })) as Health;
    expect(r).toEqual({ ready: false, state: "unreachable", reason: "ECONNREFUSED" });
  });
});
