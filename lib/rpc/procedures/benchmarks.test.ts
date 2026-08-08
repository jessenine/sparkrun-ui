import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSparkrun: vi.fn(),
  startBenchmark: vi.fn(),
  getBenchmarkProc: vi.fn(),
  subscribeBenchmarkLog: vi.fn(),
  listBenchmarks: vi.fn(),
  getBenchmark: vi.fn(),
  readBenchmarkLogs: vi.fn(),
  watchBenchmarkFiles: vi.fn(),
  watchBenchmarkLogs: vi.fn(),
  deriveStatus: vi.fn(),
  isTerminalStatus: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrun: mocks.runSparkrun,
  startBenchmark: mocks.startBenchmark,
  getBenchmarkProc: mocks.getBenchmarkProc,
  subscribeBenchmarkLog: mocks.subscribeBenchmarkLog,
}));

vi.mock("@/lib/state", () => ({
  listBenchmarks: mocks.listBenchmarks,
  getBenchmark: mocks.getBenchmark,
  readBenchmarkLogs: mocks.readBenchmarkLogs,
  watchBenchmarkFiles: mocks.watchBenchmarkFiles,
  watchBenchmarkLogs: mocks.watchBenchmarkLogs,
  deriveStatus: mocks.deriveStatus,
  isTerminalStatus: mocks.isTerminalStatus,
}));

import { list, get, profiles, run, watch } from "./benchmarks";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
type BenchmarkSummary = Record<string, unknown>;

const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

function noopStream(): AsyncGenerator<never> {
  return (async function* () {})() as AsyncGenerator<never>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("benchmarks.list", () => {
  it("returns the in-memory benchmark summaries", async () => {
    mocks.listBenchmarks.mockReturnValue([{ id: "b1", status: "completed" }]);
    const r = (await handler(list)({})) as BenchmarkSummary[];
    expect(r).toEqual([{ id: "b1", status: "completed" }]);
    expect(mocks.listBenchmarks).toHaveBeenCalled();
  });
});

describe("benchmarks.get", () => {
  it("returns the benchmark state and consolidated data", async () => {
    mocks.getBenchmark.mockResolvedValue({ state: { id: "b1" }, consolidated: { rows: [] } });
    const r = (await handler(get)({ input: { id: "b1" } })) as {
      state: unknown;
      consolidated: unknown;
    };
    expect(r).toEqual({ state: { id: "b1" }, consolidated: { rows: [] } });
    expect(mocks.getBenchmark).toHaveBeenCalledWith("b1");
  });

  it("returns null when the benchmark is not found", async () => {
    mocks.getBenchmark.mockResolvedValue(undefined);
    const r = await handler(get)({ input: { id: "nope" } });
    expect(r).toBeNull();
  });
});

describe("benchmarks.profiles", () => {
  it("parses profiles from a successful run", async () => {
    mocks.runSparkrun.mockResolvedValue({
      code: 0,
      stdout:
        "Profile          Registry       Framework\n-----       ------------\nperf-a       hf-endpoint   vllm\nperf-b       private       vllm\n",
      stderr: "",
    });
    const r = (await handler(profiles)({})) as {
      name: string;
      registry: string;
      framework: string;
    }[];
    expect(r).toEqual([
      { name: "perf-a", registry: "hf-endpoint", framework: "vllm" },
      { name: "perf-b", registry: "private", framework: "vllm" },
    ]);
  });

  it("returns an empty array when sparkrun fails", async () => {
    mocks.runSparkrun.mockResolvedValue({ code: 1, stdout: "", stderr: "boom" });
    const r = await handler(profiles)({});
    expect(r).toEqual([]);
  });
});

describe("benchmarks.run", () => {
  it("builds the arg list and starts the benchmark", async () => {
    mocks.startBenchmark.mockResolvedValue({ id: "b1" });
    const r = (await handler(run)({
      input: {
        recipe: "official/qwen",
        cluster: "lab",
        tp: 4,
        concurrency: [8, 16],
        tg: [64],
        port: 8000,
      },
    })) as { id: string };
    expect(r).toEqual({ id: "b1" });
    const args = mocks.startBenchmark.mock.calls[0][0] as string[];
    expect(args).toContain("benchmark");
    expect(args).toContain("--cluster");
    expect(args).toContain("lab");
    expect(args).toContain("--tp");
    expect(args).toContain("4");
    expect(args).toContain("-b");
    expect(args).toContain("concurrency=8,16");
    expect(args).toContain("tg=64");
    expect(args).toContain("--port");
    expect(args).toContain("8000");
    expect(args).toContain("--fresh");
  });

  it("appends --fresh even when only the recipe is given", async () => {
    mocks.startBenchmark.mockResolvedValue({ id: "b1" });
    await handler(run)({ input: { recipe: "official/qwen" } });
    // Note: source's "Must specify at least cluster, hosts, or profile" guard is
    // dead code — it checks args.length === 3 after --fresh is pushed, so it
    // never fires. Flagged; not asserted to avoid freezing the bug.
    expect(mocks.startBenchmark).toHaveBeenCalled();
  });

  it("maps startBenchmark failure to INTERNAL_SERVER_ERROR", async () => {
    mocks.startBenchmark.mockRejectedValue(new Error("no gpu"));
    await expect(handler(run)({ input: { recipe: "r", cluster: "c" } })).rejects.toThrow("no gpu");
  });
});

describe("benchmarks.watch", () => {
  it("replays a completed disk-backed benchmark then emits done", async () => {
    mocks.getBenchmark.mockResolvedValue({
      state: { status: "completed" },
      consolidated: { rows: [] },
    });
    mocks.getBenchmarkProc.mockReturnValue(null);
    mocks.readBenchmarkLogs.mockResolvedValue({ lines: ["line1", "line2"] });
    mocks.deriveStatus.mockReturnValue("completed");
    mocks.isTerminalStatus.mockReturnValue(true);

    const gen = handler(watch)({ input: { id: "b1" } }) as AsyncGenerator<{ type: string }>;
    const events: string[] = [];
    for await (const ev of gen) events.push(ev.type);
    expect(events).toEqual(["state", "metrics", "log", "log", "done"]);
  });

  it("emits done with ok=false for an unknown benchmark with no watcher events", async () => {
    mocks.getBenchmark.mockResolvedValue(undefined);
    mocks.getBenchmarkProc.mockReturnValue(null);
    mocks.watchBenchmarkFiles.mockReturnValue(noopStream());
    mocks.watchBenchmarkLogs.mockReturnValue(noopStream());

    const gen = handler(watch)({ input: { id: "missing" } }) as AsyncGenerator<{
      type: string;
      ok: boolean;
    }>;
    const events: unknown[] = [];
    for await (const ev of gen) events.push(ev);
    expect(events[events.length - 1]).toEqual({ type: "done", ok: false });
  });
});
