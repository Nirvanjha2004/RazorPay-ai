import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadChatSession } from "@/lib/chat/session";
import {
  getGuardian,
  MAX_SESSION_ORDERS,
  MAX_SESSION_SPEND_PAISE,
} from "@/lib/agents/multiagent/guardian";

export const dynamic = "force-dynamic";

interface FeedEntry {
  id: string;
  at: string;
  agent: string;
  text: string;
  status?: string;
}

/**
 * GET /api/chat/stream?sessionId=... — polling endpoint that powers the
 * terminal dashboard: merged agent/customer feed + guardian session status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "`sessionId` query param is required" }, { status: 400 });
  }

  const session = await loadChatSession(sessionId);
  const feed: FeedEntry[] = [];

  // 1. Customer / shop conversation -----------------------------------------
  session.messages.forEach((message, index) => {
    feed.push({
      id: `msg-${index}`,
      at: message.at,
      agent: message.role === "user" ? "CUSTOMER" : "SYSTEM",
      text: message.content,
    });
  });

  // 2. Agent decisions from the audit trail ----------------------------------
  const decisions = await prisma.auditLog.findMany({
    where: {
      requestId: sessionId,
      agentType: { in: ["GROWTH", "CHECKOUT", "GUARDIAN", "SYSTEM"] },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  for (const row of decisions) {
    const detail = row.reasoning ?? row.blockedReason ?? row.error ?? row.output ?? "";
    feed.push({
      id: row.id,
      at: row.createdAt.toISOString(),
      agent: row.agentType,
      text: [row.action, detail].filter(Boolean).join(" — "),
      status: row.status,
    });
  }

  feed.sort((a, b) => a.at.localeCompare(b.at));

  // 3. Guardian session status ------------------------------------------------
  const ledger = getGuardian().getSessionSpend(sessionId);

  return NextResponse.json({
    sessionId,
    phase: session.phase,
    feed,
    guardian: {
      spendPaise: ledger.spendPaise,
      orderCount: ledger.orderCount,
      maxSpendPaise: MAX_SESSION_SPEND_PAISE,
      maxOrders: MAX_SESSION_ORDERS,
      pendingApproval: session.context.pendingApproval ?? null,
    },
  });
}
