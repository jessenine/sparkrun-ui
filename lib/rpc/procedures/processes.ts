// Process list entry from `ps aux`
export interface ProcessEntry {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  command: string;
}

// Normalized process list output
export interface ProcessList {
  timestamp: number;
  processes: ProcessEntry[];
}

/**
 * Parse `ps aux` output and normalize into structured format.
 * Returns top 5 processes sorted by CPU usage descending.
 */
export function normalizeProcessList(psAuxOutput: string): ProcessList {
  const lines = psAuxOutput.trim().split("\n");
  
  // Skip header row
  const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
  
  const processes: ProcessEntry[] = [];
  
  for (const line of dataLines) {
    // Format: USER PID %CPU %MEM COMMAND
    // Command may contain spaces, so we parse from the end
    const parts = line.trim().split(/\s+/);
    
    if (parts.length < 5) continue;
    
    const user = parts[0];
    const pid = parseInt(parts[1], 10);
    const cpu = parseFloat(parts[2]);
    const mem = parseFloat(parts[3]);
    
    // Command is everything after the first 4 fields
    const commandStartIndex = line.indexOf(parts[4]);
    const command = commandStartIndex >= 0 ? line.substring(commandStartIndex).trim() : "";
    
    processes.push({ user, pid, cpu, mem, command });
  }
  
  // Sort by CPU descending and take top 5
  processes.sort((a, b) => b.cpu - a.cpu);
  
  return {
    timestamp: Date.now(),
    processes: processes.slice(0, 5),
  };
}
