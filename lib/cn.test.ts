import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", "b", null, false, undefined, 0, "c")).toBe("a b c");
  });

  it("supports nested arrays and objects", () => {
    expect(cn(["a", { b: true, c: false }], "d")).toBe("a b d");
  });

  it("tailwind-merges conflicting classes keeping the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("handles an empty argument list", () => {
    expect(cn()).toBe("");
  });
});
