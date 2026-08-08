// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const monitorStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    monitor: { stream: (...args: unknown[]) => monitorStream(...args) },
  },
}));

import { HeaderStats } from "./HeaderStats";

function stream(values: unknown[]): AsyncGenerator<unknown> {
  return (async function* () {
    for (const v of values) yield v;
  })();
}

const tick = {
  timestamp: Date.now(),
  hosts: {
    node1: { gpu_util_pct: "75", gpu_temp_c: "68" },
    node2: { gpu_util_pct: "85", gpu_temp_c: "72" },
  },
};

describe("HeaderStats", () => {
  beforeEach(() => {
    monitorStream.mockReset();
  });

  it("renders nothing before any data arrives", () => {
    monitorStream.mockResolvedValue(stream([]));
    const { container } = render(<HeaderStats />);
    expect(container.innerHTML).toBe("");
  });

  it("renders GPU utilization and temperature once a tick arrives", async () => {
    monitorStream.mockResolvedValue(stream([tick]));
    render(<HeaderStats />);
    // avg of 75/85 = 80%, avg temp of 68/72 = 70
    await waitFor(() => {
      expect(screen.getByText("80%")).toBeInTheDocument();
      expect(screen.getByText("70°C")).toBeInTheDocument();
    });
  });

  it("renders GPU % without temperature when temp is zero", async () => {
    monitorStream.mockResolvedValue(
      stream([
        { timestamp: Date.now(), hosts: { node1: { gpu_util_pct: "50", gpu_temp_c: "0" } } },
      ]),
    );
    render(<HeaderStats />);
    await waitFor(() => {
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(screen.queryByText("0°C")).not.toBeInTheDocument();
    });
  });
});
