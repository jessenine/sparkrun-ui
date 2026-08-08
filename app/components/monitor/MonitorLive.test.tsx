// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const monitorStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { monitor: { stream: (...a: unknown[]) => monitorStream(...a) } },
}));

import { MonitorLive } from "./MonitorLive";

function stream(values: unknown[]): AsyncGenerator<unknown> {
  return (async function* () {
    for (const v of values) yield v;
  })();
}

const tick = {
  timestamp: Date.now(),
  hosts: {
    "192.168.1.22": {
      hostname: "node-01",
      cpu_usage_pct: "55",
      gpu_util_pct: "70",
      mem_used_pct: "45",
      gpu_power_w: "150",
    },
  },
};

describe("MonitorLive", () => {
  beforeEach(() => {
    monitorStream.mockReset();
  });

  it("shows a waiting state before the first sample", () => {
    monitorStream.mockResolvedValue(stream([]));
    render(<MonitorLive />);
    expect(screen.getByText("Waiting for first monitor sample…")).toBeInTheDocument();
  });

  it("renders host cards once a monitor tick arrives", async () => {
    monitorStream.mockResolvedValue(stream([tick]));
    render(<MonitorLive />);
    await waitFor(() => {
      expect(screen.getByText("192.168.1.22")).toBeInTheDocument();
      expect(screen.getByText("1 host")).toBeInTheDocument();
      // 55% cpu meter
      expect(screen.getByText("55%")).toBeInTheDocument();
    });
  });
});
