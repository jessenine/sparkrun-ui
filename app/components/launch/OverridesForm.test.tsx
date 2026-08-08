// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverridesForm } from "./OverridesForm";

const yaml = [
  "defaults:",
  "  tensor_parallel: 4",
  "  port: 8000",
  "  enable_flash: true",
  "  model: qwen2.5",
].join("\n");

// Mirrors the real LaunchWizard parent: yaml is held in state and fed back in.
function StatefulWrapper({ initial }: { initial: string }) {
  const [y, setY] = useState(initial);
  return <OverridesForm yaml={y} onYamlChange={setY} />;
}

describe("OverridesForm", () => {
  it("renders no-defaults message when the recipe has none", () => {
    render(<OverridesForm yaml="model: qwen\n" onYamlChange={vi.fn()} />);
    // Message text is split by a <code> element, so target the wrapping <p>.
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" && el.textContent?.includes("This recipe has no defaults block"),
      ),
    ).toBeInTheDocument();
  });

  it("renders a field per default key", () => {
    render(<OverridesForm yaml={yaml} onYamlChange={vi.fn()} />);
    expect(screen.getByText("tensor_parallel")).toBeInTheDocument();
    expect(screen.getByText("port")).toBeInTheDocument();
    expect(screen.getByText("enable_flash")).toBeInTheDocument();
    expect(screen.getByText("model")).toBeInTheDocument();
  });

  it("updates the yaml through the controlled loop when editing a string field", async () => {
    const user = userEvent.setup();
    render(<StatefulWrapper initial={yaml} />);
    // Append to the existing value (clearing removes the whole defaults block).
    await user.type(screen.getByDisplayValue("qwen2.5"), "x");
    expect(await screen.findByDisplayValue("qwen2.5x")).toBeInTheDocument();
  });
});
