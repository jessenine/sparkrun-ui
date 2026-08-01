import { serverClient as _serverClient } from "@/lib/rpc/server";
import { collectRunningRecipeNames } from "@/lib/runningRecipes";
import { RecipesBrowser } from "@/app/components/recipes/RecipesBrowser";
import type { RecipeListItem } from "@/lib/schemas";
import type { z } from "zod";
import { ExtendedRecipeSchema } from "@/lib/rpc/procedures/recipes";

type ExtendedRecipe = z.infer<typeof ExtendedRecipeSchema>;

export const dynamic = "force-dynamic";

// Suppress type error - ORPC framework type inference issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const serverClient = _serverClient as any;

export default async function RecipesPage() {
  // Use simple list endpoint for SSR (fast); VRAM data fetched client-side
  const [recipes, status] = await Promise.all([
    serverClient.recipes.list({ all: true }),
    serverClient.status.get().catch(() => null),
  ]);
  const runningRecipes = status
    ? await collectRunningRecipeNames(status.solo_entries, recipes as RecipeListItem[])
    : [];
  return <RecipesBrowser recipes={recipes as ExtendedRecipe[]} runningRecipes={runningRecipes} />;
}
