import { runSparkrunJson, runSparkrunText } from "./sparkrun";
import { ClusterStatusSchema, type ClusterStatus as SparkrunClusterStatus } from "./schemas";

// Re-export the schema for API routes
export { ClusterStatusSchema, type SparkrunClusterStatus };

// Internal types for metrics collection
// The actual sparkrun output has this structure:
// { timestamp: number, hosts: [{ host: string, error: null|string, sample: {...}, workloads: [...], used_slots: number, free_slots: number }, ...] }
type MonitorMetrics = {
  timestamp: number;
  hosts: Array<{
    host: string;
    error: string | null;
    sample: {
      timestamp: string;
      hostname: string;
      uptime_sec: string;
      cpu_load_1m: string;
      cpu_load_5m: string;
      cpu_load_15m: string;
      cpu_usage_pct: string;
      cpu_freq_mhz: string;
      cpu_temp_c: string;
      mem_total_mb: string;
      mem_used_mb: string;
      mem_available_mb: string;
      mem_used_pct: string;
      swap_total_mb: string;
      swap_used_mb: string;
      gpu_name: string;
      gpu_util_pct: string;
      gpu_mem_used_mb: string;
      gpu_mem_total_mb: string;
      gpu_mem_used_pct: string;
      gpu_temp_c: string;
      gpu_power_w: string;
      gpu_power_limit_w: string;
      gpu_clock_mhz: string;
      gpu_mem_clock_mhz: string;
      sparkrun_jobs: string;
      sparkrun_job_names: string;
      gpu_encoder_pct: string;
      gpu_decoder_pct: string;
      gpu_fan_pct: string;
      mem_bufcache_mb: string;
    };
    workloads: Array<{
      cluster_id: string;
      recipe: string;
      runtime: string;
      ranks_on_host: number;
      containers: Array<{
        name: string;
        role: string;
        status: string;
        image: string;
      }>;
    }>;
    used_slots: number;
    free_slots: number;
  }>;
};

type ProcessInfo = {
  id: string;
  name: string;
  host: string;
  cpu: number;
  memory: number;
  status: string;
};

/** Parse NDJSON text (one JSON object per line) into an array of objects. */
export function parseMetricNdjson(text: string): unknown[] {
  const out: unknown[] = [];
  const lines = text.trim().split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // Skip non-JSON lines
    }
  }
  return out;
}

// Cache with TTL
class Cache<T> {
  private value: T | null = null;
  private timestamp: number = 0;
  private ttlMs: number;

  constructor(ttlMs = 2000) {
    this.ttlMs = ttlMs;
  }

  get(): T | null {
    if (this.value === null) return null;
    if (Date.now() - this.timestamp > this.ttlMs) {
      this.value = null;
      return null;
    }
    return this.value;
  }

  set(value: T) {
    this.value = value;
    this.timestamp = Date.now();
  }
}

// Global caches
const monitorCache = new Cache<MonitorMetrics[]>(2000);
const processesCache = new Cache<ProcessInfo[]>(3000);
const statusCache = new Cache<SparkrunClusterStatus>(5000);

// Flag to prevent multiple simultaneous collection
let isCollecting = false;

export async function collectMetrics(): Promise<void> {
  if (isCollecting) {
    return; // Skip if already collecting
  }

  isCollecting = true;
  try {
    
    // Collect monitor metrics using runSparkrunText with timeout
    // The output is NDJSON - one JSON object per line for each snapshot
    let monitorResult: MonitorMetrics[] = [];
    try {
      const result = await runSparkrunText(
        ["cluster", "monitor", "--json", "--interval", "1"],
        { timeoutMs: 3000 },
      );
      
      // Parse NDJSON output (multiple JSON objects, one per line)
      monitorResult = parseMetricNdjson(result.stdout) as MonitorMetrics[];
    } catch (err: any) {
      // Silently continue on error
    }
    
    if (monitorResult.length > 0) {
      monitorCache.set(monitorResult);
    }

    // Collect process info
    const processesResult = await runSparkrunJson<ProcessInfo[]>(
      ["cluster", "processes", "--json"],
      { timeoutMs: 3000 },
    ).catch(() => processesCache.get() ?? []);

    if (Array.isArray(processesResult) && processesResult.length > 0) {
      processesCache.set(processesResult);
    }

    // Collect cluster status - use "status" not "list"
    const statusResult = await runSparkrunJson<SparkrunClusterStatus>(
      ["cluster", "status", "--json"],
      { timeoutMs: 3000 },
    ).catch(() => statusCache.get() ?? null);

    if (statusResult) {
      statusCache.set(statusResult);
    }
  } catch (error) {
    console.error("Metrics collection failed:", error);
  } finally {
    isCollecting = false;
  }
}

export function getMonitorMetrics(): MonitorMetrics[] | null {
  return monitorCache.get();
}

export function getProcesses(): ProcessInfo[] | null {
  return processesCache.get();
}

export function getClusterStatus(): SparkrunClusterStatus | null {
  return statusCache.get();
}

// Start background collection loop
let collectionInterval: NodeJS.Timeout | null = null;

export function startMetricsCollection(): void {
  if (collectionInterval) {
    console.warn("Metrics collection already running");
    return;
  }

  console.log("Starting metrics collection loop (every 2s)");

  // Collect immediately on start
  collectMetrics();

  // Then collect on interval
  collectionInterval = setInterval(collectMetrics, 2000);
}

export function stopMetricsCollection(): void {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
    console.log("Stopped metrics collection loop");
  }
}
