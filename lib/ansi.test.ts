import { describe, expect, it } from "vitest";
import { parseAnsi } from "./ansi";

describe("parseAnsi", () => {
  it("returns a single plain segment with no codes", () => {
    expect(parseAnsi("hello world")).toEqual([{ text: "hello world" }]);
  });

  it("splits segments colored by an SGR code", () => {
    const segments = parseAnsi("\x1b[31mred\x1b[0mplain");
    expect(segments).toEqual([{ text: "red", fg: "1" }, { text: "plain" }]);
  });

  it("applies bold, dim, italic, underline", () => {
    const segments = parseAnsi("\x1b[1mbold\x1b[2mdim\x1b[3mital\x1b[4mline\x1b[0m");
    expect(segments[0]).toEqual({ text: "bold", bold: true });
    expect(segments[1]).toEqual({ text: "dim", bold: true, dim: true });
    expect(segments[2]).toEqual({ text: "ital", bold: true, dim: true, italic: true });
    expect(segments[3]).toEqual({
      text: "line",
      bold: true,
      dim: true,
      italic: true,
      underline: true,
    });
  });

  it("maps bright foreground codes (90-97)", () => {
    expect(parseAnsi("\x1b[95mgone")[0]).toEqual({ text: "gone", fg: "b5" });
  });

  it("maps background codes (40-47, 100-107)", () => {
    expect(parseAnsi("\x1b[44mhi")[0]).toEqual({ text: "hi", bg: "4" });
    expect(parseAnsi("\x1b[103mhi")[0]).toEqual({ text: "hi", bg: "b3" });
  });

  it("clears fg on 39 and bg on 49", () => {
    const segments = parseAnsi("\x1b[31ma\x1b[39mb\x1b[44mc\x1b[49md");
    expect(segments[0]).toEqual({ text: "a", fg: "1" });
    expect(segments[1]).toEqual({ text: "b" });
    expect(segments[2]).toEqual({ text: "c", bg: "4" });
    expect(segments[3]).toEqual({ text: "d" });
  });

  it("consumes 256-color and truecolor tails without applying", () => {
    expect(parseAnsi("\x1b[38;5;123mhi")[0]).toEqual({ text: "hi" });
    expect(parseAnsi("\x1b[38;2;10;20;30mhi")[0]).toEqual({ text: "hi" });
    expect(parseAnsi("\x1b[48;2;1;2;3mhi")[0]).toEqual({ text: "hi" });
  });

  it("ignores unknown codes", () => {
    expect(parseAnsi("\x1b[77mhi")[0]).toEqual({ text: "hi" });
  });

  it("renders remainder verbatim when the sequence is malformed (no m)", () => {
    expect(parseAnsi("a\x1b[31b")).toEqual([{ text: "a" }, { text: "\x1b[31b" }]);
  });

  it("clears bold/dim together on 22, italic on 23, underline on 24", () => {
    const segments = parseAnsi("\x1b[1;2;3;4myo\x1b[22;23;24mnext");
    expect(segments[0]).toEqual({
      text: "yo",
      bold: true,
      dim: true,
      italic: true,
      underline: true,
    });
    expect(segments[1]).toEqual({ text: "next" });
  });
});
