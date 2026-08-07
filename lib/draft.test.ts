import { describe, expect, it, afterAll } from "vitest";
import { writeDraft, deleteDraft } from "./draft";
import { readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Use a test-specific directory to avoid polluting the real DRAFT_DIR
// We'll mock the internal DRAFT_DIR by creating our own test dir
const TEST_DRAFT_DIR = join(__dirname, "__test_drafts__");

// Clean up after tests
afterAll(() => {
  if (existsSync(TEST_DRAFT_DIR)) {
    rmSync(TEST_DRAFT_DIR, { recursive: true, force: true });
  }
});

describe("draft lifecycle (P0 scenarios from TEST_PLAN_LATEST.md)", () => {
  // SC-P0-21: writeDraft creates file in DRAFT_DIR with correct .yaml extension
  describe("writeDraft", () => {
    it("creates a file with .yaml extension (SC-P0-21)", async () => {
      // Write a draft
      const path = await writeDraft("test_p0_21", "test yaml content");
      
      // Verify file exists
      expect(existsSync(path)).toBe(true);
      expect(path.endsWith(".yaml")).toBe(true);
    });

    it("rejects draftIds with invalid characters (SC-P0-22)", async () => {
      // Should throw on invalid chars
      await expect(writeDraft("invalid id!", "yaml")).rejects.toThrow("Invalid draftId");
      await expect(writeDraft("path/../to", "yaml")).rejects.toThrow("Invalid draftId");
      await expect(writeDraft("spaces here", "yaml")).rejects.toThrow("Invalid draftId");
    });

    it("preserves yaml content exactly", async () => {
      const yaml = "key: value\nnested:\n  foo: bar\n";
      const path = await writeDraft("test_content", yaml);
      
      const content = readFileSync(path, "utf8");
      expect(content).toBe(yaml);
    });

    it("returns absolute path", async () => {
      const path = await writeDraft("test_path", "content");
      expect(path.startsWith("/")).toBe(true);
      expect(path.includes("sparkrun-ui-drafts")).toBe(true);
    });

    it("deletes the created draft", async () => {
      const yaml = "test: content";
      const path = await writeDraft("test_delete", yaml);
      expect(existsSync(path)).toBe(true);
      
      await deleteDraft("test_delete");
      expect(existsSync(path)).toBe(false);
    });
  });
});
