import { NextRequest, NextResponse } from "next/server";
import { runSparkrunJson } from "@/lib/sparkrun";
import { z } from "zod";

const JobSchema = z.object({
  cluster_id: z.string(),
  recipe: z.string().optional(),
  host: z.string().optional(),
  port: z.string().optional(),
  status: z.string().optional(),
});

const ClusterStatusSchema = z.object({
  solo_entries: z.array(JobSchema),
});

export async function POST(request: NextRequest) {
  try {
    const data = await runSparkrunJson<z.infer<typeof ClusterStatusSchema>>(
      ["cluster", "list", "--json"]
    );
    
    const validated = ClusterStatusSchema.parse(data);
    
    return NextResponse.json({ jobs: validated.solo_entries });
  } catch (err) {
    console.error("[api/jobs/error]", err);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
