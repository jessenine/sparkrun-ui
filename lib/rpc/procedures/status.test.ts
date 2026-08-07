import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ClusterStatusSchema } from "@/lib/schemas";
import { mapStatusToJobs } from "./status";

const FIX = join(__dirname, "../../__fixtures__");

describe("status RPC logic (SC-P0-34)", () => {
  it("maps solo_entries to jobs with recipe, host, port, status", async () => {
    const raw = JSON.parse(await readFile(join(FIX, "cluster-status.json"), "utf8"));
    const status = ClusterStatusSchema.parse(raw);
    const jobs = mapStatusToJobs(status);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      cluster_id: "sparkrun_b64549a754f0",
      recipe: "/tmp/sparkrun-ui-drafts/d_x40tmp7hmpu62p61.yaml",
      host: "127.0.0.1",
      port: 8000,
      status: "Up 12 minutes",
    });
  });

  it("maps groups record entries to jobs", () => {
    const status = ClusterStatusSchema.parse({
      host_count: 1,
      groups: {
        sparkrun_grp01: {
          cluster_id: "sparkrun_grp01",
          meta: { recipe: "/recipes/g1.yaml", port: 9000 },
          hosts: ["192.168.1.10"],
          containers: [{ status: "Up 5 minutes" }],
        },
      },
      solo_entries: [],
      idle_hosts: [],
      pending_ops: [],
      errors: {},
      total_containers: 1,
    });
    const jobs = mapStatusToJobs(status);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      cluster_id: "sparkrun_grp01",
      recipe: "/recipes/g1.yaml",
      host: "192.168.1.10",
      port: 9000,
      status: "Up 5 minutes",
    });
  });

  it("filters out jobs with no cluster_id", () => {
    const status = ClusterStatusSchema.parse({
      host_count: 0,
      groups: {},
      solo_entries: [],
      idle_hosts: [],
      pending_ops: [],
      errors: {},
      total_containers: 0,
    });
    expect(mapStatusToJobs(status)).toEqual([]);
  });
});
