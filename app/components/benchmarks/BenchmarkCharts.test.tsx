// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenchmarkCharts } from "./BenchmarkCharts";
import type { Consolidated } from "@/lib/state";

vi.mock("recharts", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Leaf = () => <div />;
  return {
    ResponsiveContainer: Box,
    LineChart: Box,
    CartesianGrid: Leaf,
    XAxis: Leaf,
    YAxis: Leaf,
    Tooltip: Leaf,
    Legend: Leaf,
    ErrorBar: Leaf,
    Line: Box,
  };
});

const row = {
  context_size: 2048,
  concurrency: 1,
  prompt_size: 100,
  response_size: 50,
  tg_throughput: { mean: 120, std: 5 },
  pp_throughput: { mean: 10.5, std: 0.2 },
  peak_throughput: { mean: 900, std: 3 },
  ttfr: { mean: 250.4, std: 0 },
  est_ppt: { mean: 5, std: 0 },
};

const consolidated: Consolidated = { benchmarks: [row] };

describe("BenchmarkCharts", () => {
  it("shows an empty message when there are no consolidated metrics", () => {
    render(<BenchmarkCharts consolidated={null} />);
    expect(screen.getByText("No consolidated metrics yet.")).toBeInTheDocument();
  });

  it("shows the empty message when the benchmark list is empty", () => {
    render(<BenchmarkCharts consolidated={{ benchmarks: [] }} />);
    expect(screen.getByText("No consolidated metrics yet.")).toBeInTheDocument();
  });

  it("renders chart cards and the summary table for consolidated rows", () => {
    render(<BenchmarkCharts consolidated={consolidated} />);
    expect(screen.getByText("Throughput (depth 2k)")).toBeInTheDocument();
    expect(screen.getByText("Latency (depth 2k)")).toBeInTheDocument();

    // Summary table values
    expect(screen.getByText("2k")).toBeInTheDocument();
    expect(screen.getByText("100/50")).toBeInTheDocument();
    expect(screen.getByText("120.0")).toBeInTheDocument();
    expect(screen.getByText("10.5")).toBeInTheDocument();
    expect(screen.getByText("900.0")).toBeInTheDocument();
    expect(screen.getByText("250.4")).toBeInTheDocument();
    expect(screen.getByText("5.00")).toBeInTheDocument();
  });

  it("formats a zero context size as 'No context' in card titles and cells", () => {
    const c: Consolidated = {
      benchmarks: [{ ...row, context_size: 0 }],
    };
    render(<BenchmarkCharts consolidated={c} />);
    expect(screen.getByText("Throughput (depth No context)")).toBeInTheDocument();
    expect(screen.getByText("No context")).toBeInTheDocument();
  });

  it("renders em-dashes for missing metric cells", () => {
    const missing = {
      context_size: 512,
      concurrency: 2,
      prompt_size: 10,
      response_size: 5,
      tg_throughput: undefined,
      pp_throughput: undefined,
      peak_throughput: undefined,
      ttfr: undefined,
      est_ppt: undefined,
    };
    render(<BenchmarkCharts consolidated={{ benchmarks: [missing] }} />);
    // Five metrics missing → five dash cells
    expect(screen.getAllByText("—").length).toBe(5);
  });
});
