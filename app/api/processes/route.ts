import { NextRequest, NextResponse } from "next/server";
import { streamSparkrunNdjson } from "@/lib/sparkrun";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hosts = body?.hosts ?? [];
    
    const args = ["cluster", "monitor", "--json", "--interval", "2"];
    if (hosts.length > 0) {
      args.push("--hosts", hosts.join(","));
    }
    
    const processes: Array<{ host: string; entries: Array<{ pid: string; user: string; cpu: string; mem: string; command: string }> }> = [];
    
    for await (const obj of streamSparkrunNdjson<Record<string, unknown>>(args)) {
      try {
        if (obj.hosts && typeof obj.hosts === "object") {
          for (const [host, data] of Object.entries(obj.hosts as Record<string, any>)) {
            if (data && typeof data === "object" && "processes" in data) {
              const procRaw = data.processes;
              if (Array.isArray(procRaw)) {
                processes.push({
                  host,
                  entries: procRaw.map((p: any) => ({
                    pid: String(p.pid ?? ""),
                    user: String(p.user ?? ""),
                    cpu: String(p.cpu ?? ""),
                    mem: String(p.mem ?? ""),
                    command: String(p.command ?? ""),
                  })),
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Process parsing error:", err);
        continue;
      }
    }
    
    return NextResponse.json({ processes });
  } catch (err) {
    console.error("[api/processes/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch process data" },
      { status: 500 }
    );
  }
}
