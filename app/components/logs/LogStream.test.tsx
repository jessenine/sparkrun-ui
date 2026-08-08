// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const logsStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { logs: { stream: (...a: unknown[]) => logsStream(...a) } },
}));

import { LogStream } from "./LogStream";

function stream(values: unknown[]): AsyncGenerator<unknown> {
  return (async function* () {
    for (const v of values) yield v;
  })();
}

// A generator that never completes, so the component stays in the "streaming"
// connected state (its finally block only runs once the loop finishes).
function infiniteStream(values: unknown[]): AsyncGenerator<unknown> {
  return (async function* () {
    for (const v of values) yield v;
    await new Promise(() => {});
  })();
}

describe("LogStream", () => {
  beforeEach(() => {
    logsStream.mockReset();
  });

  it("shows a waiting message initially", () => {
    logsStream.mockResolvedValue(stream([]));
    render(<LogStream clusterId="cluster-a" />);
    expect(screen.getByText("cluster-a")).toBeInTheDocument();
    expect(screen.getByText("Waiting for log output…")).toBeInTheDocument();
  });

  it("renders streamed log lines and marks itself streaming", async () => {
    logsStream.mockResolvedValue(
      infiniteStream([
        { line: "Loading model weights", ts: "", stream: "out" },
        { line: "ERROR: out of memory", ts: "", stream: "err" },
      ]),
    );
    render(<LogStream clusterId="cluster-a" />);
    await waitFor(() => {
      expect(screen.getByText("Loading model weights")).toBeInTheDocument();
      expect(screen.getByText("ERROR: out of memory")).toBeInTheDocument();
      expect(screen.getByText("streaming")).toBeInTheDocument();
    });
  });
});
