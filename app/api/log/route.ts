import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const msg = url.searchParams.get("msg") || "no msg";
  console.log(`[API LOG] ${msg}`);
  return NextResponse.json({ ok: true });
}
