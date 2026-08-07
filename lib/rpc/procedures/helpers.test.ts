import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/sparkrun", () => ({ runSparkrunJson: vi.fn() }));

import { runSparkrunJson } from "@/lib/sparkrun";
import { resolveTargetHosts } from "./helpers";

describe("resolveTargetHosts", () => {
  beforeEach(() => {
    vi.mocked(runSparkrunJson).mockReset();
  });

  it("returns explicit hosts when provided", async () => {
    await expect(resolveTargetHosts(["192.168.1.10"], undefined)).resolves.toEqual([
      "192.168.1.10",
    ]);
    expect(runSparkrunJson).not.toHaveBeenCalled();
  });

  it("resolves cluster hosts by name via cluster list", async () => {
    vi.mocked(runSparkrunJson).mockResolvedValue([
      { name: "dgx1", hosts: ["192.168.1.10", "192.168.1.11"], default: false },
      { name: "dgx2", hosts: ["192.168.1.22"], default: false },
    ] as any);

    await expect(resolveTargetHosts(undefined, "dgx2")).resolves.toEqual(["192.168.1.22"]);
    expect(runSparkrunJson).toHaveBeenCalledWith(["cluster", "list", "--json"]);
  });

  it("throws when named cluster not found", async () => {
    vi.mocked(runSparkrunJson).mockResolvedValue([{ name: "dgx1", hosts: [] }] as any);
    await expect(resolveTargetHosts(undefined, "missing")).rejects.toThrow(
      "Cluster missing not found",
    );
  });

  it("falls back to default cluster hosts", async () => {
    vi.mocked(runSparkrunJson).mockResolvedValue({
      name: "dgx1",
      hosts: ["192.168.1.10"],
      default: true,
    } as any);

    await expect(resolveTargetHosts(undefined, undefined)).resolves.toEqual(["192.168.1.10"]);
    expect(runSparkrunJson).toHaveBeenCalledWith(["cluster", "default", "--json"]);
  });
});
