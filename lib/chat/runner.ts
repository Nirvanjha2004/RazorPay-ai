/**
 * Conversational checkout state machine (POST /api/chat).
 *
 *   BROWSING              user asks for a product -> GROWTH confirms + upsells
 *   AWAITING_CONFIRMATION user replies yes/no to the upsell
 *   AWAITING_APPROVAL     guardian paused the session -> user replies "approve"
 *   AWAITING_PAYMENT      order created; webhook will mark it PAID
 *   FALLBACK_LINK_SENT    payment failed twice -> payment link sent
 *   BLOCKED / FAILED      guardian block / graceful payment failure
 *
 * All state is persisted in the sessions (ChatSession) table; every agent
 * decision is audited.
 */

import { prisma } from "@/lib/db";
import { runGrowthAgent } from "@/lib/agents/multiagent/growth";
import { getGuardian, GuardianAgent } from "@/lib/agents/multiagent/guardian";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import { findBestProduct } from "@/lib/chat/matcher";
import { executePaymentFlow, type PaymentFlowResult } from "@/lib/chat/payment";
import { loadChatSession, saveChatSession, type ChatSessionData } from "@/lib/chat/session";
import { formatINR } from "@/lib/utils";

const YES_RE = /^(y|yes|yep|yeah|sure|ok|okay|haan|add it|add)\b/i;
const NO_RE = /^(n|no|nope|nahi|skip|without|later)\b/i;
const APPROVE_RE = /(approve|approved|confirm|go ahead|proceed)/i;
const CANCEL_RE = /(cancel|abort|stop|forget it)/i;

export interface ChatResponse {
  sessionId: string;
  phase: string;
  messages: string[];
  cart: { productId: string; name: string; priceInPaise: number; quantity: number }[];
  upsell: { productId: string; name: string; priceInPaise: number; reason: string } | null;
  orderId?: string;
  paymentLinkUrl?: string;
  paymentAttempts?: { attempt: number; error: string }[];
}

function reply(session: ChatSessionData, messages: string[]): void {
  for (const content of messages) {
    session.messages.push({ role: "assistant", content, at: new Date().toISOString() });
  }
}

function cartTotal(session: ChatSessionData): number {
  return session.cart.reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0);
}

/** Phase BROWSING: understand the request, confirm product, suggest upsell. */
async function handleBrowse(
  session: ChatSessionData,
  message: string,
  out: string[],
  guardian: GuardianAgent
): Promise<void> {
  const { product, alternatives } = await findBestProduct(message);
  if (!product) {
    const catalog = await (await import("@/lib/catalog")).buildAgentCatalog();
    const inStock = catalog.products.filter((p) => p.availability !== "out_of_stock");
    out.push(
      `I couldn't find that in our coffee equipment store. Here's what we have: ${inStock
        .slice(0, 6)
        .map((p) => `${p.name} (${p.price_display})`)
        .join(", ")}. What would you like?`
    );
    return;
  }

  // Restart the cart with the newly selected product.
  session.cart = [
    { productId: product.id, name: product.name, priceInPaise: product.price_in_paise, quantity: 1 },
  ];
  session.context.selectedProductId = product.id;

  const total = cartTotal(session);
  const growth = await runGrowthAgent(session.sessionId, session.cart, total);
  session.upsell = growth.suggestion;
  session.phase = "AWAITING_CONFIRMATION";

  out.push(`Great choice! I found the ${product.name} at ${product.price_display} (in stock).`);
  if (session.upsell) {
    out.push(
      `Would you like to add the ${session.upsell.name} for ${formatINR(
        session.upsell.priceInPaise
      )}? ${session.upsell.reason} (reply yes / no)`
    );
  } else {
    out.push("Reply 'buy' to check out now.");
  }
  void alternatives; // kept for future "did you mean" flows
  void guardian;
}

/** Run the guardian gate, then the payment flow; compose the chat reply. */
async function proceedToCheckout(
  session: ChatSessionData,
  out: string[],
  guardian: GuardianAgent
): Promise<void> {
  const amount = cartTotal(session);
  const verdict = await guardian.review({
    sessionId: session.sessionId,
    action: "checkout_session",
    amountInPaise: amount,
    productIds: session.cart.map((item) => item.productId),
  });

  if (verdict.decision === "BLOCKED") {
    session.phase = "BLOCKED";
    out.push(`I'm sorry, I can't complete this order: ${verdict.reason}`);
    return;
  }
  if (verdict.decision === "NEEDS_APPROVAL") {
    session.phase = "AWAITING_APPROVAL";
    session.context.pendingApproval = {
      action: "checkout_session",
      amountInPaise: amount,
      reason: verdict.reason,
    };
    out.push(
      `This order is ${formatINR(amount)} — ${verdict.reason}. A human supervisor needs to approve it: reply 'approve' to continue or 'cancel' to abort.`
    );
    return;
  }

  out.push(`Guardian approved the order (${formatINR(amount)}). Creating your order…`);
  const result = await executePaymentFlow(session, guardian);
  applyPaymentResult(session, result, out);
}

