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
    const commands = result.processes.map((p) => p.command);
    expect(commands).not.contain("/PID/%CPU/%MEM/COMMAND"); // Header shouldn't be included
  });

  describe("Linux 11-column ps aux format", () => {
    const fullPsAux = `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 168952 13468 ?        Ss   Jun04   0:03 /sbin/init splash
jix         1234 55.5  2.3 723456 89123 ?        Rl   10:15   5:45 python3 -m flask run --port 5000
jix         5678 12.3  1.5 456789 45678 ?        S    10:16   2:30 nvml-top --interval 1
app         9012  8.7  0.8 234567 23456 ?        Ssl  10:10   1:15 node /app/server.js
root         345  5.2  0.3 123456  5678 ?        Ss   10:01   0:30 sshd: root@pts/0
nobody       678  2.1  0.1  98765  1234 ?        S    10:05   0:10 nginx: worker process
`;

    it("parses 11-column ps aux into structured process list", () => {
      const result = normalizeProcessList(fullPsAux);

      expect(result).toEqual({
        timestamp: expect.any(Number),
        processes: [
          {
            user: "jix",
            pid: 1234,
            cpu: 55.5,
            mem: 2.3,
            command: "python3 -m flask run --port 5000",
          },
          { user: "jix", pid: 5678, cpu: 12.3, mem: 1.5, command: "nvml-top --interval 1" },
          { user: "app", pid: 9012, cpu: 8.7, mem: 0.8, command: "node /app/server.js" },
          { user: "root", pid: 345, cpu: 5.2, mem: 0.3, command: "sshd: root@pts/0" },
          { user: "nobody", pid: 678, cpu: 2.1, mem: 0.1, command: "nginx: worker process" },
        ],
      });
    });

    it("correctly extracts command with spaces from 11-column format", () => {
      const result = normalizeProcessList(fullPsAux);
      expect(result.processes[0].command).toBe("python3 -m flask run --port 5000");
      expect(result.processes[0].cpu).toBe(55.5);
    });
  });

  describe("NaN filtering", () => {
    it("filters out entries with non-numeric CPU", () => {
      const input = `USER       PID %CPU %MEM    COMMAND
root         1  0.0  0.1  /sbin/init
bad        999  N/A  2.0  broken process
`;
      const result = normalizeProcessList(input);
      expect(result.processes).toHaveLength(1);
      expect(result.processes[0].pid).toBe(1);
      expect(result.processes.every((p) => !isNaN(p.cpu))).toBe(true);
    });

    it("filters out entries with non-numeric MEM", () => {
      const input = `USER       PID %CPU %MEM    COMMAND
root         1  0.0  0.1  /sbin/init
bad        999  2.0  N/A  broken process
`;
      const result = normalizeProcessList(input);
      expect(result.processes).toHaveLength(1);
      expect(result.processes[0].pid).toBe(1);
      expect(result.processes.every((p) => !isNaN(p.mem))).toBe(true);
    });
  });
});
