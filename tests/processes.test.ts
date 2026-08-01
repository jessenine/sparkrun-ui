import { describe, expect, it } from "vitest";
import { normalizeProcessList } from "@/lib/rpc/procedures/processes";

describe("normalizeProcessList", () => {
  const samplePsAuxOutput = `USER       PID %CPU %MEM    COMMAND
root         1  0.0  0.1  /sbin/init
jix       1234 45.5  2.3  python3 -m flask run
jix       5678 12.3  1.5  nvml-top --interval 1
app       9012  8.7  0.8  node /app/server.js
root       345  5.2  0.3  sshd: root@pts/0
nobody     678  2.1  0.1  nginx: worker process
`;

  it("parses ps aux output into structured process list", () => {
    const result = normalizeProcessList(samplePsAuxOutput);
    
    expect(result).toEqual({
      timestamp: expect.any(Number),
      processes: [
        { user: "jix", pid: 1234, cpu: 45.5, mem: 2.3, command: "python3 -m flask run" },
        { user: "jix", pid: 5678, cpu: 12.3, mem: 1.5, command: "nvml-top --interval 1" },
        { user: "app", pid: 9012, cpu: 8.7, mem: 0.8, command: "node /app/server.js" },
        { user: "root", pid: 345, cpu: 5.2, mem: 0.3, command: "sshd: root@pts/0" },
        { user: "nobody", pid: 678, cpu: 2.1, mem: 0.1, command: "nginx: worker process" },
      ],
    });
  });

  it("sorts processes by CPU descending (top 5)", () => {
    const result = normalizeProcessList(samplePsAuxOutput);
    
    expect(result.processes).toHaveLength(5); // Only top 5
    expect(result.processes[0].cpu).toBe(45.5);
    expect(result.processes[1].cpu).toBe(12.3);
    expect(result.processes[2].cpu).toBe(8.7);
    expect(result.processes[3].cpu).toBe(5.2);
    expect(result.processes[4].cpu).toBe(2.1);
  });

  it("handles empty input", () => {
    const result = normalizeProcessList("");
    expect(result.processes).toHaveLength(0);
  });

  it("handles single process", () => {
    const result = normalizeProcessList(`USER       PID %CPU %MEM    COMMAND
root         1  0.0  0.1  /sbin/init
`);
    expect(result.processes).toHaveLength(1);
    expect(result.processes[0].command).toBe("/sbin/init");
  });

  it("filters out header row correctly", () => {
    const result = normalizeProcessList(samplePsAuxOutput);
    const commands = result.processes.map(p => p.command);
    expect(commands).not.contain("/PID/%CPU/%MEM/COMMAND"); // Header shouldn't be included
  });
});
