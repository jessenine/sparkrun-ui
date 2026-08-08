import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSparkrun: vi.fn(),
  runSparkrunJson: vi.fn(),
  writeDraft: vi.fn(),
  probePortsParallel: vi.fn(),
  resolveTargetHosts: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrun: mocks.runSparkrun,
  runSparkrunJson: mocks.runSparkrunJson,
}));

vi.mock("@/lib/draft", () => ({
  writeDraft: mocks.writeDraft,
}));

vi.mock("@/lib/portCheck", () => ({
  probePortsParallel: mocks.probePortsParallel,
}));

vi.mock("./helpers", () => ({
  resolveTargetHosts: mocks.resolveTargetHosts,
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
}));

import { list, listWithCategory, readYaml, show, info, validate, dryRun } from "./recipes";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

const recipe = (extra: Record<string, unknown> = {}) => ({
  name: "@mcampa/qwen",
  file: "/recipes/qwen.yaml",
  path: "/recipes/qwen.yaml",
  model: "qwen",
  runtime: "vllm",
  min_nodes: 1,
  registry: "official",
  description: "a model",
  ...extra,
});

afterEach(() => vi.clearAllMocks());

describe("recipes.list", () => {
  it("requests --all by default and returns the list", async () => {
    mocks.runSparkrunJson.mockResolvedValue([recipe()]);
    const r = (await handler(list)({ input: undefined })) as unknown[];
    expect(r).toHaveLength(1);
    expect(mocks.runSparkrunJson.mock.calls[0][0]).toEqual(["list", "--json", "--all"]);
  });

  it("omits --all when all:false", async () => {
    mocks.runSparkrunJson.mockResolvedValue([]);
    await handler(list)({ input: { all: false } });
    expect(mocks.runSparkrunJson.mock.calls[0][0]).toEqual(["list", "--json"]);
  });
});

describe("recipes.listWithCategory", () => {
  it("infers model categories", async () => {
    mocks.runSparkrunJson.mockResolvedValue([
      recipe({ name: "a", model: "codellama" }),
      recipe({ name: "b", model: "stable diffusion" }),
      recipe({ name: "c", model: "o1 reasoning" }),
      recipe({ name: "d", model: "vl-3" }),
      recipe({ name: "e", model: "plain" }),
    ]);
    const r = (await handler(listWithCategory)({ input: undefined })) as {
      name: string;
      category: string;
    }[];
    const by = Object.fromEntries(r.map((x) => [x.name, x.category]));
    expect(by).toEqual({ a: "coding", b: "diffusion", c: "reasoning", d: "vision", e: "general" });
  });
});

describe("recipes.readYaml", () => {
  it("returns the yaml file for a found recipe", async () => {
    mocks.runSparkrunJson.mockResolvedValue([recipe({ name: "r1", path: "/r1.yaml" })]);
    mocks.readFile.mockResolvedValue("model: qwen\n");
    const out = (await handler(readYaml)({ input: { name: "r1" } })) as {
      yaml: string;
      path: string;
      recipe: string;
    };
    expect(out).toEqual({ yaml: "model: qwen\n", path: "/r1.yaml", recipe: "r1" });
  });

  it("throws NOT_FOUND when the recipe is absent", async () => {
    mocks.runSparkrunJson.mockResolvedValue([]);
    await expect(handler(readYaml)({ input: { name: "ghost" } })).rejects.toThrow(/not found/);
  });
});

describe("recipes.show", () => {
  it("returns stdout on success", async () => {
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "model: x", stderr: "" });
    const out = (await handler(show)({ input: { name: "r1" } })) as { text: string };
    expect(out.text).toBe("model: x");
  });

  it("throws on sparkrun failure", async () => {
    mocks.runSparkrun.mockResolvedValue({ code: 1, stdout: "", stderr: "boom" });
    await expect(handler(show)({ input: { name: "r1" } })).rejects.toThrow(/show failed/);
  });
});

