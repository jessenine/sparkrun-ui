import { describe, expect, it, vi } from "vitest";
import { buildRunArgs, start, startStream } from "./run";

const mocks = vi.hoisted(() => ({
  writeDraft: vi.fn(),
  writeDraftMeta: vi.fn(),
  runSparkrun: vi.fn(),
  streamSparkrunLines: vi.fn(),
}));

vi.mock("@/lib/draft", () => ({
  writeDraft: mocks.writeDraft,
  writeDraftMeta: mocks.writeDraftMeta,
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrun: mocks.runSparkrun,
  streamSparkrunLines: mocks.streamSparkrunLines,
}));

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
type RunEvent = { line?: string; done?: boolean; ok?: boolean; error?: string; draftPath?: string };

const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

function genLines(...ls: string[]): AsyncGenerator<string> {
  return (async function* () {
    for (const l of ls) yield l;
  })();
}

const INPUT = { yaml: "model: qwen", draftId: "d1", cluster: "lab" };

describe("run RPC logic (SC-P0-47)", () => {
  it("builds base args with path", () => {
    expect(buildRunArgs("/tmp/d.yaml", {})).toEqual(["run", "/tmp/d.yaml", "--no-follow"]);
  });

  it("adds --cluster when provided", () => {
    expect(buildRunArgs("/tmp/d.yaml", { cluster: "dgx1" })).toEqual([
      "run",
      "/tmp/d.yaml",
      "--no-follow",
      "--cluster",
      "dgx1",
    ]);
  });

  it("adds --hosts when cluster absent but hosts provided", () => {
    expect(buildRunArgs("/tmp/d.yaml", { hosts: ["192.168.1.10", "192.168.1.11"] })).toEqual([
      "run",
      "/tmp/d.yaml",
      "--no-follow",
      "--hosts",
      "192.168.1.10,192.168.1.11",
    ]);
  });

  it("adds --tp when provided", () => {
    expect(buildRunArgs("/tmp/d.yaml", { tp: 2 })).toEqual([
      "run",
      "/tmp/d.yaml",
      "--no-follow",
      "--tp",
      "2",
    ]);
  });

  it("prefers cluster over hosts", () => {
    expect(buildRunArgs("/tmp/d.yaml", { cluster: "dgx1", hosts: ["192.168.1.10"] })).toEqual([
      "run",
      "/tmp/d.yaml",
      "--no-follow",
      "--cluster",
      "dgx1",
    ]);
  });
});

describe("run.start", () => {
  it("writes the draft, validates, and launches", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/drafts/d1.yaml");
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const r = (await handler(start)({ input: INPUT })) as { ok: boolean; draftPath: string };
    expect(r).toEqual({ ok: true, draftPath: "/tmp/drafts/d1.yaml" });
    expect(mocks.writeDraft).toHaveBeenCalledWith("d1", "model: qwen");
  });

  it("writes draft metadata when a recipeName is supplied", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/d_1.yaml");
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await handler(start)({ input: { ...INPUT, recipeName: "official/qwen" } });
    expect(mocks.writeDraftMeta).toHaveBeenCalledWith("d1", { recipeName: "official/qwen" });
  });

  it("throws BAD_REQUEST when recipe validation fails", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/d_1.yaml");
    mocks.runSparkrun.mockResolvedValue({ code: 1, stdout: "", stderr: "bad schema" });
    await expect(handler(start)({ input: INPUT })).rejects.toThrow(/Recipe failed validation/);
  });

  it("throws INTERNAL_SERVER_ERROR when the run fails", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/d_1.yaml");
    mocks.runSparkrun
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" }) // validate
      .mockResolvedValueOnce({ code: 2, stdout: "", stderr: "oom" }); // run
    await expect(handler(start)({ input: INPUT })).rejects.toThrow(/sparkrun run failed/);
  });
});

describe("run.startStream", () => {
  it("streams draft/validation/run lines and finishes", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/d_1.yaml");
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mocks.streamSparkrunLines.mockReturnValue(genLines("pulling image", "started"));
    const gen = handler(startStream)({ input: INPUT }) as AsyncGenerator<RunEvent>;
    const out: RunEvent[] = [];
    for await (const ev of gen) out.push(ev);
    expect(out[0].line).toContain("Writing draft");
    expect(out[1].line).toContain("Validating recipe");
    expect(out.some((e) => e.line?.includes("Running: sparkrun run"))).toBe(true);
    expect(out[out.length - 1]).toEqual({ line: "", done: true });
  });

  it("yields a failed done event when validation fails", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/d_1.yaml");
    mocks.runSparkrun.mockResolvedValue({ code: 1, stdout: "", stderr: "bad" });
    const gen = handler(startStream)({ input: INPUT }) as AsyncGenerator<RunEvent>;
    const out: RunEvent[] = [];
    for await (const ev of gen) out.push(ev);
    const last = out[out.length - 1];
    expect(last.done).toBe(true);
    expect(last.ok).toBe(false);
    expect(last.error).toContain("bad");
  });

  it("yields an error done event when streaming throws", async () => {
    mocks.writeDraft.mockResolvedValue("/tmp/d_1.yaml");
    mocks.runSparkrun.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mocks.streamSparkrunLines.mockImplementation(function* () {
      throw new Error("connection refused");
    });
    const gen = handler(startStream)({ input: INPUT }) as AsyncGenerator<RunEvent>;
    const out: RunEvent[] = [];
    for await (const ev of gen) out.push(ev);
    expect(out[out.length - 1]).toMatchObject({
      done: true,
      ok: false,
      error: "connection refused",
    });
  });
});
