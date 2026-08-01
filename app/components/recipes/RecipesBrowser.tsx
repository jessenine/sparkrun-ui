"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Rocket, Search, X, Cpu, Code, Brain, Camera, Zap, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Select } from "@/app/components/ui/Select";
import { Switch } from "@/app/components/ui/Switch";
import { Input } from "@/app/components/ui/Field";
import type { RecipeListItem } from "@/lib/schemas";
import { RecipeInfoPopover } from "./RecipeInfoPopover";
import { RecipeShowDialog } from "./RecipeShowDialog";
import { UpdateSparkrunButton } from "@/app/components/dashboard/UpdateSparkrunButton";
import { rpc } from "@/lib/rpc/client";

interface ExtendedRecipe extends RecipeListItem {
  vram?: { fits_dgx_spark?: boolean } | null;
  vramError?: string | null;
  category?: string;
}

interface RecipeBrowserProps {
  recipes: ExtendedRecipe[];
  runningRecipes: string[];
}

export function RecipesBrowser({ recipes, runningRecipes }: RecipeBrowserProps) {
  const running = useMemo(() => new Set(runningRecipes), [runningRecipes]);
  const runningCount = useMemo(
    () => recipes.filter((r) => running.has(r.name)).length,
    [recipes, running],
  );
  const [registry, setRegistry] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recipes-registry") ?? "all";
    }
    return "all";
  });
  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recipes-search") ?? "";
    }
    return "";
  });
  const [showRunningOnly, setShowRunningOnly] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recipes-running-only") === "true";
    }
    return false;
  });
  const [dgxOnly, setDgxOnly] = useState<boolean>(false);
  const [dgxFetched, setDgxFetched] = useState(false);
  const [extendedRecipes, setExtendedRecipes] = useState<ExtendedRecipe[] | null>(null);
  const [categories, setCategories] = useState<{ name: string; category: string }[]>([]);
  const [category, setCategory] = useState<string>("all");
  const abortRef = useRef<AbortController | null>(null);

  // Fetch DGX compatibility for all recipes on mount (with 60s timeout)
  useEffect(() => {
    if (dgxFetched) return;
    abortRef.current = new AbortController();
    const controller = abortRef.current;
    const fetchVram = async () => {
      try {
        // Wait a tick to allow cancellation before starting the long RPC call
        await new Promise<void>((r) => setTimeout(r, 100));
        if (controller.signal.aborted) return;
        console.log("[RecipesBrowser] Fetching VRAM data...");
        const extended = await rpc.recipes.listExtended({ all: true });
        console.log("[RecipesBrowser] VRAM data loaded:", extended.length, "recipes");
        if (!controller.signal.aborted) {
          setExtendedRecipes(extended);
          setDgxFetched(true);
        }
      } catch (e) {
        console.warn("[RecipesBrowser] VRAM fetch failed:", e);
        // Silently ignore — user can still browse without VRAM data
      }
    };
    fetchVram();
    return () => {
      controller.abort();
    };
  }, [dgxFetched]);

  // Use cached extended recipes if available, otherwise fall back to basic list
  const effectiveRecipes = useMemo(() => {
    return extendedRecipes ?? recipes;
  }, [extendedRecipes, recipes]);

  useEffect(() => {
    localStorage.setItem("recipes-registry", registry);
  }, [registry]);

  useEffect(() => {
    localStorage.setItem("recipes-search", search);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("recipes-running-only", String(showRunningOnly));
  }, [showRunningOnly]);

  useEffect(() => {
    localStorage.setItem("recipes-category", category);
  }, [category]);

  // Fetch category data on mount (fast, no RPC needed — just string matching)
  useEffect(() => {
    if (categories.length > 0) return;
    abortRef.current = new AbortController();
    const controller = abortRef.current;
    const fetchCategories = async () => {
      try {
        const withCategory = await rpc.recipes.listWithCategory({ all: true });
        if (!controller.signal.aborted) {
          setCategories(withCategory.map((r: any) => ({ name: r.name, category: r.category ?? "general" })));
        }
      } catch (e) {
        console.warn("[RecipesBrowser] Category fetch failed:", e);
      }
    };
    fetchCategories();
    return () => {
      controller.abort();
    };
  }, [categories]);

  // Merge category data with VRAM data when both arrive
  const enrichedRecipes = useMemo(() => {
    const catMap = new Map<string, { name: string; category: string }>();
    for (const r of categories) {
      catMap.set(r.name, r);
    }
    return effectiveRecipes.map((r) => {
      const cat = catMap.get(r.name);
      return {
        ...r,
        category: cat?.category ?? r.category,
      };
    });
  }, [effectiveRecipes, categories]);

  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  const registries = useMemo(() => {
    const set = new Set<string>();
    for (const r of effectiveRecipes) set.add(r.registry);
    return Array.from(set).sort();
  }, [effectiveRecipes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedRecipes.filter((r) => {
      if (showRunningOnly && !running.has(r.name)) return false;
      if (registry !== "all" && r.registry !== registry) return false;
      if (category !== "all" && r.category !== category) return false;
      if (dgxOnly) {
        // Show recipes that fit DGX Spark OR have no VRAM data yet (still loading)
        const vram = r.vram;
        if (vram != null && vram.fits_dgx_spark === false) return false;
      }
      if (!term) return true;
      const hay = `${r.name} ${r.model} ${r.description ?? ""} ${r.runtime}`.toLowerCase();
      return hay.includes(term);
    });
  }, [enrichedRecipes, registry, search, showRunningOnly, dgxOnly, category, running]);

  const byRegistry = useMemo(() => {
    const m = new Map<string, ExtendedRecipe[]>();
    for (const r of filtered) {
      const arr = m.get(r.registry) ?? [];
      arr.push(r);
      m.set(r.registry, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const registryOptions = [
    { value: "all", label: "All registries", description: `${effectiveRecipes.length} recipes` },
    ...registries.map((reg) => ({
      value: reg,
      label: `@${reg}`,
      description: `${effectiveRecipes.filter((r) => r.registry === reg).length} recipes`,
    })),
  ];

  const hasActiveFilters = registry !== "all" || search !== "" || showRunningOnly || dgxOnly || category !== "all";
  const dgxFetching = !dgxFetched;
  const dgxFitCount = useMemo(() => {
    if (!dgxFetched) return 0;
    return effectiveRecipes.filter((r) => r.vram?.fits_dgx_spark).length;
  }, [effectiveRecipes, dgxFetched]);

  const clearFilters = () => {
    setRegistry("all");
    setSearch("");
    setShowRunningOnly(false);
    setDgxOnly(false);
    setCategory("all");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {filtered.length} of {recipes.length}
            </p>
          </div>
          <UpdateSparkrunButton />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="relative min-w-[12rem] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, model, runtime…"
              className="bg-white pl-8 dark:bg-zinc-900"
            />
          </div>
          <div className="w-44">
            <Select
              value={registry}
              onValueChange={setRegistry}
              options={registryOptions}
              placeholder="Registry"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-600 select-none hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <Cpu size={14} className={dgxFetching ? "animate-spin" : ""} />
            <span>DGX Spark</span>
            {dgxFetched && (
              <span className="text-zinc-400">({dgxFitCount}/{effectiveRecipes.length})</span>
            )}
          </label>
          <div className="flex items-center gap-1">
            {[
              { value: "coding", label: "Code", icon: Code, color: "text-sky-500" },
              { value: "reasoning", label: "Reason", icon: Brain, color: "text-purple-500" },
              { value: "vision", label: "Vision", icon: Camera, color: "text-emerald-500" },
              { value: "diffusion", label: "Diffusion", icon: Zap, color: "text-amber-500" },
              { value: "general", label: "General", icon: Sparkles, color: "text-zinc-400" },
            ].map(({ value, label, icon: Icon, color }) => {
              const count = enrichedRecipes.filter((r) => r.category === value).length;
              const isActive = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(isActive ? "all" : value)}
                  className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs select-none transition-colors ${
                    isActive
                      ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon size={12} className={color} />
                  <span>{label}</span>
                  <span className="text-zinc-400">({count})</span>
                </button>
              );
            })}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-600 select-none hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <Switch checked={showRunningOnly} onCheckedChange={setShowRunningOnly} />
            Running
            {runningCount > 0 && <span className="text-zinc-400">({runningCount})</span>}
          </label>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X size={14} />
              Clear
            </Button>
          )}
        </div>
      </div>

      {openRecipe && (
        <RecipeShowDialog
          name={openRecipe}
          open={true}
          onOpenChange={(o) => !o && setOpenRecipe(null)}
          running={running.has(openRecipe)}
        />
      )}

      {byRegistry.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            No recipes match these filters.
          </CardBody>
        </Card>
      ) : (
        byRegistry.map(([reg, rows]) => (
          <section key={reg} className="flex flex-col gap-3">
            <h2 className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300">
              @{reg}
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-500">({rows.length})</span>
            </h2>
            <Card>
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Model</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Nodes</th>
                      <th className="px-4 py-2">DGX Spark</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {rows.map((r) => {
                      const fitsDgx = r.vram?.fits_dgx_spark;
                      const hasVram = r.vram != null;
                      return (
                        <tr key={r.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                          <td className="px-4 py-2 font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <RecipeInfoPopover name={r.name}>
                                <button
                                  type="button"
                                  onClick={() => setOpenRecipe(r.name)}
                                  className="cursor-pointer underline decoration-zinc-400 decoration-dotted underline-offset-2 hover:text-sky-600 dark:hover:text-sky-400"
                                >
                                  {r.file}
                                </button>
                              </RecipeInfoPopover>
                              {running.has(r.name) && <Badge tone="green">running</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            <div className="flex flex-col gap-1">
                              <span>{r.model}</span>
                              <span>
                                <Badge tone="sky">{r.runtime}</Badge>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {r.category ? (
                              <div className="flex items-center gap-1">
                                {r.category === "coding" && <Code size={12} className="text-sky-500" />}
                                {r.category === "reasoning" && <Brain size={12} className="text-purple-500" />}
                                {r.category === "vision" && <Camera size={12} className="text-emerald-500" />}
                                {r.category === "diffusion" && <Zap size={12} className="text-amber-500" />}
                                {r.category === "general" && <Sparkles size={12} className="text-zinc-400" />}
                                <span className="capitalize text-zinc-600 dark:text-zinc-400">{r.category}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                            <span
                              title="Minimum number of DGX Spark nodes required to run this recipe"
                              className="cursor-help underline decoration-zinc-400 decoration-dotted underline-offset-2"
                            >
                              {r.min_nodes}
                              {r.tp && r.tp !== "" && ` · tp=${r.tp}`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {!hasVram && !dgxFetching ? (
                              <span className="text-zinc-400">—</span>
                            ) : fitsDgx === false ? (
                              <Badge tone="red">will not fit</Badge>
                            ) : fitsDgx ? (
                              <Badge tone="green">fits</Badge>
                            ) : (
                              <span className="text-zinc-400">analyzing…</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {running.has(r.name) ? (
                              <Button size="sm" variant="success" disabled>
                                <Rocket size={12} />
                                Running
                              </Button>
                            ) : (
                              <Link href={`/launch?recipe=${encodeURIComponent(r.name)}`}>
                                <Button size="sm" variant="success">
                                  <Rocket size={12} />
                                  Launch
                                </Button>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
