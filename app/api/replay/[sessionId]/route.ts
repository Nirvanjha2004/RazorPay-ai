import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/replay/[sessionId]
 * Aggregates audit logs for a session into an ordered step list for replay.
 */
export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;

  const logs = await prisma.auditLog.findMany({
    where: { requestId: sessionId },
    orderBy: { createdAt: "asc" },
  });

  // Fallback: if no audit logs match, try chat session messages
  if (logs.length === 0) {
    const chat = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (chat) {
      const messages = JSON.parse(chat.messagesJson ?? "[]") as Array<{
        role: string;
        content: string;
        at: string;
      }>;
      return NextResponse.json({
        sessionId,
        source: "chat",
        steps: messages.map((m, i) => ({
          id: `msg_${i}`,
          at: m.at,
          agent: m.role === "user" ? "CUSTOMER" : "SYSTEM",
          action: m.role === "user" ? "user_message" : "agent_message",
          amount: null,
          status: "SUCCESS" as const,
          reasoning: m.content,
          error: null,
        })),
      });
    }
  }

  // Fallback: buyer run
  if (logs.length === 0) {
    const run = await prisma.buyerRun.findUnique({ where: { id: sessionId } });
    if (run) {
      const steps = JSON.parse(run.stepsJson ?? "[]") as Array<{
        at: string;
        agent: string;
        action: string;
        amount?: number | null;
        status: string;
        reasoning?: string | null;
        error?: string | null;
      }>;
      return NextResponse.json({
        sessionId,
        source: "buyer",
        steps: steps.map((s, i) => ({
          id: `buyer_${i}`,
          at: s.at,
          agent: s.agent ?? "BUYER",
          action: s.action ?? "step",
          amount: s.amount ?? null,
          status: (["SUCCESS", "BLOCKED", "FAILED", "APPROVED", "NEEDS_APPROVAL"].includes(s.status)
            ? s.status
            : "SUCCESS") as "SUCCESS" | "BLOCKED" | "FAILED" | "APPROVED" | "NEEDS_APPROVAL",
          reasoning: s.reasoning ?? null,
          error: s.error ?? null,
        })),
      });
    }
  }

  return NextResponse.json({
    sessionId,
    source: "audit",
    steps: logs.map((log) => ({
      id: log.id,
      at: log.createdAt.toISOString(),
      agent: log.agentType,
      action: log.action,
      amount: log.amountInPaise,
      status: log.status as "SUCCESS" | "BLOCKED" | "FAILED" | "APPROVED" | "NEEDS_APPROVAL",
      reasoning: log.reasoning ?? log.output ?? log.blockedReason ?? null,
      error: log.error ?? null,
    })),
  });
}
