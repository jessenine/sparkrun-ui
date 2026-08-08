// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SparklineGraph } from "./SparklineGraph";

describe("SparklineGraph", () => {
  it("renders a title and Min/Max legend for a populated series", () => {
    render(<SparklineGraph title="GPU" data={[10, 20, 15, 30]} unit="%" />);
    expect(screen.getByText("GPU")).toBeInTheDocument();
    expect(screen.getByText("Min: 10.0% • Max: 30.0%")).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
  });

  it("renders an empty state when there is no data", () => {
    render(<SparklineGraph title="CPU" data={[]} />);
    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("hides the label when showLabel is false", () => {
    render(<SparklineGraph title="CPU" data={[]} showLabel={false} />);
    expect(screen.queryByText("CPU")).not.toBeInTheDocument();
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("does not render the trailing value for series of two points or fewer", () => {
    render(<SparklineGraph title="Mem" data={[5, 5]} unit="GB" />);
    expect(screen.queryByText("5.0GB")).not.toBeInTheDocument();
    expect(screen.getByText("Min: 5.0GB • Max: 5.0GB")).toBeInTheDocument();
  });

  it("renders a single point", () => {
    render(<SparklineGraph title="Power" data={[42]} unit="W" />);
    expect(screen.getByText("Min: 42.0W • Max: 42.0W")).toBeInTheDocument();
  });
});
