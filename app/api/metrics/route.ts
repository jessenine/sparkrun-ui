import {
  collectMetrics,
  startMetricsCollection,
  stopMetricsCollection,
} from "@/lib/metrics-collector";

// Start metrics collection when the app starts
if (typeof process !== "undefined" && process.env && !process.env.NEXT_PHASE) {
  // Only start if not during build
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    startMetricsCollection();
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
}
