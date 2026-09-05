import { NextResponse } from "next/server";
import { approveBuyerRun } from "@/lib/buyer/agent";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent-buy/[id]/approve — human decision on a paused buyer run.
 * Body: { approved: boolean }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: { approved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body?.approved !== "boolean") {
    return NextResponse.json({ error: "`approved` (boolean) is required" }, { status: 400 });
  }

  const result = await approveBuyerRun(params.id, body.approved);
  if (!result) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ replayId: params.id, steps: result.steps, summary: result.summary });
}