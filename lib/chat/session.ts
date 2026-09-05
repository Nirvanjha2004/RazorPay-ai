/**
 * Persisted conversation state for the conversational checkout.
 * Stored in the ChatSession table (sessions table).
 */

import { prisma } from "@/lib/db";
import type { CartItem, UpsellSuggestion } from "@/lib/agents/multiagent/types";

export type ChatPhase =
  | "BROWSING"
  | "AWAITING_CONFIRMATION"
  | "AWAITING_APPROVAL"
  | "AWAITING_PAYMENT"
  | "FALLBACK_LINK_SENT"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ChatContext {
  selectedProductId?: string;
  /** Guardian demanded human approval — user must reply "approve". */
  pendingApproval?: { action: string; amountInPaise: number; reason: string } | null;
  /** Demo flag: forces the next payment attempts to fail (consumed after use). */
  simulatePaymentFailure?: boolean;
  orderId?: string;
  paymentLinkUrl?: string;
  paymentAttempts?: { attempt: number; error: string }[];
}

export interface ChatSessionData {
  sessionId: string;
  phase: ChatPhase;
  cart: CartItem[];
  upsell: UpsellSuggestion | null;
  context: ChatContext;
  messages: ChatMessage[];
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toPhase(raw: string | null | undefined): ChatPhase {
  const valid: ChatPhase[] = [
    "BROWSING",
    "AWAITING_CONFIRMATION",
    "AWAITING_APPROVAL",
    "AWAITING_PAYMENT",
    "FALLBACK_LINK_SENT",
    "COMPLETED",
    "BLOCKED",
    "FAILED",
  ];
  return valid.includes(raw as ChatPhase) ? (raw as ChatPhase) : "BROWSING";
}

/** Load a chat session, creating a blank one when it doesn't exist. */
export async function loadChatSession(sessionId: string): Promise<ChatSessionData> {
  const row = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (row) {
    return {
      sessionId: row.id,
      phase: toPhase(row.phase),
      cart: parseJson<CartItem[]>(row.cartJson, []),
      upsell: parseJson<UpsellSuggestion | null>(row.upsellJson, null),
      context: parseJson<ChatContext>(row.contextJson, {}),
      messages: parseJson<ChatMessage[]>(row.messagesJson, []),
    };
  }
  return { sessionId, phase: "BROWSING", cart: [], upsell: null, context: {}, messages: [] };
}

export async function saveChatSession(session: ChatSessionData): Promise<void> {
  const data = {
    phase: session.phase,
    cartJson: JSON.stringify(session.cart),
    upsellJson: session.upsell ? JSON.stringify(session.upsell) : null,
    contextJson: JSON.stringify(session.context),
    messagesJson: JSON.stringify(session.messages.slice(-50)), // keep it bounded
  };
  await prisma.chatSession.upsert({
    where: { id: session.sessionId },
    update: data,
    create: { id: session.sessionId, ...data },
  });
}