describe("recipes.info", () => {
  it("returns vram on success", async () => {
    mocks.runSparkrunJson.mockResolvedValue([recipe()]);
    mocks.runSparkrun.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({
        recipe: "r1",
        model: "qwen",
        runtime: "vllm",
        model_weights_gb: 25,
      }),
      stderr: "",
    });
    const out = (await handler(info)({ input: { name: "r1" } })) as {
      vram: { model_weights_gb: number } | null;
      vramError: string | null;
    };
    expect(out.vram?.model_weights_gb).toBe(25);
    expect(out.vramError).toBeNull();
  });

  it("returns vramError when sparkrun fails", async () => {
    mocks.runSparkrunJson.mockResolvedValue([recipe()]);
    mocks.runSparkrun.mockResolvedValue({ code: 1, stdout: "", stderr: "nope" });
    const out = (await handler(info)({ input: { name: "r1" } })) as {
      vram: unknown;
      vramError: string | null;
    };
    expect(out.vram).toBeNull();
    expect(out.vramError).toContain("nope");
  });
});

describe("recipes.validate", () => {
  it("reports valid when there are no issues", async () => {
    mocks.writeDraft.mockResolvedValue("/d.yml");
    mocks.runSparkrun.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ valid: true, issues: [] }),
      stderr: "",
    });
    mocks.resolveTargetHosts.mockResolvedValue([]);
    const out = (await handler(validate)({ input: { yaml: "model: qwen", draftId: "d1" } })) as {
      valid: boolean;
      issues: unknown[];
    };
    expect(out.valid).toBe(true);
    expect(out.issues).toEqual([]);
  });

  it("collects string and object issues from an invalid result", async () => {
    mocks.writeDraft.mockResolvedValue("/d.yml");
    mocks.runSparkrun.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({
        valid: false,
        issues: ["missing model", { severity: "warning", message: "low mem", path: "runtime" }],
      }),
      stderr: "",
    });
    mocks.resolveTargetHosts.mockResolvedValue([]);
    const out = (await handler(validate)({ input: { yaml: "model: qwen", draftId: "d1" } })) as {
      valid: boolean;
      issues: { severity: string; message: string; field?: string }[];
    };
    expect(out.valid).toBe(false);
    expect(out.issues[0]).toMatchObject({ severity: "error", message: "missing model" });
    expect(out.issues[1]).toMatchObject({
      severity: "warning",
      message: "low mem",
      field: "runtime",
    });
  });

  it("flags a port already used by a running sparkrun workload", async () => {
    mocks.writeDraft.mockResolvedValue("/d.yml");
    mocks.runSparkrun.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ valid: true, issues: [] }),
      stderr: "",
    });
    mocks.resolveTargetHosts.mockResolvedValue(["127.0.0.1"]);
    mocks.runSparkrunJson.mockResolvedValue({
      solo_entries: [{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 8000, recipe: "r1" } }],
    });
    mocks.probePortsParallel.mockResolvedValue([]);
    const out = (await handler(validate)({
      input: { yaml: "defaults:\n  port: 8000\n", draftId: "d1" },
    })) as { valid: boolean; issues: { message: string }[] };
    expect(out.valid).toBe(false);
    expect(out.issues.some((i) => i.message.includes("already used"))).toBe(true);
  });
});

describe("recipes.dryRun", () => {
  it("returns ok true on success", async () => {
    mocks.writeDraft.mockResolvedValue("/d.yml");
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "plan", stderr: "" });
    const out = (await handler(dryRun)({
      input: { yaml: "model: qwen", draftId: "d1", cluster: "lab" },
    })) as { ok: boolean; stdout: string };
    expect(out.ok).toBe(true);
    expect(out.stdout).toBe("plan");
    expect(mocks.runSparkrun.mock.calls[0][0]).toContain("--cluster");
  });

  it("returns ok false on failure", async () => {
    mocks.writeDraft.mockResolvedValue("/d.yml");
    mocks.runSparkrun.mockResolvedValue({ code: 3, stdout: "", stderr: "err" });
    const out = (await handler(dryRun)({
      input: { yaml: "model: qwen", draftId: "d1" },
    })) as { ok: boolean; stderr: string };
    expect(out.ok).toBe(false);
    expect(out.stderr).toBe("err");
  });
});
