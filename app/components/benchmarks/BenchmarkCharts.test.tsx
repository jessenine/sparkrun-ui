// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenchmarkCharts } from "./BenchmarkCharts";
import type { Consolidated, ConsolidatedMetric, ConsolidatedRow } from "@/lib/state";

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

const m = (mean: number, std: number): ConsolidatedMetric => ({ mean, std, values: [mean] });

const row: ConsolidatedRow = {
  context_size: 2048,
  concurrency: 1,
  prompt_size: 100,
  response_size: 50,
  tg_throughput: m(120, 5),
  pp_throughput: m(10.5, 0.2),
  peak_throughput: m(900, 3),
  ttfr: m(250.4, 0),
  est_ppt: m(5, 0),
};

const consolidated: Consolidated = {
  model: "qwen",
  max_concurrency: 4,
  benchmarks: [row],
};

describe("BenchmarkCharts", () => {
  it("shows an empty message when there are no consolidated metrics", () => {
    render(<BenchmarkCharts consolidated={null} />);
    expect(screen.getByText("No consolidated metrics yet.")).toBeInTheDocument();
  });

  it("shows the empty message when the benchmark list is empty", () => {
    render(<BenchmarkCharts consolidated={{ model: "", max_concurrency: 0, benchmarks: [] }} />);
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
      model: "qwen",
      max_concurrency: 4,
      benchmarks: [{ ...row, context_size: 0 }],
    };
    render(<BenchmarkCharts consolidated={c} />);
    expect(screen.getByText("Throughput (depth No context)")).toBeInTheDocument();
    expect(screen.getByText("No context")).toBeInTheDocument();
  });

  it("renders em-dashes for missing metric cells", () => {
    const missing: ConsolidatedRow = {
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
    render(
      <BenchmarkCharts
        consolidated={{ model: "qwen", max_concurrency: 4, benchmarks: [missing] }}
      />,
    );
    // Five metrics missing → five dash cells
    expect(screen.getAllByText("—").length).toBe(5);
  });
});
