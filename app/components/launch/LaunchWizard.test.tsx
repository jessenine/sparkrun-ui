// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaunchWizard } from "./LaunchWizard";

const readYaml = vi.fn();
const validate = vi.fn();
const stop = vi.fn();
const dryRun = vi.fn();
const statusStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    recipes: {
      readYaml: (...a: unknown[]) => readYaml(...a),
      validate: (...a: unknown[]) => validate(...a),
      dryRun: (...a: unknown[]) => dryRun(...a),
    },
    workloads: { stop: (...a: unknown[]) => stop(...a) },
    status: { stream: (...a: unknown[]) => statusStream(...a) },
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/app/components/ui/Toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

// Heavy / orthogonal children are stubbed so the test targets LaunchWizard flow.
vi.mock("@/app/components/ui/Select", () => ({
  Select: ({
    value,
    onValueChange,
    options,
  }: {
    value: string | null;
    onValueChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      data-testid="mock-select"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/app/components/ui/Tabs", () => {
  const List = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Tab = ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  );
  const Panel = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Tabs = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Tabs.List = List;
  Tabs.Tab = Tab;
  Tabs.Panel = Panel;
  return { Tabs };
});

vi.mock("@/app/components/ui/CodeBlock", () => ({
  CodeBlock: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./YamlEditor", () => ({
  YamlEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="yaml-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("./OverridesForm", () => ({
  OverridesForm: ({ yaml, onYamlChange }: { yaml: string; onYamlChange: (v: string) => void }) => (
    <textarea
      data-testid="overrides-input"
      value={yaml}
      onChange={(e) => onYamlChange(e.target.value)}
    />
  ),
}));

vi.mock("./IssueList", () => ({
  IssueList: ({ issues }: { issues: { message: string }[] }) => (
    <ul>
      {issues.map((i) => (
        <li key={i.message}>{i.message}</li>
      ))}
    </ul>
  ),
}));

vi.mock("./LogStream", () => ({ LogStream: () => <div data-testid="log-stream" /> }));

vi.mock("./LaunchProgressDialog", () => ({
  LaunchProgressDialog: ({ open, onSuccess }: { open: boolean; onSuccess: () => void }) =>
    open ? (
      <div data-testid="launch-dialog">
        <button type="button" onClick={onSuccess}>
          simulate-success
        </button>
      </div>
    ) : null,
}));

function stream<T>(events: T[]): AsyncGenerator<T> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

const recipes = [
  {
    name: "official/qwen",
    file: "official/qwen.yaml",
    path: "official/qwen.yaml",
    runtime: "vllm",
    model: "qwen2.5",
    description: "Qwen 2.5",
    min_nodes: 1,
    registry: "default",
  },
];
const clusters = [{ name: "lab", is_default: true, hosts: ["10.0.0.1"] }];

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    recipes,
    clusters,
    defaultClusterName: "lab",
    ...overrides,
  };
}

