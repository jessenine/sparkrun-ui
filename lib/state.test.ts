import { describe, expect, it } from "vitest";
import { deriveStatus, isTerminalStatus, type BenchmarkState } from "./state";

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
