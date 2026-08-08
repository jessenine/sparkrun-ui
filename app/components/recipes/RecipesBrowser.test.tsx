// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const listExtended = vi.fn();
const listWithCategory = vi.fn();
const recipeInfo = vi.fn();
const updateStream = vi.fn();

vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    recipes: {
      listExtended: (...a: unknown[]) => listExtended(...a),
      listWithCategory: (...a: unknown[]) => listWithCategory(...a),
      info: (...a: unknown[]) => recipeInfo(...a),
    },
    update: { stream: (...a: unknown[]) => updateStream(...a) },
  },
}));

import { RecipesBrowser } from "./RecipesBrowser";

const recipes = [
  {
    name: "official/qwen2.5",
    path: "qwen2.5.yaml",
    file: "qwen2.5.yaml",
    model: "Qwen2.5-7B",
    runtime: "vllm",
    registry: "official",
    min_nodes: 1,
    description: "A reasoning model",
    vram: { fits_dgx_spark: true },
  },
  {
    name: "community/llama",
    path: "llama.yaml",
    file: "llama.yaml",
    model: "Llama-3-8B",
    runtime: "vllm",
    registry: "community",
    min_nodes: 2,
    description: "General model",
    vram: { fits_dgx_spark: false },
  },
];

describe("RecipesBrowser", () => {
  beforeEach(() => {
    listExtended.mockReset();
    listWithCategory.mockReset();
    recipeInfo.mockReset();
    updateStream.mockReset();
    listExtended.mockResolvedValue(recipes);
    listWithCategory.mockResolvedValue([
      { name: "official/qwen2.5", category: "reasoning" },
      { name: "community/llama", category: "general" },
    ]);
    recipeInfo.mockResolvedValue({});
    updateStream.mockResolvedValue(
      (async function* () {
        yield { line: "", done: true };
      })(),
    );
    localStorage.clear();
  });

  it("renders the recipe table with rows after loading", async () => {
    render(<RecipesBrowser recipes={recipes} runningRecipes={[]} />);
    expect(await screen.findByText("Recipes")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("qwen2.5.yaml")).toBeInTheDocument();
      expect(screen.getByText("llama.yaml")).toBeInTheDocument();
    });
  });

  it("shows the filtered count", async () => {
    render(<RecipesBrowser recipes={recipes} runningRecipes={[]} />);
    await waitFor(() => {
      expect(screen.getByText("2 of 2")).toBeInTheDocument();
    });
  });

  it("marks running recipes with a badge", async () => {
    render(<RecipesBrowser recipes={recipes} runningRecipes={["official/qwen2.5"]} />);
    await waitFor(() => {
      expect(screen.getAllByText("running").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Launch").length).toBe(1);
    });
  });

  it("shows an empty message when no recipes match", async () => {
    render(<RecipesBrowser recipes={[]} runningRecipes={[]} />);
    await screen.findByText("Recipes");
    await waitFor(() => {
      expect(screen.getByText("No recipes match these filters.")).toBeInTheDocument();
    });
  });
});
