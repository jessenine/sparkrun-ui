import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock streamSparkrunNdjson before importing the module
vi.mock("@/lib/sparkrun", () => ({
  streamSparkrunNdjson: vi.fn(),
}));

import { streamSparkrunNdjson } from "@/lib/sparkrun";
import { normalizeMonitorOutput } from "./monitor";

describe("monitor RPC procedures (SC-P0-32, SC-P0-33)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeMonitorOutput (unit tests)", () => {
    it("converts array format to record format (SC-P0-32)", () => {
      const raw = {
        timestamp: 1234567890,
        hosts: [
          { host: "host1", sample: { cpu_usage_pct: "50", gpu_util_pct: "80" } },
          { host: "host2", sample: { cpu_usage_pct: "30", gpu_util_pct: "60" } },
        ],
      };
      const result = normalizeMonitorOutput(raw);
      expect(result.timestamp).toBe(1234567890);
      expect(result.hosts["host1"].cpu_usage_pct).toBe("50");
      expect(result.hosts["host2"].gpu_util_pct).toBe("60");
    });

    it("handles null/undefined hosts gracefully", () => {
      const result = normalizeMonitorOutput({});
      expect(result.hosts).toBeDefined();
      expect(typeof result.timestamp).toBe("number");
    });
  });
});
