import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  open: vi.fn(),
  createInterface: vi.fn(),
  homedir: vi.fn(),
  parse: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: mocks.readdir,
  readFile: mocks.readFile,
  stat: mocks.stat,
  open: mocks.open,
}));

vi.mock("node:readline", () => ({
  createInterface: mocks.createInterface,
}));

vi.mock("node:os", () => ({
  homedir: () => "/home/u",
}));

vi.mock("yaml", () => ({
  parse: mocks.parse,
}));

import {
  deriveStatus,
  isTerminalStatus,
  listBenchmarks,
  getBenchmark,
  readBenchmarkLogs,
  watchBenchmarkLogs,
  watchBenchmarkFiles,
  type BenchmarkState,
} from "./state";

type State = {
  benchmark_id?: string;
  recipe_qualified_name?: string;
  framework?: string;
  sessions?: { session: number; started_at: string; status: string; ended_at?: string }[];
  schedule?: { depth?: number }[];
  completed_indices?: number[];
  failed_indices?: number[];
  created_at?: string;
  updated_at?: string;
};

beforeEach(() => {
  mocks.parse.mockImplementation((raw: string) => JSON.parse(raw));
  mocks.createInterface.mockImplementation(async function* ({
    input,
  }: {
    input: { _lines: string[] };
  }) {
    for (const l of input._lines ?? []) yield l;
    return undefined;
  });
});

afterEach(() => vi.clearAllMocks());

describe("isTerminalStatus", () => {
  it.each(["completed", "partial", "failed"])("returns true for %s", (s) => {
    expect(isTerminalStatus(s as never)).toBe(true);
  });

  it.each(["running", "unknown"])("returns false for %s", (s) => {
    expect(isTerminalStatus(s as never)).toBe(false);
  });
});

describe("deriveStatus", () => {
  it("returns unknown when there are no sessions", () => {
    expect(deriveStatus({ benchmark_id: "bench_x" })).toBe("unknown");
  });

  it("returns completed for a completed last session", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "completed", ended_at: "t2" }],
    };
    expect(deriveStatus(state)).toBe("completed");
  });

  it("returns running when last session is running", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "running" }],
    };
    expect(deriveStatus(state)).toBe("running");
  });

  it("returns running for a partial session with no ended_at", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "partial" }],
    };
    expect(deriveStatus(state)).toBe("running");
  });

  it("returns failed for a partial session with failures", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      failed_indices: [0, 1],
      sessions: [{ session: 1, started_at: "t", status: "partial", ended_at: "t2" }],
    };
    expect(deriveStatus(state)).toBe("failed");
  });

  it("returns partial for a partial session with no failures", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "partial", ended_at: "t2" }],
    };
    expect(deriveStatus(state)).toBe("partial");
  });

  it("returns failed for a failed last session", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "failed", ended_at: "t2" }],
    };
    expect(deriveStatus(state)).toBe("failed");
  });

  it("returns running for unrecognized status without ended_at", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "weird" }],
    };
    expect(deriveStatus(state)).toBe("running");
  });

  it("returns unknown for unrecognized status with ended_at", () => {
    const state: BenchmarkState = {
      benchmark_id: "bench_x",
      sessions: [{ session: 1, started_at: "t", status: "weird", ended_at: "t2" }],
    };
    expect(deriveStatus(state)).toBe("unknown");
  });
});

describe("listBenchmarks", () => {
  it("returns an empty list when the dir is missing", async () => {
    mocks.readdir.mockRejectedValue(new Error("ENOENT"));
    await expect(listBenchmarks()).resolves.toEqual([]);
  });

  it("summarizes bench dirs sorted by updatedAt desc", async () => {
    mocks.readdir.mockResolvedValue(["bench_aaa", "nope", "bench_bbb"]);
    mocks.readFile.mockImplementation(async (p: string) => {
      const raw: State = String(p).includes("bench_aaa")
        ? {
            benchmark_id: "bench_aaa",
            sessions: [{ session: 1, started_at: "s", status: "completed", ended_at: "e" }],
            updated_at: "2020-01-01",
          }
        : {
            benchmark_id: "bench_bbb",
            sessions: [{ session: 1, started_at: "s", status: "running" }],
            updated_at: "2021-01-01",
          };
      return JSON.stringify(raw);
    });
    const r = await listBenchmarks();
    expect(r.map((b) => b.id)).toEqual(["bench_bbb", "bench_aaa"]);
    expect(r[0].status).toBe("running");
    expect(r[0].scheduleCount).toBe(0);
  });

  it("drops dirs whose state fails to parse", async () => {
    mocks.readdir.mockResolvedValue(["bench_bad", "bench_ok"]);
    mocks.readFile.mockImplementation(async (p: string) =>
      String(p).includes("bench_bad") ? "%%%boom%%%" : JSON.stringify({ benchmark_id: "bench_ok" }),
    );
    const r = await listBenchmarks();
    expect(r.map((b) => b.id)).toEqual(["bench_ok"]);
  });
});

