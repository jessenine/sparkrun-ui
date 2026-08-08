import { afterEach, describe, expect, it, vi } from "vitest";
import type * as MetricsModule from "./metrics-collector";

const mocks = vi.hoisted(() => ({
  runSparkrunJson: vi.fn(),
  runSparkrunText: vi.fn(),
}));

vi.mock("./sparkrun", () => ({
  runSparkrunJson: mocks.runSparkrunJson,
  runSparkrunText: mocks.runSparkrunText,
}));

import { parseMetricNdjson } from "./metrics-collector";

async function freshLoad(): Promise<typeof MetricsModule> {
  vi.resetModules();
  const m = await import("./metrics-collector");
  return m as typeof MetricsModule;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("parseMetricNdjson", () => {
  it("parses multiple JSON objects from NDJSON lines", () => {
    const text = ['{"timestamp":1,"hosts":[]}', '{"timestamp":2,"hosts":[]}'].join("\n");
    const out = parseMetricNdjson(text);
    expect(out).toHaveLength(2);
    expect((out[0] as { timestamp: number }).timestamp).toBe(1);
  });

  it("skips blank lines and non-JSON lines", () => {
    const out = parseMetricNdjson('\n{"timestamp":1}\nnot json\n\n{"timestamp":2}\n');
    expect(out).toHaveLength(2);
  });

  it("returns empty for empty/malformed text", () => {
    expect(parseMetricNdjson("")).toEqual([]);
    expect(parseMetricNdjson("garbage")).toEqual([]);
  });
});

describe("collectMetrics / cache getters", () => {
  it("collects monitor, processes, and status on success", async () => {
    const mod = await freshLoad();
    const monitorLine = JSON.stringify({
      timestamp: 1,
      hosts: [
        {
          host: "h1",
          error: null,
          sample: { hostname: "h1" },
          workloads: [],
          used_slots: 0,
          free_slots: 1,
        },
      ],
    });
    mocks.runSparkrunText.mockResolvedValue({ code: 0, stdout: monitorLine + "\n", stderr: "" });
    mocks.runSparkrunJson
      .mockResolvedValueOnce([
        { id: "p1", name: "python", host: "h1", cpu: 1, memory: 100, status: "running" },
      ])
      .mockResolvedValueOnce({ host_count: 1 });
    await mod.collectMetrics();
    expect(mod.getMonitorMetrics()?.[0].timestamp).toBe(1);
    expect(mod.getProcesses()?.[0].id).toBe("p1");
    expect(mod.getClusterStatus()?.host_count).toBe(1);
  });

  it("keeps monitor cache empty when sparkrun monitor throws", async () => {
    const mod = await freshLoad();
    mocks.runSparkrunText.mockRejectedValue(new Error("boom"));
    mocks.runSparkrunJson.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await mod.collectMetrics();
    expect(mod.getMonitorMetrics()).toBeNull();
  });

  it("falls back to the previous processes/status cache on collect errors", async () => {
    const mod = await freshLoad();
    const monitorLine = JSON.stringify({ timestamp: 1, hosts: [] });
    mocks.runSparkrunText.mockResolvedValue({ code: 0, stdout: monitorLine, stderr: "" });
    mocks.runSparkrunJson
      .mockResolvedValueOnce([
        { id: "p1", name: "x", host: "h", cpu: 1, memory: 1, status: "ready" },
      ])
      .mockResolvedValueOnce({ host_count: 2 });
    await mod.collectMetrics();

    mocks.runSparkrunJson
      .mockRejectedValueOnce(new Error("ERR"))
      .mockRejectedValueOnce(new Error("ERR"));
    mocks.runSparkrunText.mockRejectedValue(new Error("ERR"));
    await mod.collectMetrics();
    expect(mod.getProcesses()?.[0].id).toBe("p1");
    expect(mod.getClusterStatus()?.host_count).toBe(2);
  });

  it("expires cache entries after their TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const mod = await freshLoad();
    mocks.runSparkrunText.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mocks.runSparkrunJson.mockResolvedValueOnce([]).mockResolvedValueOnce({ host_count: 1 });
    await mod.collectMetrics();
    expect(mod.getClusterStatus()?.host_count).toBe(1);

    vi.setSystemTime(1000 + 5001); // > 5000ms status TTL
    expect(mod.getClusterStatus()).toBeNull();
  });
});

describe("startMetricsCollection / stopMetricsCollection", () => {
  it("starts an interval and stops it", async () => {
    vi.useFakeTimers();
    const mod = await freshLoad();
    mocks.runSparkrunText.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mocks.runSparkrunJson.mockResolvedValue([]);
    const spy = vi.spyOn(globalThis, "setInterval");
    const clear = vi.spyOn(globalThis, "clearInterval");

    mod.startMetricsCollection();
    expect(spy).toHaveBeenCalled();

    mod.startMetricsCollection(); // warns, does not add a second loop
    expect(spy).toHaveBeenCalledTimes(1);

    mod.stopMetricsCollection();
    expect(clear).toHaveBeenCalled();
  });
});
