import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSparkrunJson: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrunJson: mocks.runSparkrunJson,
}));

import { list, getDefault } from "./clusters";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };

const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

afterEach(() => vi.clearAllMocks());

describe("clusters.list", () => {
  it("transforms the raw cluster list", async () => {
    mocks.runSparkrunJson.mockResolvedValue([
      { name: "lab", hosts: ["h1", "h2"], description: "main", default: true },
      { name: "dev", hosts: [], default: false },
    ]);
    const r = (await handler(list)({})) as {
      name: string;
      hosts: string[];
      description: string;
      is_default: boolean;
    }[];
    expect(r).toEqual([
      { name: "lab", hosts: ["h1", "h2"], description: "main", is_default: true },
      { name: "dev", hosts: [], description: "", is_default: false },
    ]);
  });
});

describe("clusters.getDefault", () => {
  it("returns the default cluster", async () => {
    mocks.runSparkrunJson.mockResolvedValue({ name: "lab", hosts: ["h1"], default: true });
    const r = (await handler(getDefault)({})) as {
      name: string;
      hosts: string[];
      description: string;
      is_default: boolean;
    };
    expect(r).toEqual({ name: "lab", hosts: ["h1"], description: "", is_default: true });
  });

  it("returns null when sparkrun errors", async () => {
    mocks.runSparkrunJson.mockRejectedValue(new Error("no default"));
    const r = await handler(getDefault)({});
    expect(r).toBeNull();
  });
});
