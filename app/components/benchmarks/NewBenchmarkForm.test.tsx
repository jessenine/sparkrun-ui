// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewBenchmarkForm } from "./NewBenchmarkForm";

const benchRun = vi.fn();
const recipeInfo = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    benchmarks: { run: (...a: unknown[]) => benchRun(...a) },
    recipes: { info: (...a: unknown[]) => recipeInfo(...a) },
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

const pushMock = vi.fn();
const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => "/benchmarks",
  useRouter: () => ({
    push: (...a: unknown[]) => pushMock(...a),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
}));

// Headless base-ui primitives are mocked to control values via native controls.
vi.mock("@/app/components/ui/Select", () => ({
  Select: ({
    value,
    onValueChange,
    options,
    placeholder,
  }: {
    value: string | null;
    onValueChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select
      data-testid="mock-select"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/app/components/ui/Switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (c: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      data-testid="mock-switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

const recipes = [
  { name: "official/qwen", file: "official/qwen.yaml", runtime: "vllm", model: "qwen2.5" },
  { name: "official/llama", file: "official/llama.yaml", runtime: "vllm", model: "llama3" },
];
const clusters = [{ name: "lab", is_default: true, hosts: ["10.0.0.1"] }];
const profiles = [{ name: "smoke", registry: "reg", framework: "vllm" }];

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    recipes,
    clusters,
    profiles,
    defaultClusterName: "lab",
    runningRecipes: [],
    ...overrides,
  };
}

describe("NewBenchmarkForm", () => {
  beforeEach(() => {
    benchRun.mockReset();
    recipeInfo.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    pushMock.mockReset();
    searchParams.delete("recipe");
    searchParams.delete("model");
    searchParams.delete("cluster");
    searchParams.delete("skipRun");
    searchParams.delete("port");
    searchParams.delete("servedModelName");
    recipeInfo.mockResolvedValue({ vram: { max_model_len: 100000 } });
  });

  it("renders the form with recipe, cluster and profile selects", () => {
    render(<NewBenchmarkForm {...baseProps()} />);
    expect(screen.getByText("New benchmark")).toBeInTheDocument();
    const selects = screen.getAllByTestId("mock-select");
    expect(selects).toHaveLength(3);
    const recipeSelect = selects[0];
    expect(recipeSelect).toHaveValue("");
  });

  it("preselects the first running recipe and locks skipRun", () => {
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    const selects = screen.getAllByTestId("mock-select");
    expect(selects[0]).toHaveValue("official/qwen");
    expect(screen.getByTestId("mock-switch")).toBeChecked();
    expect(screen.getByText(/^sparkrun benchmark run/)).toBeInTheDocument();
  });

  it("preselects the recipe and cluster from URL search params", () => {
    searchParams.set("recipe", "official/llama");
    searchParams.set("cluster", "lab");
    render(<NewBenchmarkForm {...baseProps()} />);
    const selects = screen.getAllByTestId("mock-select");
    expect(selects[0]).toHaveValue("official/llama");
    expect(selects[1]).toHaveValue("lab");
  });

  it("computes task count and shows the command preview", () => {
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    // Default arena preset: 4 concurrency x 1 pp x 1 tg x 7 depth = 28
    expect(screen.getByText(/Will run 28 tasks/)).toBeInTheDocument();
    expect(
      screen.getByText(/sparkrun benchmark run official\/qwen --cluster lab/),
    ).toBeInTheDocument();
  });

  it("updates the command preview when cluster/profile/schedule change", async () => {
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    const selects = screen.getAllByTestId("mock-select");
    // Choose a profile
    fireEvent.change(selects[2], { target: { value: "smoke" } });
    // The profile name appears in the (single text-node) command preview
    expect(screen.getByText(/--profile smoke/)).toBeInTheDocument();
  });

  it("shows a validation error when a list field is emptied", () => {
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    const concurrency = screen.getByDisplayValue("1,2,5,10");
    fireEvent.change(concurrency, { target: { value: "" } });
    expect(screen.getByText("Enter at least one number")).toBeInTheDocument();
    expect(screen.getByText("No tasks — fix empty fields")).toBeInTheDocument();
  });

  it("disables the submit button when no recipe is selected or fields are empty", () => {
    // No running recipe and no URL recipe param → recipe is null → disabled
    render(<NewBenchmarkForm {...baseProps()} />);
    expect(screen.getByRole("button", { name: /start benchmark/i })).toBeDisabled();
  });

  it("disables the submit button when every task field is empty", () => {
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    // Clear all four list fields → taskCount 0 → disabled even with a recipe
    for (const v of ["1,2,5,10", "2048", "128", "0,4096,8192,16384,32768,65535,100000"]) {
      const inp = screen.getByDisplayValue(v);
      fireEvent.change(inp, { target: { value: "" } });
    }
    expect(screen.getByRole("button", { name: /start benchmark/i })).toBeDisabled();
  });

  it("applies a preset when its button is clicked", async () => {
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Smoke" }));
    // Smoke preset sets concurrency to "1" => task count = 1*1*1*1 = 1
    await waitFor(() => {
      expect(screen.getByText(/Will run 1 task/)).toBeInTheDocument();
    });
  });

  it("submits a benchmark and navigates to the run", async () => {
    benchRun.mockResolvedValue({ id: "b123" });
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    const start = screen.getByRole("button", { name: /start benchmark/i });
    expect(start).not.toBeDisabled();
    fireEvent.click(start);
    await waitFor(() => {
      expect(benchRun).toHaveBeenCalled();
    });
    const arg = benchRun.mock.calls[0][0];
    expect(arg.recipe).toBe("official/qwen");
    expect(arg.cluster).toBe("lab");
    expect(arg.skipRun).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/benchmarks/b123");
  });

  it("shows a toast error and re-enables the button when run fails", async () => {
    benchRun.mockRejectedValue(new Error("cluster offline"));
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    fireEvent.click(screen.getByRole("button", { name: /start benchmark/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastError.mock.calls[0][1]).toBe("cluster offline");
    const start = screen.getByRole("button", { name: /start benchmark/i });
    expect(start).toBeEnabled();
  });

  it("warns when the worst-case context exceeds the recipe max_model_len", async () => {
    recipeInfo.mockResolvedValue({ vram: { max_model_len: 100 } });
    render(<NewBenchmarkForm {...baseProps({ runningRecipes: ["official/qwen"] })} />);
    await waitFor(() => {
      // depth max (65535 or 100000) + pp 2048 + tg 128 > 100
      expect(screen.getByText(/exceeds recipe max_model_len/)).toBeInTheDocument();
    });
  });
});
