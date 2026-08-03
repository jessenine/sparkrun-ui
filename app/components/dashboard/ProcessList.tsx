import { useState } from "react";
import { Dialog } from "@/app/components/ui/Dialog";

export interface ProcessEntry {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  command: string;
}

export interface ProcessListProps {
  title?: string;
  processes: ProcessEntry[];
  onProcessClick?: (process: ProcessEntry) => void;
  className?: string;
  loading?: boolean;
}

export function ProcessList({
  title = "Top Processes",
  processes,
  onProcessClick,
  className = "",
  loading = false,
}: ProcessListProps) {
  const [sortBy, setSortBy] = useState<"cpu" | "mem">("cpu");
  const [selectedProcess, setSelectedProcess] = useState<ProcessEntry | null>(null);

  // Sort processes by selected metric (descending)
  const sortedProcesses = [...processes].sort((a, b) => {
    if (sortBy === "cpu") {
      return b.cpu - a.cpu;
    } else {
      return b.mem - a.mem;
    }
  });

  const handleProcessClick = (process: ProcessEntry) => {
    setSelectedProcess(process);
    onProcessClick?.(process);
  };

  const handleCloseModal = () => {
    setSelectedProcess(null);
  };

  return (
    <>
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort by:</span>
            <button
              onClick={() => setSortBy("cpu")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "cpu"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              CPU
            </button>
            <button
              onClick={() => setSortBy("mem")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "mem"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              MEM
            </button>
          </div>
        </div>
        {processes.length === 0 ? (
          <p className="text-xs text-zinc-500">No process data available</p>
        ) : loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-300 border-t-transparent animate-spin" />
            <span className="ml-2 text-xs text-zinc-500">Loading process data...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="text-left py-1">USER</th>
                  <th className="text-right py-1">PID</th>
                  <th className="text-right py-1">CPU%</th>
                  <th className="text-right py-1">MEM%</th>
                  <th className="text-left py-1">COMMAND</th>
                </tr>
              </thead>
              <tbody>
                {sortedProcesses.slice(0, 5).map((p) => (
                  <tr
                    key={p.pid}
                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() => handleProcessClick(p)}
                  >
                    <td className="py-1 text-zinc-600 dark:text-zinc-400 font-mono">{p.user}</td>
                    <td className="py-1 text-zinc-600 dark:text-zinc-400 text-right font-mono">{p.pid}</td>
                    <td className="py-1 text-zinc-600 dark:text-zinc-400 text-right font-mono">{p.cpu.toFixed(1)}</td>
                    <td className="py-1 text-zinc-600 dark:text-zinc-400 text-right font-mono">{p.mem.toFixed(1)}</td>
                    <td className="py-1 text-zinc-900 dark:text-zinc-100 font-mono truncate" title={p.command}>
                      {p.command}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for full process details */}
      {selectedProcess && (
        <Dialog open={true} onOpenChange={handleCloseModal}>
          <Dialog.Content
            title={`Process: ${selectedProcess.command}`}
            description="Full process details from ps aux output"
            size="lg"
          >
            <Dialog.Body>
              <div className="font-mono text-xs whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                {formatProcessDetails(selectedProcess)}
              </div>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog>
      )}
    </>
  );
}

function formatProcessDetails(process: ProcessEntry): string {
  return `USER: ${process.user}
PID: ${process.pid}
CPU: ${process.cpu.toFixed(1)}%
MEM: ${process.mem.toFixed(1)}%
COMMAND: ${process.command}

Full ps aux output would show additional details like:
- START time
- TIME CPU usage
- TTY terminal
- STAT process state
- RSS resident set size`;
}
