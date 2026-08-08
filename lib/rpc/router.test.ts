import { describe, expect, it } from "vitest";
import { router, type AppRouter } from "./router";

describe("rpc router", () => {
  it("exposes every procedure group with callable handlers", () => {
    expect(router.status.get).toBeTypeOf("object");
    expect(router.status.stream).toBeTypeOf("object");
    expect(router.status.jobs).toBeTypeOf("object");
    expect(router.workloads.stop).toBeTypeOf("object");
    expect(router.workloads.health).toBeTypeOf("object");
    expect(router.recipes.list).toBeTypeOf("object");
    expect(router.recipes.listExtended).toBeTypeOf("object");
    expect(router.recipes.readYaml).toBeTypeOf("object");
    expect(router.recipes.validate).toBeTypeOf("object");
    expect(router.clusters.getDefault).toBeTypeOf("object");
    expect(router.run.start).toBeTypeOf("object");
    expect(router.run.startStream).toBeTypeOf("object");
    expect(router.benchmarks.watch).toBeTypeOf("object");
    expect(router.logs.stream).toBeTypeOf("object");
    expect(router.monitor.processes).toBeTypeOf("object");
    expect(router.chat.stream).toBeTypeOf("object");
    expect(router.update.stream).toBeTypeOf("object");
    expect(router.disk.list).toBeTypeOf("object");
  });

  it("exposes the procedure keys expected by the client", () => {
    const groups: (keyof AppRouter)[] = [
      "status",
      "workloads",
      "recipes",
      "clusters",
      "run",
      "benchmarks",
      "logs",
      "monitor",
      "chat",
      "update",
      "disk",
    ];
    for (const g of groups) {
      expect(router[g]).toBeDefined();
    }
  });
});
