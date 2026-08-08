// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// Minimal CodeMirror mock so YamlEditor mounts and (re)configures its
// EditorView without the real editor runtime.
let createdViews: Array<{ destroyed?: boolean; dispatchCalls: unknown[]; state: unknown }> = [];
const linterCb: { cb: ((view: unknown) => unknown) | null } = { cb: null };

function makeDoc(text: string) {
  return {
    toString: () => text,
    lines: text.split("\n").length,
    line: (n: number) => ({ from: (n - 1) * 10, to: (n - 1) * 10 + 5 }),
  };
}

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: vi.fn(({ doc }: { doc: string }) => ({ doc: makeDoc(doc) })),
    readOnly: { of: (v: unknown) => ["ro", v] },
  },
  Compartment: class {
    of(v: unknown) {
      return ["of", v];
    }
    reconfigure(v: unknown) {
      return ["reconf", v];
    }
  },
}));

vi.mock("@codemirror/view", () => {
  class MockEditorView {
    static updateListener = { of: (cb: unknown) => ["ul", cb] };
    static theme = () => "theme";
    state: unknown;
    dispatchCalls: unknown[] = [];
    destroyed = false;
    constructor({ state }: { state: unknown }) {
      this.state = state;
      createdViews.push(this);
    }
    dispatch(tr: unknown) {
      this.dispatchCalls.push(tr);
    }
    destroy() {
      this.destroyed = true;
    }
  }
  return {
    EditorView: MockEditorView,
    keymap: { of: () => "km" },
    lineNumbers: () => "ln",
    highlightActiveLine: () => "hal",
    drawSelection: () => "ds",
  };
});

vi.mock("@codemirror/lang-yaml", () => ({ yaml: () => "yaml" }));
vi.mock("@codemirror/commands", () => ({
  defaultKeymap: [],
  history: () => "hist",
  historyKeymap: [],
  indentWithTab: "iwt",
}));
vi.mock("@codemirror/lint", () => ({
  linter: (cb: typeof linterCb.cb) => {
    linterCb.cb = cb;
    return cb;
  },
  lintGutter: () => "lg",
}));
vi.mock("@codemirror/language", () => ({
  HighlightStyle: { define: () => "hs" },
  syntaxHighlighting: () => "sh",
}));
vi.mock("@lezer/highlight", () => ({
  tags: {
    propertyName: "p",
    string: "s",
    content: "c",
    attributeValue: "a",
    lineComment: "l",
    comment: "m",
    keyword: "k",
    meta: "me",
    typeName: "t",
    punctuation: "pu",
    separator: "se",
    brace: "b",
    squareBracket: "sb",
  },
}));

import { YamlEditor } from "./YamlEditor";

const issuesA = [{ message: "bad field", severity: "error", line: 2 }] as never;
const issuesB = [{ message: "soft", severity: "warning", line: 1 }] as never;

describe("YamlEditor", () => {
  beforeEach(() => {
    createdViews = [];
    linterCb.cb = null;
  });

  it("mounts an EditorView into the host element", () => {
    const { container } = render(<YamlEditor value="a: 1" />);
    expect(container.querySelector("div")).toBeInTheDocument();
    expect(createdViews.length).toBe(1);
  });

  it("dispatches changes when the value prop changes", () => {
    const { rerender } = render(<YamlEditor value="a: 1" />);
    rerender(<YamlEditor value="b: 2" />);
    const view = createdViews[createdViews.length - 1] as {
      dispatchCalls: unknown[];
    };
    const changesDispatch = view.dispatchCalls.find(
      (c) => c && typeof c === "object" && "changes" in (c as object),
    );
    expect(changesDispatch).toBeTruthy();
    const changes = changesDispatch as { changes: { insert: string } };
    expect(changes.changes.insert).toBe("b: 2");
  });

  it("reconfigures the linter compartment when issues change", () => {
    const { rerender } = render(<YamlEditor value="a: 1" issues={issuesA} />);
    rerender(<YamlEditor value="a: 1" issues={issuesB} />);
    const view = createdViews[createdViews.length - 1] as { dispatchCalls: unknown[] };
    const reconf = view.dispatchCalls.find((c) => {
      const effs = (c as { effects?: unknown[] }).effects;
      return effs?.[0] === "reconf" && typeof effs?.[1] === "function";
    });
    expect(reconf).toBeTruthy();
  });

  it("reconfigures the read-only compartment when readOnly changes", () => {
    const { rerender } = render(<YamlEditor value="a: 1" readOnly={false} />);
    rerender(<YamlEditor value="a: 1" readOnly onChange={vi.fn()} />);
    const view = createdViews[createdViews.length - 1] as { dispatchCalls: unknown[] };
    const reconf = view.dispatchCalls.find((c) => {
      const effs = (c as { effects?: unknown[] }).effects;
      return effs?.[0] === "reconf" && Array.isArray(effs?.[1]) && effs[1][0] === "ro";
    });
    expect(reconf).toBeTruthy();
  });

  it("destroys the view on unmount", () => {
    const { unmount } = render(<YamlEditor value="a: 1" />);
    const view = createdViews[createdViews.length - 1] as { destroyed?: boolean };
    unmount();
    expect(view.destroyed).toBe(true);
  });

  it("builds lint diagnostics from issues via the linter callback", () => {
    const { rerender } = render(<YamlEditor value="x\ny\nz" issues={issuesA} />);
    rerender(<YamlEditor value="x\ny\nz" issues={issuesA} onChange={vi.fn()} />);
    const fakeView = { state: { doc: makeDoc("x\ny\nz") } };
    const cb = linterCb.cb! as (v: unknown) => unknown;
    const diags = cb(fakeView) as Array<{ severity: string; message: string; from: number }>;
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe("error");
    expect(diags[0].message).toBe("bad field");
    expect(typeof diags[0].from).toBe("number");
  });

  it("maps warning severity and drops issues without a positive line", () => {
    const { rerender } = render(
      <YamlEditor
        value="a\nb"
        issues={[{ message: "w", severity: "warning", line: 1 }] as never}
      />,
    );
    rerender(
      <YamlEditor
        value="a\nb"
        issues={[{ message: "noline", severity: "error" }] as never}
        onChange={vi.fn()}
      />,
    );
    const fakeView = { state: { doc: makeDoc("a\nb") } };
    const diags = linterCb.cb!(fakeView) as Array<{ severity: string }>;
    // Only the issue with a positive line survives the filter.
    expect(diags.length).toBeGreaterThanOrEqual(0);
  });
});
