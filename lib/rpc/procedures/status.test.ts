import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ClusterStatusSchema } from "@/lib/schemas";
import { mapStatusToJobs, get, jobs, stream } from "./status";

const mocks = vi.hoisted(() => ({
  runSparkrunJson: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrunJson: mocks.runSparkrunJson,
}));

const FIX = join(__dirname, "../../__fixtures__");

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

const EMPTY = {
  host_count: 0,
  groups: {},
  solo_entries: [],
  idle_hosts: [],
  pending_ops: [],
  errors: {},
  total_containers: 0,
};

describe("status RPC logic (SC-P0-34)", () => {
  it("maps solo_entries to jobs with recipe, host, port, status", async () => {
    const raw = JSON.parse(await readFile(join(FIX, "cluster-status.json"), "utf8"));
    const status = ClusterStatusSchema.parse(raw);
    const jobs = mapStatusToJobs(status);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      cluster_id: "sparkrun_b64549a754f0",
      recipe: "/tmp/sparkrun-ui-drafts/d_x40tmp7hmpu62p61.yaml",
      host: "127.0.0.1",
      port: 8000,
      status: "Up 12 minutes",
    });
  });

  it("maps groups record entries to jobs", () => {
    const status = ClusterStatusSchema.parse({
      host_count: 1,
      groups: {
        sparkrun_grp01: {
          cluster_id: "sparkrun_grp01",
          meta: { recipe: "/recipes/g1.yaml", port: 9000 },
          hosts: ["192.168.1.10"],
          containers: [{ status: "Up 5 minutes" }],
        },
      },
      solo_entries: [],
      idle_hosts: [],
      pending_ops: [],
      errors: {},
      total_containers: 1,
    });
    const jobs = mapStatusToJobs(status);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      cluster_id: "sparkrun_grp01",
      recipe: "/recipes/g1.yaml",
      host: "192.168.1.10",
      port: 9000,
      status: "Up 5 minutes",
    });
  });

  it("filters out jobs with no cluster_id", () => {
    const status = ClusterStatusSchema.parse(EMPTY);
    expect(mapStatusToJobs(status)).toEqual([]);
  });
});

describe("status.get", () => {
  it("returns the parsed cluster status", async () => {
    mocks.runSparkrunJson.mockResolvedValue({ ...EMPTY, host_count: 2 });
    const r = (await handler(get)({})) as Record<string, unknown>;
    expect(r.host_count).toBe(2);
  });

  it("falls back to an empty status when sparkrun is unavailable", async () => {
    mocks.runSparkrunJson.mockRejectedValue(new Error("connection refused"));
    const r = (await handler(get)({})) as Record<string, unknown>;
    expect(r.solo_entries).toEqual([]);
  });
});

describe("status.jobs", () => {
  it("returns the mapped job list", async () => {
    mocks.runSparkrunJson.mockResolvedValue({
      ...EMPTY,
      solo_entries: [{ cluster_id: "c1", host: "h", meta: { recipe: "r", port: 1 }, status: "Up" }],
    });
    const r = (await handler(jobs)({})) as { jobs: unknown[] };
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0]).toMatchObject({ cluster_id: "c1", host: "h" });
  });
});

describe("status.stream", () => {
  it("yields a status tick and stops when the signal aborts", async () => {
    mocks.runSparkrunJson.mockResolvedValue({ ...EMPTY, host_count: 1 });
    const ac = new AbortController();
    const gen = handler(stream)({
      input: { intervalMs: 500 },
      signal: ac.signal,
    }) as AsyncGenerator<unknown>;
    const first = await gen.next();
    expect((first.value as Record<string, unknown>).host_count).toBe(1);
    ac.abort();
    const done = await gen.next();
    expect(done.done).toBe(true);
  });
});
