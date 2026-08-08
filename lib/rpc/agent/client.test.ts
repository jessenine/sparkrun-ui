/**
 * Local Agent Client Tests
 *
 * Unit tests for the agent client module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  queryAgentProcesses,
  checkAgentHealth,
  getAgentMetrics,
  getProcessList,
  getAgentBaseUrl,
} from "./client";

// Mock fetch for testing
type FetchImpl = typeof global.fetch;

const mockFetch = (response: unknown, status: number = 200) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status === 200,
      status,
      json: () => Promise.resolve(response),
    }),
  ) as unknown as FetchImpl;
};

describe("Agent Client", () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.SPARKRUN_AGENT_URL;
  });

  afterEach(() => {
    // Restore global fetch
    if (global.fetch) {
      delete (global as { fetch?: FetchImpl }).fetch;
    }
  });

  describe("checkAgentHealth", () => {
    it("should return health data on success", async () => {
      const mockHealth = {
        status: "healthy",
        timestamp: 1691111111,
        agent_id: "test-agent-id",
        uptime_seconds: 3600,
      };

      mockFetch(mockHealth);

      const result = await checkAgentHealth();
      expect(result).toEqual(mockHealth);
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error")),
      ) as unknown as FetchImpl;

      const result = await checkAgentHealth();
      expect(result).toBeNull();
    });

    it("should return null on non-200 status", async () => {
      mockFetch({}, 500);

      const result = await checkAgentHealth();
      expect(result).toBeNull();
    });
  });

  describe("getAgentMetrics", () => {
    it("should return metrics data on success", async () => {
      const mockMetrics = {
        timestamp: 1691111111,
        uptime_seconds: 3600,
        process_count: 150,
        agent_id: "test-agent-id",
      };

      mockFetch(mockMetrics);

      const result = await getAgentMetrics();
      expect(result).toEqual(mockMetrics);
    });
  });

  describe("getProcessList", () => {
    it("should return process list on success", async () => {
      const mockProcesses = {
        timestamp: 1691111111,
        processes: [
          {
            user: "app",
            pid: 12345,
            cpu: 45.5,
            mem: 12.3,
            command: "python3 -m vllm",
          },
        ],
        agent_id: "test-agent-id",
        hostname: "localhost",
      };

      mockFetch(mockProcesses);

      const result = await getProcessList();
      expect(result).toEqual(mockProcesses);
    });

    it("should return null on error", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Connection refused")),
      ) as unknown as FetchImpl;

      const result = await getProcessList();
      expect(result).toBeNull();
    });
  });

  describe("queryAgentProcesses", () => {
    it("should return process entries on success", async () => {
      const mockResponse = {
        timestamp: 1691111111,
        processes: [
          {
            user: "app",
            pid: 12345,
            cpu: 45.5,
            mem: 12.3,
            command: "python3 -m vllm",
          },
        ],
        agent_id: "test-agent-id",
        hostname: "localhost",
      };

      mockFetch(mockResponse);

      const result = await queryAgentProcesses(undefined, 5);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        user: "app",
        pid: 12345,
        cpu: 45.5,
        mem: 12.3,
        command: "python3 -m vllm",
      });
    });

    it("should return empty array on error", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Timeout"))) as unknown as FetchImpl;

      const result = await queryAgentProcesses(undefined, 5);
      expect(result).toEqual([]);
    });

    it("should handle empty process list", async () => {
      mockFetch({
        timestamp: 1691111111,
        processes: [],
        agent_id: "test-agent-id",
        hostname: "localhost",
      });

      const result = await queryAgentProcesses(undefined, 5);
      expect(result).toEqual([]);
    });
  });

  describe("getAgentBaseUrl", () => {
    it("should use default URL when env is not set", () => {
      delete process.env.SPARKRUN_AGENT_URL;
      const baseUrl = getAgentBaseUrl();
      expect(baseUrl).toBe("http://127.0.0.1:8081");
    });

    it("should use environment variable when set", () => {
      process.env.SPARKRUN_AGENT_URL = "http://localhost:9999";
      const baseUrl = getAgentBaseUrl();
      expect(baseUrl).toBe("http://localhost:9999");
    });
  });
});
