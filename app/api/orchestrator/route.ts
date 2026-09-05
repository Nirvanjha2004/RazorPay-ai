import { NextResponse } from "next/server";
import { getOrchestrator } from "@/lib/agents/orchestrator";

export const dynamic = "force-dynamic";

function statusForPhase(phase: string): number {
  switch (phase) {
    case "COMPLETED":
      return 200;
    case "AWAITING_HUMAN_APPROVAL":
      return 202; // paused — needs human decision
    case "BLOCKED":
      return 403;
    case "FAILED":
      return 502;
    default:
      return 200;
  }
}

/**
 * POST /api/orchestrator — run the multi-agent state machine.
 *
 * Body (start):  { "action": "start", "items": [{ "product_id": "...", "quantity": 1 }] }
 * Body (resume): { "action": "resume", "session_id": "sess_...", "approved": true }
 */
export async function POST(request: Request) {
  let body: {
    action?: string;
    items?: { product_id?: string; quantity?: number }[];
    session_id?: string;
    approved?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orchestrator = getOrchestrator();

  if (body?.action === "resume") {
    if (!body.session_id || typeof body.approved !== "boolean") {
      return NextResponse.json(
        { error: "resume requires `session_id` (string) and `approved` (boolean)" },
        { status: 400 }
      );
    }
    const state = await orchestrator.resume(body.session_id, body.approved);
    if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
    return NextResponse.json(state, { status: statusForPhase(state.phase) });
  }

  // Default action: start
  const items = (body?.items ?? [])
    .filter((item) => item && typeof item.product_id === "string")
    .map((item) => ({ productId: item.product_id as string, quantity: item.quantity }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "`items` must be a non-empty array of { product_id, quantity? }" },
      { status: 400 }
    );
  }

  const state = await orchestrator.start(items);
  return NextResponse.json(state, { status: statusForPhase(state.phase) });
}

/** GET /api/orchestrator?session_id=sess_... — fetch a session snapshot. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "`session_id` query param is required" }, { status: 400 });
  }
  const state = getOrchestrator().get(sessionId);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  return NextResponse.json(state);
}
