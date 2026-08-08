// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecipeInfoPopover } from "./RecipeInfoPopover";

const info = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { recipes: { info: (...a: unknown[]) => info(...a) } },
}));

vi.mock("@/app/components/ui/HoverCard", () => ({
  HoverCard: ({
    children,
    onOpenChange,
    trigger,
  }: {
    children: React.ReactNode;
    onOpenChange: (o: boolean) => void;
    trigger: React.ReactNode;
  }) => (
    <div>
      <button type="button" data-testid="open" onClick={() => onOpenChange(true)}>
        {trigger}
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/app/components/ui/Badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const vram = {
  fits_dgx_spark: true,
  model_dtype: "bf16",
  model_params: 7_600_000_000,
  tensor_parallel: 1,
  model_weights_gb: 14.5,
  kv_cache_total_gb: 2.0,
  max_model_len: 65536,
  total_per_gpu_gb: 20.0,
  gpu_memory_utilization: 0.9,
  usable_gpu_memory_gb: 94.0,
  available_kv_gb: 60.0,
  max_context_tokens: 8192,
  context_multiplier: 1.5,
  num_layers: 32,
  num_kv_heads: 8,
  head_dim: 128,
};

describe("RecipeInfoPopover", () => {
  beforeEach(() => {
    info.mockReset();
  });

  it("loads and renders recipe info when opened", async () => {
    info.mockResolvedValue({ description: "A Qwen model", vram });
    render(
      <RecipeInfoPopover name="official/qwen">
        <span>trigger</span>
      </RecipeInfoPopover>,
    );
    fireEvent.click(screen.getByTestId("open"));
    await waitFor(() => {
      expect(info).toHaveBeenCalledWith({ name: "official/qwen" });
    });
    expect(await screen.findByText("VRAM estimation")).toBeInTheDocument();
    expect(screen.getByText("fits DGX Spark")).toBeInTheDocument();
    expect(screen.getByText("7.6B")).toBeInTheDocument();
    expect(screen.getByText("32L · 8KV · d=128")).toBeInTheDocument();
    expect(screen.getByText("GPU memory budget")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("1.5x")).toBeInTheDocument();
    expect(screen.getByText("A Qwen model")).toBeInTheDocument();
  });

  it("renders No description when the recipe has none", async () => {
    info.mockResolvedValue({ description: undefined, vram: undefined });
    render(
      <RecipeInfoPopover name="official/x">
        <span>trigger</span>
      </RecipeInfoPopover>,
    );
    fireEvent.click(screen.getByTestId("open"));
    expect(await screen.findByText("No description")).toBeInTheDocument();
  });

  it("shows the header name in mono before load", () => {
    info.mockResolvedValue({ description: undefined });
    render(
      <RecipeInfoPopover name="official/qwen">
        <span>trigger</span>
      </RecipeInfoPopover>,
    );
    fireEvent.click(screen.getByTestId("open"));
    expect(screen.getAllByText("official/qwen").length).toBeGreaterThan(0);
  });
});

describe("RecipeInfoPopover formatters", () => {
  it("renders on-disk-specific rows and tolerates missing values", async () => {
    info.mockResolvedValue({
      description: undefined,
      vram: {
        fits_dgx_spark: undefined,
        model_dtype: "bf16",
        model_params: undefined,
        tensor_parallel: undefined,
        model_weights_gb: undefined,
        kv_cache_total_gb: undefined,
        max_model_len: undefined,
        total_per_gpu_gb: undefined,
        gpu_memory_utilization: undefined,
        usable_gpu_memory_gb: undefined,
        available_kv_gb: undefined,
        max_context_tokens: undefined,
        context_multiplier: undefined,
        num_layers: 0,
      },
    });
    render(
      <RecipeInfoPopover name="official/z">
        <span>trigger</span>
      </RecipeInfoPopover>,
    );
    fireEvent.click(screen.getByTestId("open"));
    // No formatter rows should render for undefined values
    expect(await screen.findByText("GPU memory budget")).toBeInTheDocument();
    expect(screen.queryByText("GB")).not.toBeInTheDocument();
  });

  it("accepts a vramError even when vram is missing", async () => {
    info.mockResolvedValue({ description: undefined, vramError: "insufficient memory" });
    render(
      <RecipeInfoPopover name="official/e">
        <span>trigger</span>
      </RecipeInfoPopover>,
    );
    fireEvent.click(screen.getByTestId("open"));
    expect(await screen.findByText("insufficient memory")).toBeInTheDocument();
  });
});
