import { NextResponse } from "next/server";
import { loadChatSession, saveChatSession } from "@/lib/chat/session";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/simulate-payment-failure — demo helper.
 * Body: { sessionId: string }
 * Arms the failure flag so the next payment flow in this session fails
 * on both attempts, forcing the payment-link fallback path.
 */
export async function POST(request: Request) {
  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "`sessionId` is required" }, { status: 400 });
  }

  const session = await loadChatSession(sessionId);
  session.context.simulatePaymentFailure = true;
  await saveChatSession(session);

  await logAgentDecision({
    agentName: "SYSTEM",
    action: "simulate_payment_failure",
    status: "SUCCESS",
    reasoning: "Demo flag armed: next payment attempts in this session will be forced to fail",
    sessionId,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    simulatePaymentFailure: true,
    note: "Next checkout in this session will fail twice, then fall back to a Razorpay payment link.",
  });
}