describe("getBenchmark", () => {
  it("returns null for an invalid id", async () => {
    await expect(getBenchmark("../../etc")).resolves.toBeNull();
  });

  it("returns null when the dir does not exist", async () => {
    mocks.stat.mockRejectedValue(new Error("ENOENT"));
    await expect(getBenchmark("bench_x")).resolves.toBeNull();
  });

  it("reads state and consolidated", async () => {
    mocks.stat.mockResolvedValue({});
    mocks.readFile.mockImplementation(async (p: string) =>
      String(p).endsWith("state.yaml")
        ? JSON.stringify({ benchmark_id: "bench_x" })
        : JSON.stringify({ model: "q", max_concurrency: 2, benchmarks: [] }),
    );
    const r = await getBenchmark("bench_x");
    expect(r?.state.benchmark_id).toBe("bench_x");
    expect(r?.consolidated?.model).toBe("q");
  });

  it("returns consolidated null when it is missing", async () => {
    mocks.stat.mockResolvedValue({});
    mocks.readFile.mockImplementation(async (p: string) =>
      String(p).endsWith("state.yaml")
        ? JSON.stringify({ benchmark_id: "bench_x" })
        : (() => {
            throw new Error("ENOENT");
          })(),
    );
    const r = await getBenchmark("bench_x");
    expect(r?.consolidated).toBeNull();
  });
});

describe("readBenchmarkLogs", () => {
  beforeEach(() => {
    mocks.readdir.mockResolvedValue(["1_run.log", "2_run.log"]);
    mocks.open.mockResolvedValue({ createReadStream: () => ({ _lines: ["a", "b"] }) });
  });

  it("returns lines, lastFile, lastLine across files", async () => {
    const r = await readBenchmarkLogs("bench_x");
    expect(r.lines).toEqual(["a", "b", "a", "b"]);
    expect(r.lastFile).toBe(2);
    expect(r.lastLine).toBe(2);
  });

  it("respects sinceFile/sinceLine", async () => {
    const r = await readBenchmarkLogs("bench_x", { sinceFile: 1, sinceLine: 1 });
    // file 1: skip line 1 -> ["b"]; file 2: full -> ["a","b"]
    expect(r.lines).toEqual(["b", "a", "b"]);
  });

  it("returns empty for invalid id or missing runs dir", async () => {
    expect(await readBenchmarkLogs("bad!")).toEqual({ lines: [], lastFile: 0, lastLine: 0 });
    mocks.readdir.mockRejectedValue(new Error("ENOENT"));
    expect(await readBenchmarkLogs("bench_x")).toEqual({ lines: [], lastFile: 0, lastLine: 0 });
  });
});

describe("watchBenchmarkLogs", () => {
  it("yields lines then stops on abort", async () => {
    mocks.readdir.mockResolvedValue(["1_run.log"]);
    mocks.open.mockResolvedValue({ createReadStream: () => ({ _lines: ["l1", "l2"] }) });
    const ac = new AbortController();
    const gen = watchBenchmarkLogs("bench_x", { signal: ac.signal, intervalMs: 10 });
    const chunk: string[] = [];
    chunk.push((await gen.next()).value as string);
    chunk.push((await gen.next()).value as string);
    ac.abort();
    const done = await gen.next();
    expect(chunk).toEqual(["l1", "l2"]);
    expect(done.done).toBe(true);
  });
});

describe("watchBenchmarkFiles", () => {
  it("yields state and consolidated when files change, then stops on abort", async () => {
    mocks.readFile.mockImplementation(async (p: string) => {
      if (String(p).endsWith("state.yaml")) return JSON.stringify({ benchmark_id: "bench_x" });
      return JSON.stringify({ model: "q", max_concurrency: 1, benchmarks: [] });
    });
    mocks.stat.mockResolvedValue({ mtimeMs: 1 });
    const ac = new AbortController();
    const gen = watchBenchmarkFiles("bench_x", { signal: ac.signal, intervalMs: 10 });
    const first = (await gen.next()).value as State;
    expect(first.state?.benchmark_id).toBe("bench_x");
    ac.abort();
    const done = await gen.next();
    expect(done.done).toBe(true);
  });
});
