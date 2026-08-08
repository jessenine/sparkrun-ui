// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// HeaderStats subscribes to monitor.stream; an empty stream keeps it null.
vi.mock("@/lib/rpc/client", () => ({
  rpc: { monitor: { stream: vi.fn().mockResolvedValue((async function* () {})()) } },
}));

import { Shell } from "./Shell";

describe("Shell", () => {
  it("renders header nav, children, and footer", () => {
    render(
      <Shell>
        <div>Page body</div>
      </Shell>,
    );
    // Nav renders the Dashboard link.
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    // Children are rendered inside main.
    expect(screen.getByText("Page body")).toBeInTheDocument();
    // Footer present.
    expect(screen.getByText(/jix-sparkrun-ui/)).toBeInTheDocument();
  });
});
