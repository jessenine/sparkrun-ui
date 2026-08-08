// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { update: { stream: (...a: unknown[]) => updateStream(...a) } },
}));

import { UpdateSparkrunButton } from "./UpdateSparkrunButton";

function stream(events: Record<string, unknown>[]): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

describe("UpdateSparkrunButton", () => {
  beforeEach(() => {
    updateStream.mockReset();
  });

  it("renders the Update button idle", () => {
    render(<UpdateSparkrunButton />);
    const btn = screen.getByRole("button", { name: "Update" });
    expect(btn).toBeEnabled();
  });

  it("streams update lines into the dialog after clicking", async () => {
    updateStream.mockResolvedValue(
      stream([
        { line: "Downloading sparkrun…", done: false },
        { line: "Installed v1.2.3", done: false },
      ]),
    );
    const user = userEvent.setup();
    render(<UpdateSparkrunButton />);
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      expect(screen.getByText("Sparkrun Update")).toBeInTheDocument();
      expect(screen.getByText("Downloading sparkrun…")).toBeInTheDocument();
      expect(screen.getByText("Installed v1.2.3")).toBeInTheDocument();
    });
  });

  it("enables Close after the stream completes", async () => {
    updateStream.mockResolvedValue(stream([{ line: "Done", done: false }, { done: true }]));
    const user = userEvent.setup();
    render(<UpdateSparkrunButton />);
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      expect(screen.getByText("Sparkrun Update")).toBeInTheDocument();
    });
    const dialog = await screen.findByText("Sparkrun Update");
    // close button eventually becomes enabled once done
    await waitFor(() => {
      expect(
        within(dialog.closest("[role=dialog]") as HTMLElement).getByRole("button", {
          name: "Close",
        }),
      ).toBeEnabled();
    });
  });
});
