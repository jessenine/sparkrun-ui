// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeBlock } from "./CodeBlock";
import { Field, Input } from "./Field";
import { LocalTime } from "./LocalTime";
import { Switch } from "./Switch";
import { Tabs } from "./Tabs";
import { NumberField } from "./NumberField";

describe("ui/CodeBlock", () => {
  it("renders children inside a pre element", () => {
    const { container } = render(<CodeBlock>{"some {yaml}"}</CodeBlock>);
    expect(container.querySelector("pre")).toHaveTextContent("some {yaml}");
  });
});

describe("ui/Field", () => {
  it("renders a label and help text", () => {
    render(
      <Field label="GPU" help="How many GPUs">
        <Input />
      </Field>,
    );
    expect(screen.getByText("GPU")).toBeInTheDocument();
    expect(screen.getByText("How many GPUs")).toBeInTheDocument();
  });

  it("shows an error and hides help when error is present", () => {
    render(
      <Field label="GPU" help="How many GPUs" error="Invalid">
        <Input />
      </Field>,
    );
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.queryByText("How many GPUs")).not.toBeInTheDocument();
  });

  it("renders an input with the custom class", () => {
    render(<Input className="custom" placeholder="Search" />);
    const input = screen.getByPlaceholderText("Search");
    expect(input).toHaveClass("custom");
  });
});

describe("ui/LocalTime", () => {
  it("renders an em dash when no ISO timestamp is provided", () => {
    render(<LocalTime iso={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a localized timestamp for a valid ISO string", () => {
    render(<LocalTime iso="2026-08-07T12:00:00Z" />);
    // useIsClient() returns true in jsdom, so the localized render path runs.
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});

describe("ui/Switch", () => {
  it("renders a switch and reflects checked state", async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} />);
    const sw = screen.getByRole("switch");
    expect(sw).toBeDefined();
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalled();
  });
});

describe("ui/Tabs", () => {
  it("renders tabs and panels", () => {
    render(
      <Tabs value="a" onValueChange={() => {}}>
        <Tabs.List>
          <Tabs.Tab value="a">Overview</Tabs.Tab>
          <Tabs.Tab value="b">Logs</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">Overview panel</Tabs.Panel>
        <Tabs.Panel value="b">Logs panel</Tabs.Panel>
      </Tabs>,
    );
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });
});

describe("ui/NumberField", () => {
  it("renders increment and decrement buttons", () => {
    render(<NumberField value={1} onValueChange={() => {}} min={0} max={10} />);
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("−")).toBeInTheDocument();
  });
});
