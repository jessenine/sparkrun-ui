// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HostCard } from "./HostCard";

const metrics = {
  hostname: "node-01",
  gpu_name: "RTX 5090",
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
} as const;

describe("HostCard", () => {
  it("renders host identity and GPU name", () => {
    render(
      <HostCard
        host="192.168.1.22"
        metrics={metrics}
        history={{ cpu: [], gpu: [], mem: [], power: [] }}
      />,
    );
    expect(screen.getByText("192.168.1.22")).toBeInTheDocument();
    expect(screen.getByText(/node-01 · RTX 5090/)).toBeInTheDocument();
  });

  it("renders CPU/GPU/Memory meters with computed percentages", () => {
    render(
      <HostCard host="h" metrics={metrics} history={{ cpu: [], gpu: [], mem: [], power: [] }} />,
    );
    // CPU meter (50%) and GPU memory meter (4096/8192 = 50%) both show 50%
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("80%")).toBeInTheDocument(); // GPU
    // Memory used 20480/65536 = 31.25 -> 31%
    expect(screen.getByText("31%")).toBeInTheDocument();
    expect(screen.getByText("20.0/64 GB")).toBeInTheDocument();
  });

  it("renders GPU memory meter and power/jobs badges", () => {
    render(
      <HostCard host="h" metrics={metrics} history={{ cpu: [], gpu: [], mem: [], power: [] }} />,
    );
    expect(screen.getByText("GPU memory")).toBeInTheDocument();
    expect(screen.getByText("200.0 W")).toBeInTheDocument();
    expect(screen.getByText("3 jobs")).toBeInTheDocument();
  });

  it("handles missing metrics gracefully", () => {
    render(
      <HostCard
        host="h"
        metrics={{ hostname: "node" }}
        history={{ cpu: [], gpu: [], mem: [], power: [] }}
      />,
    );
    expect(screen.getByText("h")).toBeInTheDocument();
    // CPU and GPU meters both fall back to 0%
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("GPU memory")).not.toBeInTheDocument();
  });
});
