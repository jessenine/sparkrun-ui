import { describe, expect, it } from "vitest";
import { normalizeMonitorOutput } from "./monitor";

describe("normalizeMonitorOutput", () => {
  it("handles array format with valid sample data", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [
        {
          host: "127.0.0.1",
          error: null,
          sample: {
            hostname: "gx10",
            cpu_usage_pct: "45.5",
            gpu_util_pct: "80.2",
            mem_used_mb: "90790",
            mem_total_mb: "124546",
            gpu_temp_c: "48",
            gpu_power_w: "11.27",
          },
        },
      ],
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.timestamp).toBe(1780256101.68883);
    expect(result.hosts["127.0.0.1"].cpu_usage_pct).toBe("45.5");
    expect(result.hosts["127.0.0.1"].gpu_util_pct).toBe("80.2");
  });

  it("handles array format with null sample (preserves host with empty data)", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [
        {
          host: "192.168.1.22",
          error: null,
          sample: null,
        },
      ],
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.timestamp).toBe(1780256101.68883);
    expect(result.hosts["192.168.1.22"]).toEqual({});
  });

  it("handles array format with mixed null and valid samples", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [
        {
          host: "192.168.1.22",
          error: null,
          sample: null,
        },
        {
          host: "127.0.0.1",
          error: null,
          sample: {
            cpu_usage_pct: "45.5",
            gpu_util_pct: "80.2",
          },
        },
      ],
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.timestamp).toBe(1780256101.68883);
    expect(result.hosts["192.168.1.22"]).toEqual({});
    expect(result.hosts["127.0.0.1"].cpu_usage_pct).toBe("45.5");
    expect(result.hosts["127.0.0.1"].gpu_util_pct).toBe("80.2");
  });

  it("handles flat record format (current UI expectation)", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: {
        "127.0.0.1": {
          cpu_usage_pct: "45.5",
          gpu_util_pct: "80.2",
        },
      },
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.timestamp).toBe(1780256101.68883);
    expect(result.hosts["127.0.0.1"].cpu_usage_pct).toBe("45.5");
  });

  it("handles undefined timestamp as 0", () => {
    const raw = {
      hosts: [],
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.timestamp).toBe(0);
  });

  it("handles missing hosts array", () => {
    const raw = {
      timestamp: 1780256101.68883,
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.timestamp).toBe(1780256101.68883);
    expect(Object.keys(result.hosts)).toHaveLength(0);
  });

  it("handles undefined sample", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [
        {
          host: "127.0.0.1",
          error: null,
          sample: undefined,
        },
      ],
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.hosts["127.0.0.1"]).toEqual({});
  });

  it("handles invalid host entry", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [null, undefined, "invalid"],
    };
    const result = normalizeMonitorOutput(raw);
    expect(Object.keys(result.hosts)).toHaveLength(0);
  });

  it("preserves processes array from sample data", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [
        {
          host: "127.0.0.1",
          error: null,
          sample: {
            processes: [
              { user: "root", pid: 1, cpu: 0.0, mem: 0.1, command: "/sbin/init" },
              { user: "jix", pid: 1234, cpu: 45.5, mem: 2.3, command: "python3 -m flask run" },
            ],
          },
        },
      ],
    };
    const result = normalizeMonitorOutput(raw);
    expect(result.hosts["127.0.0.1"].processes).toBeDefined();
    expect(Array.isArray(result.hosts["127.0.0.1"].processes)).toBe(true);
    const procs = result.hosts["127.0.0.1"].processes as Array<{ user: string; pid: number }>;
    expect(procs).toHaveLength(2);
    expect(procs[0].user).toBe("root");
  });

  it("parses processes string into array", () => {
    const raw = {
      timestamp: 1780256101.68883,
      hosts: [
        {
          host: "127.0.0.1",
          error: null,
          sample: {
            processes: JSON.stringify([
              { user: "jix", pid: 1234, cpu: 45.5, mem: 2.3, command: "python3 -m flask run" },
            ]),
          },
        },
      ],
    };
    const result = normalizeMonitorOutput(raw);
    const procs = result.hosts["127.0.0.1"].processes as Array<{ user: string; pid: number }>;
    expect(procs).toHaveLength(1);
    expect(procs[0].pid).toBe(1234);
  });
});