describe("LaunchWizard", () => {
  beforeEach(() => {
    readYaml.mockReset();
    validate.mockReset();
    stop.mockReset();
    dryRun.mockReset();
    statusStream.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    readYaml.mockResolvedValue({ yaml: "model: qwen\n" });
    validate.mockResolvedValue({ issues: [] });
    dryRun.mockResolvedValue({ ok: true, stdout: "Plan OK", stderr: "" });
    stop.mockResolvedValue({});
    statusStream.mockResolvedValue(stream([]));
  });

  it("renders the recipe picker and continues to the edit step after selecting a recipe", async () => {
    render(<LaunchWizard {...baseProps()} />);
    expect(screen.getByText("Pick a recipe")).toBeInTheDocument();
    // No selection yet → Continue disabled
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    fireEvent.change(screen.getByTestId("mock-select"), {
      target: { value: "official/qwen" },
    });

    await waitFor(() => {
      expect(readYaml).toHaveBeenCalledWith({ name: "official/qwen" });
    });
    // Advanced to the edit step with the YAML editor rendered
    await waitFor(() => {
      expect(screen.getByTestId("overrides-input")).toBeInTheDocument();
    });
    expect(screen.getByTestId("yaml-input")).toBeInTheDocument();
    expect(screen.getByText("Validation")).toBeInTheDocument();
  });

  it("jumps straight to edit when initialRecipe is provided, validates, and enables Continue", async () => {
    render(<LaunchWizard {...baseProps({ initialRecipe: "official/qwen" })} />);
    await waitFor(() => expect(readYaml).toHaveBeenCalled());
    // Validation resolves with no errors after the debounce
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /continue to preview/i })).toBeEnabled();
      },
      { timeout: 2000 },
    );
  });

  it("blocks advancing when validation reports an error and surfaces port conflicts", async () => {
    validate.mockResolvedValue({
      issues: [
        {
          severity: "error",
          message: "Port 8080 already used",
          conflictingClusterId: "other",
        },
      ],
    });
    render(<LaunchWizard {...baseProps({ initialRecipe: "official/qwen" })} />);
    await waitFor(() => expect(readYaml).toHaveBeenCalled());
    await waitFor(
      () => {
        expect(screen.getByText("Port 8080 already used")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    // Port conflict produces a Stop button
    const stopBtn = screen.getByRole("button", { name: /stop other/i });
    fireEvent.click(stopBtn);
    await waitFor(() => {
      expect(stop).toHaveBeenCalledWith({ clusterId: "other" });
    });
    // Error present → Continue to preview stays disabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continue to preview/i })).toBeDisabled();
    });
  });

  it("stops a conflicting instance and re-runs validation", async () => {
    let issuesFlag = false;
    validate.mockImplementation(async () => ({
      issues: issuesFlag
        ? []
        : [
            {
              severity: "error",
              message: "Port 8080 already used",
              conflictingClusterId: "other",
            },
          ],
    }));
    stop.mockImplementation(async () => {
      issuesFlag = true;
      return {};
    });
    render(<LaunchWizard {...baseProps({ initialRecipe: "official/qwen" })} />);
    await waitFor(() => expect(readYaml).toHaveBeenCalled());
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /stop other/i })).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /stop other/i }));
    // After stop re-validates, the conflict clears and Continue becomes enabled
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /continue to preview/i })).toBeEnabled();
      },
      { timeout: 3000 },
    );
    expect(stop).toHaveBeenCalled();
  });

  it("walks the full flow edit → preview → launch → logs", async () => {
    render(<LaunchWizard {...baseProps({ initialRecipe: "official/qwen" })} />);
    await waitFor(() => expect(readYaml).toHaveBeenCalled());

    // Continue to preview
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /continue to preview/i })).toBeEnabled();
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /continue to preview/i }));

    // Preview step shows the dry-run output
    await waitFor(() => {
      expect(dryRun).toHaveBeenCalled();
    });
    expect(await screen.findByText("Plan OK", {}, { timeout: 2000 })).toBeInTheDocument();

    // Launch opens the dialog; simulate success → logs step
    fireEvent.click(screen.getByRole("button", { name: /launch on lab/i }));
    expect(screen.getByTestId("launch-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("simulate-success"));

    // Logs step: status.stream yields no match → waiting state
    await waitFor(
      () => {
        expect(screen.getByText("Waiting for the workload to start…")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(statusStream).toHaveBeenCalled();
  });

  it("calls the backward navigation to return to the edit step from preview", async () => {
    render(<LaunchWizard {...baseProps({ initialRecipe: "official/qwen" })} />);
    await waitFor(() => expect(readYaml).toHaveBeenCalled());
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /continue to preview/i })).toBeEnabled();
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /continue to preview/i }));
    await waitFor(() => expect(dryRun).toHaveBeenCalled());

    // Back returns from preview to edit
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Validation")).toBeInTheDocument();
  });
});
