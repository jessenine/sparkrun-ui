// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const workloadsHealth = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { workloads: { health: (...a: unknown[]) => workloadsHealth(...a) } },
}));

import { useWorkloadHealth } from "./useWorkloadHealth";

describe("useWorkloadHealth", () => {
  beforeEach(() => {
    workloadsHealth.mockReset();
  });

  it("returns a loading state before the first health probe resolves", () => {
    workloadsHealth.mockResolvedValue({ ready: true, state: "ready" });
    const { result } = renderHook(() => useWorkloadHealth("cluster-a"));
    expect(result.current.ready).toBe(false);
    expect(result.current.state).toBe("loading");
  });

  it("returns the polled health once it resolves", async () => {
    workloadsHealth.mockResolvedValue({ ready: true, state: "ready" });
    const { result } = renderHook(() => useWorkloadHealth("cluster-a"));
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.state).toBe("ready");
  });

  it("stays in loading when the cluster id is missing", () => {
    workloadsHealth.mockResolvedValue({ ready: true, state: "ready" });
    const { result } = renderHook(() => useWorkloadHealth(null));
    expect(result.current.state).toBe("loading");
    act(() => {});
    expect(workloadsHealth).not.toHaveBeenCalled();
  });
});
