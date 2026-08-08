import { describe, expect, it } from "vitest";
import { getSparkrunBin, targetArgs } from "./sparkrun";

// NOTE: lib/sparkrun.ts deliberately loads `node:child_process` via
// createRequire() so Turbopack's NFT trace can't see the spawn call. That
// obfuscation also defeats vi.mock() of `node:child_process` (createRequire
// resolves the real native builtin regardless), so the executor-level code
// paths here are not directly unit-testable without rewriting production
// code. They are covered indirectly by the procedures/*.test.ts suites, which
// mock the lib/sparkrun interface, and by E2E. Only the pure helpers are
// tested here.

describe("getSparkrunBin", () => {
  it("defaults to sparkrun and honors SPARKRUN_BIN", () => {
    const prev = process.env.SPARKRUN_BIN;
    delete process.env.SPARKRUN_BIN;
    expect(getSparkrunBin()).toBe("sparkrun");
    process.env.SPARKRUN_BIN = "/opt/sparkrun";
    expect(getSparkrunBin()).toBe("/opt/sparkrun");
    if (prev === undefined) delete process.env.SPARKRUN_BIN;
    else process.env.SPARKRUN_BIN = prev;
  });
});

describe("targetArgs", () => {
  it("returns empty array when no target", () => {
    expect(targetArgs(undefined)).toEqual([]);
    expect(targetArgs({})).toEqual([]);
  });

  it("prefers cluster when both provided", () => {
    expect(targetArgs({ cluster: "mylab", hosts: ["a", "b"] })).toEqual(["--cluster", "mylab"]);
  });

  it("emits --hosts with comma-joined list", () => {
    expect(targetArgs({ hosts: ["a", "b", "c"] })).toEqual(["--hosts", "a,b,c"]);
  });

  it("ignores empty hosts array", () => {
    expect(targetArgs({ hosts: [] })).toEqual([]);
  });
});
