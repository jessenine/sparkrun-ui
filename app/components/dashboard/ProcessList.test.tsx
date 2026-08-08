// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProcessList, type ProcessEntry } from "./ProcessList";

const processes: ProcessEntry[] = [
  { user: "root", pid: 100, cpu: 5.2, mem: 1.1, command: "systemd" },
  { user: "jix", pid: 200, cpu: 42.7, mem: 8.4, command: "python train.py" },
  { user: "jix", pid: 300, cpu: 10.0, mem: 20.5, command: "vllm serve" },
];

describe("ProcessList", () => {
  it("renders the default title and sorts processes by CPU descending", () => {
    render(<ProcessList processes={processes} />);

    expect(screen.getByText("Top Processes")).toBeInTheDocument();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1); // skip header
    const commands = rows.map((r) => within(r).getByText(/python|vllm|systemd/).textContent);

    expect(commands).toEqual(["python train.py", "vllm serve", "systemd"]);
  });

  it("sorts by memory descending when the MEM sort button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProcessList processes={processes} />);

    await user.click(screen.getByRole("button", { name: "MEM" }));

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    const commands = rows.map((r) => within(r).getByText(/python|vllm|systemd/).textContent);

    expect(commands).toEqual(["vllm serve", "python train.py", "systemd"]);
  });

  it("renders at most five processes", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      user: "u",
      pid: i,
      cpu: i,
      mem: i,
      command: `proc-${i}`,
    }));
    render(<ProcessList processes={many} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row").length).toBe(6); // 5 rows + header
  });

  it("shows an empty message when there are no processes", () => {
    render(<ProcessList processes={[]} />);
    expect(screen.getByText("No process data available")).toBeInTheDocument();
  });

  it("shows a loading indicator while loading", () => {
    render(<ProcessList processes={processes} loading />);
    expect(screen.getByText("Loading process data...")).toBeInTheDocument();
  });

  it("opens the detail dialog and calls onProcessClick when a row is clicked", async () => {
    const onProcessClick = vi.fn();
    const user = userEvent.setup();
    render(<ProcessList processes={processes} onProcessClick={onProcessClick} />);

    await user.click(screen.getByText("python train.py"));

    expect(screen.getByText(/Process: python train\.py/)).toBeInTheDocument();
    expect(screen.getByText(/PID: 200/)).toBeInTheDocument();
    expect(onProcessClick).toHaveBeenCalledWith(processes[1]);
  });

  it("closes the detail dialog", async () => {
    const user = userEvent.setup();
    render(<ProcessList processes={processes} />);

    await user.click(screen.getByText("systemd"));
    expect(screen.getByText(/Process: systemd/)).toBeInTheDocument();

    // Close the dialog via its (unlabeled) close button inside the popup.
    const closeButton = within(screen.getByRole("dialog")).getByRole("button");
    await user.click(closeButton);
    expect(screen.queryByText(/Process: systemd/)).not.toBeInTheDocument();
  });
});
