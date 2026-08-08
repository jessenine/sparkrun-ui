// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { BenchmarkState } from "@/lib/state";

const watchStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { benchmarks: { watch: (...a: unknown[]) => watchStream(...a) } },
}));

import { BenchmarkDetail } from "./BenchmarkDetail";

function eventsGen(events: Record<string, unknown>[]): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}
function emptyGen(): AsyncGenerator<never> {
  return (async function* () {})();
}

const state: BenchmarkState = {
  benchmark_id: "bench-1",
  cluster_id: "cluster-a",
  recipe_qualified_name: "official/qwen2.5",
  framework: "vllm",
  base_args: { "--model": "qwen" },
  schedule: [{}, {}],
  completed_indices: [0],
  session_count: 1,
  sessions: [{ session: 1, started_at: "2026-08-07T12:00:00Z", status: "running" }],
  created_at: "2026-08-07T12:00:00Z",
  updated_at: "2026-08-07T12:05:00Z",
};

describe("BenchmarkDetail", () => {
  beforeEach(() => {
    watchStream.mockReset();
  });

  it("shows a loading state while there is no initial state", async () => {
    watchStream.mockResolvedValue(emptyGen());
    render(<BenchmarkDetail id="bench-1" initialState={null} initialConsolidated={null} />);
    expect(screen.getByText("Loading benchmark…")).toBeInTheDocument();
  });

  it("renders id, recipe, framework and run info from initial state", async () => {
    watchStream.mockResolvedValue(emptyGen());
    render(<BenchmarkDetail id="bench-1" initialState={state} initialConsolidated={null} />);
    expect(screen.getByText("bench-1")).toBeInTheDocument();
    expect(screen.getByText("official/qwen2.5")).toBeInTheDocument();
    expect(screen.getByText("vllm")).toBeInTheDocument();
    expect(screen.getByText("Run info")).toBeInTheDocument();
    expect(screen.getByText("cluster-a")).toBeInTheDocument();
  });

  it("displays streamed log lines and the running status", async () => {
    watchStream.mockResolvedValue(
      eventsGen([
        { type: "log", line: "Loading weights" },
        { type: "log", line: "Server ready" },
        { type: "done" },
      ]),
    );
    render(<BenchmarkDetail id="bench-1" initialState={state} initialConsolidated={null} />);
    await waitFor(() => {
      expect(screen.getByText("Loading weights")).toBeInTheDocument();
      expect(screen.getByText("Server ready")).toBeInTheDocument();
      expect(screen.getByText(/Log \(2\)/)).toBeInTheDocument();
    });
  });
});
