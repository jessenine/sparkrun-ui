// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock the ORPC client so component tests don't need a live server.
const diskList = vi.fn();
const monitorStream = vi.fn();

vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    disk: { list: (...args: unknown[]) => diskList(...args) },
    monitor: { stream: (...args: unknown[]) => monitorStream(...args) },
  },
}));

import { AggregateStats } from "./AggregateStats";

const tick = {
  timestamp: Date.now(),
  hosts: {
    node1: {
      cpu_usage_pct: "50",
      gpu_util_pct: "80",
      mem_used_mb: "20480",
      mem_total_mb: "65536",
      gpu_mem_used_mb: "4096",
      gpu_mem_total_mb: "8192",
      gpu_power_w: "200",
      cpu_temp_c: "60",
      gpu_temp_c: "70",
      sparkrun_jobs: "3",
    },
  },
};

function stream(values: unknown[]): AsyncGenerator<unknown> {
  return (async function* () {
    for (const v of values) yield v;
  })();
}

describe("AggregateStats", () => {
  beforeEach(() => {
    diskList.mockReset();
    monitorStream.mockReset();
    diskList.mockResolvedValue([{ path: "/", used_gb: 50, size_gb: 200 }]);
    monitorStream.mockResolvedValue(stream([tick]));
  });

  it("renders cluster overview with aggregated CPU/GPU/memory/disk values", async () => {
    render(<AggregateStats />);

    expect(await screen.findByText("Cluster overview")).toBeInTheDocument();

    await waitFor(() => {
      // CPU avg (50%)
      expect(screen.getByText("50.0%")).toBeInTheDocument();
      // GPU avg (80%)
      expect(screen.getByText("80%")).toBeInTheDocument();
      // Memory used/total
      expect(screen.getByText("20 / 64 GB")).toBeInTheDocument();
      // Disk used/total
      expect(screen.getByText("50 / 200 GB")).toBeInTheDocument();
      // Power draw
      expect(screen.getByText("200.0 W")).toBeInTheDocument();
    });
  });

  it("shows host count and job count from the tick", async () => {
    render(<AggregateStats />);
    expect(await screen.findByText("Cluster overview")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("· 1 host · 3 jobs")).toBeInTheDocument();
    });
  });

  it("renders empty defaults when there is no tick yet", () => {
    monitorStream.mockResolvedValue(stream([]));
    diskList.mockResolvedValue([]);
    render(<AggregateStats />);
    // Zero states render with — for host count.
    expect(screen.getByText(/host/)).toBeInTheDocument();
  });
});
