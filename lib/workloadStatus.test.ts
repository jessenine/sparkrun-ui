import { describe, expect, it } from "vitest";
import { parseWorkloadUptime } from "./workloadStatus";

describe("parseWorkloadUptime", () => {
  it.each([
    ["Up 12 minutes", "12 minutes"],
    ["Up About a minute", "About a minute"],
    ["Up 3 hours", "3 hours"],
    ["Up 5 days", "5 days"],
    ["Up 2 weeks", "2 weeks"],
    ["Up 3 hours (healthy)", "3 hours"],
    ["Up 10 minutes (health: starting)", "10 minutes"],
  ])("extracts uptime from %j", (status, expected) => {
    expect(parseWorkloadUptime(status)).toBe(expected);
  });

  it.each([
    ["Exited (0) 4 seconds ago"],
    ["Created"],
    ["Restarting (1) 2 seconds ago"],
    [""],
    [undefined],
  ])("returns null for non-running status %j", (status) => {
    expect(parseWorkloadUptime(status)).toBeNull();
  });

  it("returns null for a malformed Up string", () => {
    expect(parseWorkloadUptime("Up")).toBeNull();
  });
});
