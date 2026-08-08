// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BenchmarksList } from "./BenchmarksList";

const benchmarks = [
  {
    id: "b1",
    recipe: "official/qwen2.5",
    framework: "vllm",
    status: "completed" as const,
    startedAt: "2026-08-07T12:00:00Z",
    updatedAt: "2026-08-07T12:05:00Z",
    scheduleCount: 3,
    completedCount: 3,
    failedCount: 0,
  },
  {
    id: "b2",
    recipe: "community/llama",
    framework: "tg",
    status: "failed" as const,
    startedAt: "2026-08-06T10:00:00Z",
    updatedAt: null,
    scheduleCount: 1,
    completedCount: 0,
    failedCount: 1,
  },
];

describe("BenchmarksList", () => {
  it("renders the list title and visible benchmarks", () => {
    render(<BenchmarksList benchmarks={benchmarks} />);
    expect(screen.getByText("Benchmarks")).toBeInTheDocument();
    expect(screen.getByText("official/qwen2.5")).toBeInTheDocument();
    // failed benchmark hidden by default
    expect(screen.queryByText("community/llama")).not.toBeInTheDocument();
  });

  it("hides failed benchmarks by default and reveals them with the toggle", async () => {
    const user = userEvent.setup();
    render(<BenchmarksList benchmarks={benchmarks} />);
    expect(screen.queryByText("community/llama")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch"));
    expect(screen.getByText("community/llama")).toBeInTheDocument();
  });
});
