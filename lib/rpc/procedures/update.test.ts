import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamSparkrunLines: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  streamSparkrunLines: mocks.streamSparkrunLines,
}));

import { stream } from "./update";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
type UpdateEvent = { line: string; done?: boolean };

const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

function lines(...ls: string[]): AsyncGenerator<string> {
  return (async function* () {
    for (const l of ls) yield l;
  })();
}

afterEach(() => vi.clearAllMocks());

describe("update.stream", () => {
  it("streams update lines then emits a done event", async () => {
    mocks.streamSparkrunLines.mockReturnValue(lines("Fetching…", "Installing…"));
    const gen = handler(stream)({ input: undefined }) as AsyncGenerator<UpdateEvent>;
    const out: UpdateEvent[] = [];
    for await (const ev of gen) out.push(ev);
    expect(out.slice(0, 2)).toEqual([{ line: "Fetching…" }, { line: "Installing…" }]);
    expect(out[out.length - 1]).toEqual({ line: "", done: true });
  });

  it("emits an error line then done when streaming throws", async () => {
    mocks.streamSparkrunLines.mockImplementation(function* () {
      throw new Error("network down");
    });
    const gen = handler(stream)({ input: undefined }) as AsyncGenerator<UpdateEvent>;
    const out: UpdateEvent[] = [];
    for await (const ev of gen) out.push(ev);
    expect(out[0].line).toContain("Error: network down");
    expect(out[out.length - 1].done).toBe(true);
  });

  it("respects an aborted signal", async () => {
    mocks.streamSparkrunLines.mockReturnValue(lines("a", "b"));
    const ac = new AbortController();
    ac.abort();
    const gen = handler(stream)({
      input: undefined,
      signal: ac.signal,
    }) as AsyncGenerator<UpdateEvent>;
    const out: UpdateEvent[] = [];
    for await (const ev of gen) out.push(ev);
    // Aborted before first yield -> only the trailing done event is emitted.
    expect(out).toEqual([{ line: "", done: true }]);
  });
});
