import { describe, expect, it } from "vitest";
import { parseDfOutput } from "./disk";

const HEADER = "target size used avail pcent";

describe("parseDfOutput", () => {
  it("parses df lines into GB-rounded disk entries", () => {
    const stdout = [HEADER, "/ 107374182400 53687091200 32212254720 50%"].join("\n");
    const out = parseDfOutput(stdout);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      mount: "/",
      size_gb: 100,
      used_gb: 50,
      available_gb: 30,
      use_pct: 50,
      path: "/",
    });
  });

  it("filters out none, snap, and boot mounts", () => {
    const stdout = [
      HEADER,
      "/ 107374182400 0 107374182400 0%",
      "none 107374182400 0 107374182400 0%",
      "/snap/x 107374182400 0 107374182400 0%",
      "/boot 107374182400 0 107374182400 0%",
    ].join("\n");
    const out = parseDfOutput(stdout);
    expect(out).toHaveLength(1);
    expect(out[0].mount).toBe("/");
  });

  it("skips malformed lines and lines with too few fields", () => {
    const stdout = [
      HEADER,
      "/ 107374182400", // too few fields
      "bad line here",
    ].join("\n");
    expect(parseDfOutput(stdout)).toEqual([]);
  });

  it("returns empty array when only the header is present", () => {
    expect(parseDfOutput(HEADER)).toEqual([]);
  });

  it("returns empty array for empty output", () => {
    expect(parseDfOutput("")).toEqual([]);
  });
});