/** Map a PaymentFlowResult onto the session state + reply. */
function applyPaymentResult(
  session: ChatSessionData,
  result: PaymentFlowResult,
  out: string[]
): void {
  session.context.paymentAttempts = result.attempts;
  if (result.status === "ORDER_CREATED") {
    session.phase = "AWAITING_PAYMENT";
    session.context.orderId = result.orderId;
    out.push(
      `${result.message} You'll get payment updates here — I'll confirm as soon as it's captured.`
    );
  } else if (result.status === "LINK_SENT") {
    session.phase = "FALLBACK_LINK_SENT";
    session.context.paymentLinkUrl = result.paymentLinkUrl;
    out.push(result.message);
  } else if (result.status === "NEEDS_APPROVAL") {
    session.phase = "AWAITING_APPROVAL";
    session.context.pendingApproval = result.pendingApproval ?? null;
    out.push(`${result.message} Reply 'approve' to continue.`);
  } else {
    session.phase = "FAILED";
    const attemptSummary = result.attempts
      .map((a) => `attempt ${a.attempt}: ${a.error}`)
      .join("; ");
    out.push(`${result.message} (attempts — ${attemptSummary})`);
  }
}

/** Phase AWAITING_CONFIRMATION: yes/no on the upsell, then checkout. */
async function handleConfirmation(
  session: ChatSessionData,
  message: string,
  out: string[],
  guardian: GuardianAgent
): Promise<void> {
  if (YES_RE.test(message) && session.upsell) {
    const already = session.cart.some((item) => item.productId === session.upsell!.productId);
    if (!already) {
      session.cart.push({
        productId: session.upsell.productId,
        name: session.upsell.name,
        priceInPaise: session.upsell.priceInPaise,
        quantity: 1,
      });
    }
    out.push(`Added the ${session.upsell.name}.`);
  } else if (NO_RE.test(message)) {
    out.push("No problem, skipping the extra item.");
  } else if (!/(buy|checkout|check out|proceed|order)/i.test(message)) {
    out.push("Just reply 'yes' to add the extra item or 'no' to skip it.");
    return;
  }

  session.upsell = null;
  await proceedToCheckout(session, out, guardian);
}

/** Phase AWAITING_APPROVAL: user approves or cancels the paused action. */
async function handleApproval(
  session: ChatSessionData,
  message: string,
  out: string[],
  guardian: GuardianAgent
): Promise<void> {
  const pending = session.context.pendingApproval;
  if (CANCEL_RE.test(message)) {
    session.phase = "BLOCKED";
    session.context.pendingApproval = null;
    out.push("Okay, I've cancelled that order. Anything else I can help with?");
    return;
  }
  if (!APPROVE_RE.test(message) || !pending) {
    out.push("Reply 'approve' to continue with this order, or 'cancel' to abort.");
    return;
  }

  await guardian.recordApproval(session.sessionId, pending.amountInPaise, true);
  session.context.pendingApproval = null;
  const result = await executePaymentFlow(session, guardian);
  applyPaymentResult(session, result, out);
}

/** Phase AWAITING_PAYMENT / terminal phases: status queries or a new order. */
async function handlePostPurchase(
  session: ChatSessionData,
  message: string,
  out: string[],
  guardian: GuardianAgent
): Promise<void> {
  if (/status|order|paid|payment/i.test(message) && session.context.orderId) {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: session.context.orderId },
    });
    out.push(
      order
        ? `Your order ${order.razorpayOrderId} is currently: ${order.status}.`
        : `I couldn't find order ${session.context.orderId} anymore.`
    );
    return;
  }

  // Any other message starts a fresh purchase.
  session.phase = "BROWSING";
  session.cart = [];
  session.upsell = null;
  session.context.orderId = undefined;
  session.context.paymentLinkUrl = undefined;
  await handleBrowse(session, message, out, guardian);
}

/**
 * Main entry point: process one user message and return the agent replies.
 */
export async function handleChatMessage(
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const guardian = getGuardian();
  const session = await loadChatSession(sessionId);
  session.messages.push({ role: "user", content: message, at: new Date().toISOString() });

  const out: string[] = [];
  try {
    switch (session.phase) {
      case "BROWSING":
        await handleBrowse(session, message, out, guardian);
        break;
      case "AWAITING_CONFIRMATION":
        await handleConfirmation(session, message, out, guardian);
        break;
      case "AWAITING_APPROVAL":
        await handleApproval(session, message, out, guardian);
        break;
      default:
        await handlePostPurchase(session, message, out, guardian);
        break;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    session.phase = "FAILED";
    out.push(`Something went wrong on our side: ${msg}. Please try again.`);
    await logAgentDecision({
      agentName: "SYSTEM",
      action: "chat_error",
      status: "FAILED",
      reasoning: msg,
      sessionId: session.sessionId,
    });
  }

  reply(session, out);
  await saveChatSession(session);

  return {
    sessionId: session.sessionId,
    phase: session.phase,
    messages: out,
    cart: session.cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      priceInPaise: item.priceInPaise,
      quantity: item.quantity,
    })),
    upsell: session.upsell,
    orderId: session.context.orderId,
    paymentLinkUrl: session.context.paymentLinkUrl,
    paymentAttempts: session.context.paymentAttempts,
  };
}
