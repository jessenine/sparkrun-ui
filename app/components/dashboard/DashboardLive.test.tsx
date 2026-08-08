// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardLive } from "./DashboardLive";
import type { ClusterStatus } from "@/lib/schemas";

const monitorStream = vi.fn();
const monitorProcesses = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    monitor: {
      stream: (...a: unknown[]) => monitorStream(...a),
      processes: (...a: unknown[]) => monitorProcesses(...a),
    },
  },
}));

// Focus the test on DashboardLive's own rendering/logic by stubbing children
vi.mock("./AggregateStats", () => ({
  AggregateStats: () => <div data-testid="aggregate-stats" />,
}));
vi.mock("./SparklineGraph", () => ({
  SparklineGraph: () => <div data-testid="sparkline" />,
}));
vi.mock("./ProcessList", () => ({
  ProcessList: ({ processes }: { processes: unknown[] }) => (
    <div data-testid="process-list">{processes.length}</div>
  ),
}));
vi.mock("./WorkloadCard", () => ({
  WorkloadCard: () => <div data-testid="workload-card" />,
}));

function stream(events: Record<string, unknown>[]): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

const recipeByCluster = new Map();

function makeInitial(overrides: Partial<ClusterStatus> = {}): ClusterStatus {
  return {
    groups: {},
    solo_entries: [],
    idle_hosts: [],
    pending_ops: [],
    errors: {},
    total_containers: 3,
    host_count: 1,
    ...overrides,
  };
}

describe("DashboardLive", () => {
  beforeEach(() => {
    monitorStream.mockReset();
    monitorProcesses.mockReset();
    // Default: empty stream that yields nothing so poll effects are inert.
    monitorStream.mockResolvedValue(stream([]));
    monitorProcesses.mockResolvedValue({ processes: [] });
  });

  it("renders the header with host and container counts", () => {
    render(
      <DashboardLive
        initial={makeInitial({ host_count: 2, total_containers: 5 })}
        recipeByCluster={recipeByCluster}
      />,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("2 hosts")).toBeInTheDocument();
    expect(screen.getByText("5 running")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.getByTestId("aggregate-stats")).toBeInTheDocument();
  });

  it("shows the empty state when no workloads are running", () => {
    render(<DashboardLive initial={makeInitial()} recipeByCluster={recipeByCluster} />);
    expect(screen.getByText("No workloads running")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /launch a recipe/i })).toHaveAttribute(
      "href",
      "/launch",
    );
  });

  it("renders workload cards when solo workloads are present", () => {
    render(
      <DashboardLive
        initial={makeInitial({
          solo_entries: [
            {
              cluster_id: "c1",
              host: "10.0.0.1",
              status: "running",
              label: "cl1",
              meta: { overrides: {} },
            },
          ],
        })}
        recipeByCluster={recipeByCluster}
      />,
    );
    expect(screen.getAllByTestId("workload-card").length).toBe(1);
  });

  it("renders active jobs derived from groups", () => {
    render(
      <DashboardLive
        initial={makeInitial({
          groups: {
            g1: {
              meta: { recipe: "official/qwen", host: undefined, port: undefined },
              hosts: ["10.0.0.9"],
              containers: [{ status: "running" }],
            },
          },
          solo_entries: [
            {
              cluster_id: "c1",
              host: "10.0.0.1",
              status: "ready",
              meta: { recipe: "solo/recipe", overrides: {} },
            },
          ],
        })}
        recipeByCluster={recipeByCluster}
      />,
    );
    expect(screen.getByText("Active Jobs")).toBeInTheDocument();
    expect(screen.getByText("g1")).toBeInTheDocument();
    expect(screen.getByText("official/qwen")).toBeInTheDocument();
    expect(screen.getByText("c1")).toBeInTheDocument();
    expect(screen.getByText("solo/recipe")).toBeInTheDocument();
  });

  it("renders cluster status error messages from initial.errors", () => {
    render(
      <DashboardLive
        initial={makeInitial({
          errors: { "10.0.0.1": new Error("boom") },
        })}
        recipeByCluster={recipeByCluster}
      />,
    );
    expect(screen.getByText("Cluster status reported errors")).toBeInTheDocument();
    expect(screen.getByText(/10\.0\.0\.1/)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it("renders a plain-string host error value", () => {
    render(
      <DashboardLive
        initial={makeInitial({ errors: { h1: "plain failure" } })}
        recipeByCluster={recipeByCluster}
      />,
    );
    expect(screen.getByText(/plain failure/)).toBeInTheDocument();
  });

  it("shows the Loading metrics spinner before any data arrives and no hosts", async () => {
    render(<DashboardLive initial={makeInitial()} recipeByCluster={recipeByCluster} />);
    // Empty stream + no initial hosts → spinner stays until process data arrives.
    expect(screen.getByText("Loading metrics...")).toBeInTheDocument();
  });

  it("populates metric history from monitor stream ticks and renders host cards", async () => {
    monitorStream.mockResolvedValue(
      stream([
        {
          hosts: {
            "10.0.0.1": { cpu_usage_pct: "5.5", gpu_util_pct: "10", mem_used_pct: "20.1" },
          },
        },
      ]),
    );
    render(<DashboardLive initial={makeInitial()} recipeByCluster={recipeByCluster} />);
    await waitFor(() => {
      expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    });
    expect(screen.getByText("Host metrics")).toBeInTheDocument();
    // 5 sparklines per host (CPU, GPU, Mem, Power, Temp, GPU Temp = 6 here)
    expect(screen.getAllByTestId("sparkline").length).toBeGreaterThan(0);
  });

  it("writes process history from the processes RPC call and lists processes", async () => {
    monitorProcesses.mockResolvedValue({
      processes: [{ pid: 1, name: "python", cpu_pct: 10 }],
    });
    render(
      <DashboardLive
        initial={makeInitial({
          groups: { g1: { meta: { hosts: ["10.0.0.1"] } } },
        })}
        recipeByCluster={recipeByCluster}
      />,
    );
    await waitFor(() => {
      expect(monitorProcesses).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("Top Processes")).toBeInTheDocument();
    });
    expect(monitorProcesses).toHaveBeenCalledWith({ hosts: ["10.0.0.1"] });
  });

  it("queries processes immediately with the hosts from the first cluster group", async () => {
    render(
      <DashboardLive
        initial={makeInitial({
          groups: { g1: { meta: { hosts: ["10.0.0.5"] } } },
        })}
        recipeByCluster={recipeByCluster}
      />,
    );
    await waitFor(() => {
      expect(monitorProcesses).toHaveBeenCalledWith({ hosts: ["10.0.0.5"] });
    });
  });

  it("continues rendering when the processes RPC rejects", async () => {
    monitorProcesses.mockRejectedValue(new Error("agent down"));
    render(<DashboardLive initial={makeInitial()} recipeByCluster={recipeByCluster} />);
    // Should not throw; the catch block just warns and keeps the loading state.
    expect(screen.getByText("Loading metrics...")).toBeInTheDocument();
  });
});
