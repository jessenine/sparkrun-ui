import { describe, expect, it } from "vitest";
import { buildRunArgs } from "./run";

describe("run RPC logic (SC-P0-47)", () => {
  it("builds base args with path", () => {
    expect(buildRunArgs("/tmp/d.yaml", {})).toEqual(["run", "/tmp/d.yaml", "--no-follow"]);
  });

  it("adds --cluster when provided", () => {
    expect(buildRunArgs("/tmp/d.yaml", { cluster: "dgx1" })).toEqual([
      "run", "/tmp/d.yaml", "--no-follow", "--cluster", "dgx1",
    ]);
  });

  it("adds --hosts when cluster absent but hosts provided", () => {
    expect(buildRunArgs("/tmp/d.yaml", { hosts: ["192.168.1.10", "192.168.1.11"] })).toEqual([
      "run", "/tmp/d.yaml", "--no-follow", "--hosts", "192.168.1.10,192.168.1.11",
    ]);
  });

  it("adds --tp when provided", () => {
    expect(buildRunArgs("/tmp/d.yaml", { tp: 2 })).toEqual([
      "run", "/tmp/d.yaml", "--no-follow", "--tp", "2",
    ]);
  });

  it("prefers cluster over hosts", () => {
    expect(buildRunArgs("/tmp/d.yaml", { cluster: "dgx1", hosts: ["192.168.1.10"] })).toEqual([
      "run", "/tmp/d.yaml", "--no-follow", "--cluster", "dgx1",
    ]);
  });
});
