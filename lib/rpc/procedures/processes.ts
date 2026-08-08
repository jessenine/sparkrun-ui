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
 *
 * Real `ps aux` columns:
 *   USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
 * Commands may contain spaces, so we find the 10th delimiter
 * and take the rest as the command.
 */
export function normalizeProcessList(psAuxOutput: string): ProcessList {
  const lines = psAuxOutput.trim().split("\n");

  // Skip header row
  const dataLines = lines.slice(1).filter((line) => line.trim().length > 0);

  const processes: ProcessEntry[] = [];

  for (const line of dataLines) {
    // `ps aux` output has two possible formats:
    //
    // Short (used in tests, some macOS): USER PID %CPU %MEM COMMAND
    // Full (standard Linux):            USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
    //
    // The command is always the last field and may contain spaces.
    // Fields 0-3 are always: USER, PID, %CPU, %MEM.
    //
    // Strategy: fields 0-3 parsed by position, command is everything
    // after field 3 (short) or after field 9 (full). We detect the
    // format by counting headers from the first data line.
    const parts = line.trim().split(/\s+/);

    if (parts.length < 5) continue;

    const user = parts[0];
    const pid = parseInt(parts[1], 10);
    const cpu = parseFloat(parts[2]);
    const mem = parseFloat(parts[3]);

    // Detect format by checking if field 4 looks like a number (VSZ) or text (start of command)
    // VSZ is always a positive integer; command could be anything
    // This heuristic handles both short and full ps aux formats
    const field4IsVsz = /^\d+$/.test(parts[4]);

    let command: string;
    if (field4IsVsz && parts.length >= 11) {
      // Full ps aux: fields 0-3 = USER PID %CPU %MEM, fields 4-9 = VSZ RSS TTY STAT START TIME
      // Command is everything from the 10th field onward
      let fieldCount = 0;
      let commandStart = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === " " || line[i] === "\t") {
          while (i + 1 < line.length && (line[i + 1] === " " || line[i + 1] === "\t")) i++;
          fieldCount++;
          if (fieldCount === 10) {
            commandStart = i + 1;
            break;
          }
        }
      }
      command = line.substring(commandStart).trim();
    } else {
      // Short ps aux: fields 0-3 = USER PID %CPU %MEM, field 4 onward = command
      const commandStartIndex = line.indexOf(parts[4]);
      command = commandStartIndex >= 0 ? line.substring(commandStartIndex).trim() : "";
    }

    // Filter out NaN cpu/mem values to prevent downstream crashes
    if (isNaN(cpu) || isNaN(mem)) continue;

    processes.push({ user, pid, cpu, mem, command });
  }

  // Sort by CPU descending and take top 5
  processes.sort((a, b) => b.cpu - a.cpu);

  return {
    timestamp: Date.now(),
    processes: processes.slice(0, 5),
  };
}
