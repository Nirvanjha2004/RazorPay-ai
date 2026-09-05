/**
 * Decision logging for all agents -> audit_logs (Prisma `AuditLog` table).
 *
 * Mapping: agent_name -> agentType, amount -> amountInPaise,
 * timestamp -> createdAt (Prisma default), session -> requestId.
 */

import { prisma } from "@/lib/db";

export interface AgentDecisionLog {
  agentName: string;
  action: string;
  status: string; // SUCCESS | FAILED | BLOCKED | APPROVED | NEEDS_APPROVAL | ...
  reasoning: string;
  amountInPaise?: number | null;
  sessionId: string;
  meta?: Record<string, unknown> | null;
}

export async function logAgentDecision(entry: AgentDecisionLog): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        agentType: entry.agentName,
        action: entry.action,
        status: entry.status,
        reasoning: entry.reasoning,
        amountInPaise: entry.amountInPaise ?? null,
        requestId: entry.sessionId,
        input: JSON.stringify({ sessionId: entry.sessionId, ...(entry.meta ?? {}) }),
      },
    });
  } catch (error) {
    // Never let audit failures crash an agent — but make them loud.
    console.error("[audit] failed to persist agent decision:", error);
  }
}
