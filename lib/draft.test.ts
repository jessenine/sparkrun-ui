import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  chmod: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  tmpdir: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  chmod: mocks.chmod,
  writeFile: mocks.writeFile,
  readFile: mocks.readFile,
  unlink: mocks.unlink,
  readdir: mocks.readdir,
  stat: mocks.stat,
}));

vi.mock("node:os", () => ({
  tmpdir: () => "/tmp",
}));

import { writeDraft, writeDraftMeta, readDraftMeta, deleteDraft } from "./draft";

beforeEach(() => {
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.chmod.mockResolvedValue(undefined);
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.readdir.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

describe("writeDraft", () => {
  it("creates the dir, reaps stale files, and writes the yaml", async () => {
    const p = writeDraft("abc123", "model: qwen");
    await expect(p).resolves.toMatch(/drafts\/abc123\.yaml$/);
    expect(mocks.mkdir).toHaveBeenCalled();
    expect(mocks.chmod).toHaveBeenCalledWith("/tmp/sparkrun-ui-drafts", 0o777);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/abc123\.yaml$/),
      "model: qwen",
      "utf8",
    );
  });

  it("deletes stale files during reap", async () => {
    mocks.readdir.mockResolvedValue(["old.yaml"]);
    mocks.stat.mockResolvedValue({ mtimeMs: Date.now() - 61 * 60 * 1000 });
    await writeDraft("x", "y");
    expect(mocks.unlink).toHaveBeenCalledWith(expect.stringMatching(/old\.yaml$/));
  });

  it("keeps fresh files", async () => {
    mocks.readdir.mockResolvedValue(["fresh.yaml"]);
    mocks.stat.mockResolvedValue({ mtimeMs: Date.now() });
    await writeDraft("x", "y");
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it("throws on an invalid draftId", async () => {
    await expect(writeDraft("bad id!", "y")).rejects.toThrow(/Invalid draftId/);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});

describe("writeDraftMeta / readDraftMeta", () => {
  it("writes and reads metadata", async () => {
    mocks.writeFile.mockResolvedValue(undefined);
    await writeDraftMeta("d1", { recipeName: "r" });
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/d1\.meta\.json$/),
      JSON.stringify({ recipeName: "r" }),
      "utf8",
    );

    mocks.readFile.mockResolvedValue(JSON.stringify({ recipeName: "r" }));
    await expect(readDraftMeta("d1")).resolves.toEqual({ recipeName: "r" });
  });

  it("returns null when metadata is missing", async () => {
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    await expect(readDraftMeta("d1")).resolves.toBeNull();
  });
});

describe("deleteDraft", () => {
  it("unlinks the yaml", async () => {
    mocks.unlink.mockResolvedValue(undefined);
    await deleteDraft("d1");
    expect(mocks.unlink).toHaveBeenCalledWith(expect.stringMatching(/d1\.yaml$/));
  });

  it("ignores unlink errors", async () => {
    mocks.unlink.mockRejectedValue(new Error("ENOENT"));
    await expect(deleteDraft("d1")).resolves.toBeUndefined();
  });
});
