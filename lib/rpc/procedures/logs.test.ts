import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSparkrunJson: vi.fn(),
  streamSparkrunLines: vi.fn(),
}));

vi.mock("@/lib/sparkrun", () => ({
  runSparkrunJson: mocks.runSparkrunJson,
  streamSparkrunLines: mocks.streamSparkrunLines,
}));

import { stream } from "./logs";

type HandlerOpts = { input?: unknown; signal?: AbortSignal };
type LogEvent = { line: string; stream?: "out" | "err" | "meta" };

const handler = (proc: object): ((o: HandlerOpts) => unknown) =>
  (proc as { "~orpc": { handler: (o: HandlerOpts) => unknown } })["~orpc"].handler;

function lines(...ls: string[]): AsyncGenerator<string> {
  return (async function* () {
    for (const l of ls) yield l;
  })();
}

const status = (solo_entries: unknown[]) => ({
  host_count: solo_entries.length,
  groups: {},
  solo_entries,
  idle_hosts: [],
  pending_ops: [],
  errors: {},
  total_containers: solo_entries.length,
});

afterEach(() => vi.clearAllMocks());

describe("logs.stream", () => {
  it("emits a meta line when no host can be resolved", async () => {
    mocks.runSparkrunJson.mockResolvedValue(status([]));
    const gen = handler(stream)({ input: { clusterId: "c1" } }) as AsyncGenerator<LogEvent>;
    const out: LogEvent[] = [];
    for await (const ev of gen) out.push(ev);
    expect(out[0].line).toContain("Could not resolve hosts for c1");
    expect(out[0].stream).toBe("meta");
    expect(out).toHaveLength(1);
  });

  it("streams log lines from the resolved host", async () => {
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "127.0.0.1", meta: { port: 8000, hosts: ["h1", "h2"] } }]),
    );
    mocks.streamSparkrunLines.mockReturnValue(lines("first line", "second line"));
    const gen = handler(stream)({
      input: { clusterId: "c1", tail: 100 },
    }) as AsyncGenerator<LogEvent>;
    const out: LogEvent[] = [];
    for await (const ev of gen) out.push(ev);
    const metas = out.filter((e) => e.stream === "meta");
    const logs = out.filter((e) => e.stream === "out");
    expect(metas[0].line).toContain("h1, h2");
    expect(logs.map((e) => e.line)).toEqual(["first line", "second line"]);
  });

  it("emits a stream error event when streaming throws", async () => {
    mocks.runSparkrunJson.mockResolvedValue(
      status([{ cluster_id: "c1", host: "h", meta: { port: 8000 } }]),
    );
    mocks.streamSparkrunLines.mockImplementation(function* () {
      throw new Error("broken pipe");
    });
    const gen = handler(stream)({ input: { clusterId: "c1" } }) as AsyncGenerator<LogEvent>;
    const out: LogEvent[] = [];
    for await (const ev of gen) out.push(ev);
    const err = out.find((e) => e.stream === "err");
    expect(err?.line).toContain("broken pipe");
  });
});
