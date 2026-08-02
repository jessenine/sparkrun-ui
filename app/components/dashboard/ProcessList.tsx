// Placeholder component - to be implemented
// app/components/dashboard/ProcessList.tsx

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
}

export function ProcessList({ 
  title = "Top Processes",
  processes, 
  onProcessClick,
  className = ""
}: ProcessListProps) {
  // TODO: Implement visual component
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h3>
      {processes.length === 0 ? (
        <p className="text-xs text-zinc-500">No process data available</p>
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
              {processes.slice(0, 5).map((p, i) => (
                <tr 
                  key={p.pid} 
                  className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                  onClick={() => onProcessClick?.(p)}
                >
                  <td className="py-1 text-zinc-600 dark:text-zinc-400 font-mono">{p.user}</td>
                  <td className="py-1 text-zinc-600 dark:text-zinc-400 text-right font-mono">{p.pid}</td>
                  <td className="py-1 text-zinc-600 dark:text-zinc-400 text-right font-mono">{typeof p.cpu === "number" ? p.cpu.toFixed(1) : "0.0"}</td>
                  <td className="py-1 text-zinc-600 dark:text-zinc-400 text-right font-mono">{typeof p.mem === "number" ? p.mem.toFixed(1) : "0.0"}</td>
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
  );
}
