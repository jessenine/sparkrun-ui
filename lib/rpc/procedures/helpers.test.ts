import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/sparkrun", () => ({ runSparkrunJson: vi.fn() }));

import { runSparkrunJson } from "@/lib/sparkrun";
import { resolveTargetHosts } from "./helpers";

interface ClusterEntry {
  name: string;
  hosts: string[];
  default: boolean;
}

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
    const clusterList: ClusterEntry[] = [
      { name: "dgx1", hosts: ["192.168.1.10", "192.168.1.11"], default: false },
      { name: "dgx2", hosts: ["192.168.1.22"], default: false },
    ];
    vi.mocked(runSparkrunJson).mockResolvedValue(clusterList as never);

    await expect(resolveTargetHosts(undefined, "dgx2")).resolves.toEqual(["192.168.1.22"]);
    expect(runSparkrunJson).toHaveBeenCalledWith(["cluster", "list", "--json"]);
  });

  it("throws when named cluster not found", async () => {
    const clusterList: ClusterEntry[] = [{ name: "dgx1", hosts: [], default: false }];
    vi.mocked(runSparkrunJson).mockResolvedValue(clusterList as never);
    await expect(resolveTargetHosts(undefined, "missing")).rejects.toThrow(
      "Cluster missing not found",
    );
  });

  it("falls back to default cluster hosts", async () => {
    const cluster: ClusterEntry = { name: "dgx1", hosts: ["192.168.1.10"], default: true };
    vi.mocked(runSparkrunJson).mockResolvedValue(cluster as never);

    await expect(resolveTargetHosts(undefined, undefined)).resolves.toEqual(["192.168.1.10"]);
    expect(runSparkrunJson).toHaveBeenCalledWith(["cluster", "default", "--json"]);
  });
});
