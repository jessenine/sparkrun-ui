import { describe, expect, it } from "vitest";
import { parseMetricNdjson } from "./metrics-collector";

describe("parseMetricNdjson", () => {
  it("parses multiple JSON objects from NDJSON lines", () => {
    const text = [
      '{"timestamp":1,"hosts":[]}',
      '{"timestamp":2,"hosts":[]}',
    ].join("\n");
    const out = parseMetricNdjson(text);
    expect(out).toHaveLength(2);
    expect((out[0] as { timestamp: number }).timestamp).toBe(1);
    expect((out[1] as { timestamp: number }).timestamp).toBe(2);
  });

  it("skips blank lines and non-JSON lines", () => {
    const text = '\n{"timestamp":1}\nnot json\n\n{"timestamp":2}\n';
    const out = parseMetricNdjson(text);
    expect(out).toHaveLength(2);
  });

  it("returns an empty array for empty or whitespace-only text", () => {
    expect(parseMetricNdjson("")).toEqual([]);
    expect(parseMetricNdjson("  \n  ")).toEqual([]);
  });

  it("returns an empty array for malformed-only text", () => {
    expect(parseMetricNdjson("garbage\nmore")).toEqual([]);
  });

  it("handles trailing newline", () => {
    const out = parseMetricNdjson('{"a":1}\n');
    expect(out).toHaveLength(1);
  });
});
