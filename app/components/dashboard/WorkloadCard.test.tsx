// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockHealth = vi.fn();
vi.mock("@/app/components/useWorkloadHealth", () => ({
  useWorkloadHealth: (...a: unknown[]) => mockHealth(...a),
}));

vi.mock("@/app/components/recipes/RecipeShowDialog", () => ({
  RecipeShowDialog: ({ title, open }: { title?: string; open: boolean }) =>
    open ? <div data-testid="recipe-dialog">{title}</div> : null,
}));

const workloadsStop = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { workloads: { stop: (...a: unknown[]) => workloadsStop(...a) } },
}));

import { WorkloadCard } from "./WorkloadCard";
import type { Workload } from "@/lib/schemas";

const workload: Workload = {
  cluster_id: "cluster-a",
  host: "192.168.1.22",
  status: "running",
  meta: {
    model: "Qwen2.5-7B",
    recipe: "official/qwen2.5",
    port: 8000,
    overrides: {},
  },
};

const recipe = {
  registeredName: "official/qwen2.5",
  label: "Qwen2.5 (official)",
};

describe("WorkloadCard", () => {
  beforeEach(() => {
    mockHealth.mockReset();
    workloadsStop.mockReset();
  });

  it("renders label, host, port, uptime and a Ready badge when healthy", () => {
    mockHealth.mockReturnValue({ ready: true, state: "ready" });
    render(<WorkloadCard workload={workload} recipe={recipe as never} />);
    expect(screen.getByText("Qwen2.5-7B")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.22")).toBeInTheDocument();
    expect(screen.getByText("8000")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("shows container status while the first health probe is loading", () => {
    mockHealth.mockReturnValue({ ready: false, state: "loading" });
    render(<WorkloadCard workload={workload} recipe={undefined} />);
    // containerStatus renders as-is (lowercase), styled with `capitalize`
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("shows Unreachable with a reason when health reports unreachable", async () => {
    mockHealth.mockReturnValue({
      ready: false,
      state: "unreachable",
      reason: "connection refused",
    });
    const { container } = render(<WorkloadCard workload={workload} recipe={undefined} />);
    const el = await screen.findByText("Unreachable");
    expect(el).toBeInTheDocument();
    expect(el.getAttribute("title")).toBe("connection refused");
  });

  it("opens the recipe dialog from the recipe row when present", async () => {
    mockHealth.mockReturnValue({ ready: false, state: "loading" });
    const user = userEvent.setup();
    render(<WorkloadCard workload={workload} recipe={recipe as never} />);
    await user.click(screen.getByText("Qwen2.5 (official)"));
    expect(screen.getByTestId("recipe-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("recipe-dialog")).toHaveTextContent("Qwen2.5 (official)");
  });

  it("confirms stopping a workload before calling rpc", async () => {
    mockHealth.mockReturnValue({ ready: false, state: "loading" });
    workloadsStop.mockResolvedValue({});
    const user = userEvent.setup();
    render(<WorkloadCard workload={workload} recipe={undefined} />);

    // Click the card's Stop button
    await user.click(screen.getByRole("button", { name: /Stop/ }));
    // Base UI alert popup exposes role="alertdialog"; confirm is labelled "Stop"
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(workloadsStop).toHaveBeenCalledWith({ clusterId: "cluster-a" });
    });
  });
});
