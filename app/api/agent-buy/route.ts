import { NextResponse } from "next/server";
import { runBuyerRun } from "@/lib/buyer/agent";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent-buy — the AI Buyer transacts on a natural-language request.
 * Body: { request: string }
 * Returns the run's `replayId`, ordered `steps` (streaming log), and summary.
 */
export async function POST(request: Request) {
  let body: { request?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestText = body?.request?.trim();
  if (!requestText) {
    return NextResponse.json({ error: "`request` is required" }, { status: 400 });
  }
  if (requestText.length > 500) {
    return NextResponse.json({ error: "`request` too long (max 500 chars)" }, { status: 400 });
  }

  try {
    const { replayId, steps, summary } = await runBuyerRun(requestText);
    if (!replayId) {
      return NextResponse.json({ error: summary.guardian.reason, steps, summary }, { status: 400 });
    }
    return NextResponse.json({ replayId, sessionId: summary.sessionId, steps, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/agent-buy] failed:", message);
    return NextResponse.json({ error: "Buyer run failed" }, { status: 500 });
  }
}