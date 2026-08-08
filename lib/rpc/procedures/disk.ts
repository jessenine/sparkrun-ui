import { os } from "@orpc/server";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const DiskUsageSchema = z.object({
  mount: z.string(),
  size_gb: z.number(),
  used_gb: z.number(),
  available_gb: z.number(),
  use_pct: z.number(),
  path: z.string(),
});

type DiskUsage = z.infer<typeof DiskUsageSchema>;

/** Parse `df --output=target,size,used,avail,pcent` stdout into disk entries. */
export function parseDfOutput(stdout: string): DiskUsage[] {
  const lines = stdout.trim().split("\n");
  if (lines.length < 2) {
    return [];
  }

  const result: DiskUsage[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const [mount, size, used, avail, usePct] = parts;
      const sizeGb = parseFloat(size) / (1024 * 1024 * 1024);
      const usedGb = parseFloat(used) / (1024 * 1024 * 1024);
      const availGb = parseFloat(avail) / (1024 * 1024 * 1024);
      const usePctNum = parseFloat(usePct.replace("%", ""));

      if (
        !isNaN(sizeGb) &&
        !isNaN(usedGb) &&
        !isNaN(availGb) &&
        !isNaN(usePctNum) &&
        mount &&
        !mount.startsWith("none") &&
        !mount.includes("snap") &&
        !mount.includes("boot")
      ) {
        result.push({
          mount: mount,
          size_gb: Math.round(sizeGb * 100) / 100,
          used_gb: Math.round(usedGb * 100) / 100,
          available_gb: Math.round(availGb * 100) / 100,
          use_pct: Math.round(usePctNum * 100) / 100,
          path: mount,
        });
      }
    }
  }
  return result;
}

export const list = os.output(z.array(DiskUsageSchema)).handler(async () => {
  return getDiskUsage();
});

async function getDiskUsage(): Promise<z.infer<typeof DiskUsageSchema>[]> {
  try {
    const { stdout } = await execAsync("df -B1 --output=target,size,used,avail,pcent 2>/dev/null");
    return parseDfOutput(stdout);
  } catch {
    return [];
  }
}
