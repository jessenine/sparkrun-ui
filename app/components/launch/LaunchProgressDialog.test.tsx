// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const startStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { run: { startStream: (...a: unknown[]) => startStream(...a) } },
}));

import { LaunchProgressDialog } from "./LaunchProgressDialog";

function stream(events: Record<string, unknown>[]): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

describe("LaunchProgressDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    yaml: "model: qwen",
    draftId: "d1",
    cluster: "lab",
    recipeName: "official/qwen2.5",
  };

  beforeEach(() => {
    startStream.mockReset();
  });

  it("streams launch output and offers View logs on success", async () => {
    startStream.mockResolvedValue(
      stream([
        { line: "Pulling image…", done: false },
        { line: "Container started", done: false },
        { done: true, ok: true },
      ]),
    );
    render(<LaunchProgressDialog {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Pulling image…")).toBeInTheDocument();
      expect(screen.getByText("Container started")).toBeInTheDocument();
      expect(screen.getByText("Done. Moving to logs…")).toBeInTheDocument();
    });
  });

  it("surfaces a failure from the stream", async () => {
    startStream.mockResolvedValue(stream([{ done: true, ok: false, error: "image not found" }]));
    render(<LaunchProgressDialog {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed: image not found/)).toBeInTheDocument();
    });
  });

  it("calls onSuccess when closing after a successful run", async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    startStream.mockResolvedValue(stream([{ done: true, ok: true }]));
    const user = userEvent.setup();
    render(
      <LaunchProgressDialog {...baseProps} onSuccess={onSuccess} onOpenChange={onOpenChange} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Done. Moving to logs…")).toBeInTheDocument();
    });
    const doneLabel = screen.getByText("Done. Moving to logs…");
    const dialog = doneLabel.closest("[role=dialog]") as HTMLElement;
    await user.click(within(dialog).getByRole("button", { name: "View logs" }));
    // Closing with done && !error triggers onSuccess
    expect(onSuccess).toHaveBeenCalled();
  });
});
