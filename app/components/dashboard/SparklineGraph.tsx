"use client";
import { Card } from "@/app/components/ui/Card";

/**
 * SparklineGraph - A lightweight sparkline component for metrics
 * 
 * Displays a line chart showing historical trends for a single metric.
 * Uses simple SVG paths for rendering, no external dependencies.
 */
export function SparklineGraph({
  title,
  data,
  color = "blue",
  unit = "",
  showLabel = true,
}: {
  title: string;
  data: number[] | undefined | null;
  color?: "blue" | "purple" | "green" | "orange" | "red" | "sky" | "amber";
  unit?: string;
  showLabel?: boolean;
}) {
  // Handle undefined/null/empty data gracefully
  const safeData = Array.isArray(data) ? data.filter(v => Number.isFinite(v)) : [];
  
  if (safeData.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        {showLabel && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            {title}
          </div>
        )}
        <div className="h-16 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">No data yet</div>
      </div>
    );
  }

  const w = 120;
  const h = 48;
  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData, 0);
  const range = max - min || 1;

  // Calculate path points - normalize data to fit height
  const step = w / Math.max(1, safeData.length - 1);
  const path = safeData
    .map((v, i) => {
      const x = i * step;
      // Skip non-finite values to avoid rendering issues
      if (!Number.isFinite(v)) return null;
      const normalizedY = (v - min) / range; // 0 to 1
      const y = h - normalizedY * (h - 8) - 4; // Leave 4px padding top/bottom
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");

  const current = safeData.length > 0 ? safeData[safeData.length - 1] : undefined;

  // Color mappings
  const colors = {
    blue: { stroke: "stroke-blue-500", fill: "fill-blue-500/10" },
    purple: { stroke: "stroke-purple-500", fill: "fill-purple-500/10" },
    green: { stroke: "stroke-emerald-500", fill: "fill-emerald-500/10" },
    orange: { stroke: "stroke-orange-500", fill: "fill-orange-500/10" },
    red: { stroke: "stroke-red-500", fill: "fill-red-500/10" },
    sky: { stroke: "stroke-sky-500", fill: "fill-sky-500/10" },
    amber: { stroke: "stroke-amber-500", fill: "fill-amber-500/10" },
  };

  const theme = colors[color] || colors.sky;

  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${theme.stroke.replace("stroke-", "text-")}`}>
            {title}
          </div>
          {data.length > 2 && (
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {typeof current === "number" && Number.isFinite(current) ? current.toFixed(1) + unit : "—"}
            </span>
          )}
        </div>
      )}
      <div className="h-16 w-full overflow-hidden rounded bg-zinc-50 dark:bg-zinc-900">
        <svg width={w} height={h} className="overflow-visible">
          {/* Grid line */}
          <line
            x1="0"
            y1={h - 4}
            x2={w}
            y2={h - 4}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth={1}
          />
          {/* Sparkline area fill (optional) */}
          <path
            d={`${path} L ${w},${h} L 0,${h} Z`}
            className={`${theme.fill}`}
            fillOpacity={0.3}
          />
          {/* Sparkline stroke */}
          <path
            d={path}
            fill="none"
            className={`${theme.stroke}`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Min: {min.toFixed(1)}{unit} • Max: {max.toFixed(1)}{unit}
      </div>
    </div>
  );
}
