/**
 * Conversational payment flow:
 *   create Razorpay order -> on failure retry ONCE -> still failing ->
 *   fall back to a Razorpay Payment Link with a graceful message.
 *
 * Every money action is gated by the GUARDIAN agent and audited.
 */

import { prisma } from "@/lib/db";
import { createOrder, createPaymentLink, createPaymentLinkForAmount } from "@/lib/razorpay/client";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import type { GuardianAgent } from "@/lib/agents/multiagent/guardian";
import type { ChatSessionData } from "@/lib/chat/session";

export type PaymentFlowStatus =
  | "ORDER_CREATED"
  | "NEEDS_APPROVAL"
  | "LINK_SENT"
  | "FAILED";

export interface PaymentFlowResult {
  status: PaymentFlowStatus;
  attempts: { attempt: number; error: string }[];
  orderId?: string;
  paymentLinkUrl?: string;
  pendingApproval?: { action: string; amountInPaise: number; reason: string } | null;
  message: string;
}

export async function executePaymentFlow(
  session: ChatSessionData,
  guardian: GuardianAgent
): Promise<PaymentFlowResult> {
  const sessionId = session.sessionId;
  const amount = session.cart.reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0);
  const productIds = session.cart.map((item) => item.productId);
  const attempts: { attempt: number; error: string }[] = [];
  const simulate = session.context.simulatePaymentFailure === true;

  // ---- Attempt 1 & 2: create a Razorpay order -----------------------------
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (simulate) {
      attempts.push({ attempt, error: "SIMULATED_PAYMENT_FAILURE (demo flag)" });
      await logAgentDecision({
        agentName: "CHECKOUT",
        action: "payment_attempt",
        status: "FAILED",
        reasoning: `Attempt ${attempt} forced to fail by the payment-failure simulation flag`,
        amountInPaise: amount,
        sessionId,
      });
      continue;
    }

    const verdict = await guardian.review({
      sessionId,
      action: "create_razorpay_order",
      amountInPaise: amount,
      productIds,
    });
    if (verdict.decision === "NEEDS_APPROVAL") {
      return {
        status: "NEEDS_APPROVAL",
        attempts,
        pendingApproval: {
          action: "create_razorpay_order",
          amountInPaise: amount,
          reason: verdict.reason,
        },
        message: verdict.reason,
      };
    }
    if (verdict.decision === "BLOCKED") {
      attempts.push({ attempt, error: `guardian: [${verdict.rule}] ${verdict.reason}` });
      break; // caps/allowlist won't clear on retry — go to fallback
    }

    try {
      const order = await createOrder(amount, { session_id: sessionId, source: "chat-checkout" });
      await prisma.order.create({
        data: {
          razorpayOrderId: order.id,
          amountInPaise: order.amount,
          currency: order.currency,
          notes: JSON.stringify({ session_id: sessionId, channel: "chat" }),
          status: "CREATED",
        },
      });
      guardian.commitSpend(sessionId, order.amount);
      await logAgentDecision({
        agentName: "CHECKOUT",
        action: "create_razorpay_order",
        status: "SUCCESS",
        reasoning: `Order created on attempt ${attempt} after guardian approval`,
        amountInPaise: order.amount,
        sessionId,
        meta: { order_id: order.id },
      });
      return {
        status: "ORDER_CREATED",
        attempts,
        orderId: order.id,
        message: `Order ${order.id} created for ₹${(order.amount / 100).toFixed(2)}.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ attempt, error: message });
      await logAgentDecision({
        agentName: "CHECKOUT",
        action: "payment_attempt",
        status: "FAILED",
        reasoning: `Order attempt ${attempt} failed: ${message}`,
        amountInPaise: amount,
        sessionId,
      });
    }
  }

  // ---- Fallback: Razorpay Payment Link --------------------------------------
  const linkVerdict = await guardian.review({
    sessionId,
    action: "create_payment_link",
    amountInPaise: amount,
    productIds,
  });
  if (linkVerdict.decision === "NEEDS_APPROVAL") {
    return {
      status: "NEEDS_APPROVAL",
      attempts,
      pendingApproval: {
        action: "create_payment_link",
        amountInPaise: amount,
        reason: linkVerdict.reason,
      },
      message: linkVerdict.reason,
    };
  }
  if (linkVerdict.decision === "BLOCKED") {
    const message = `Payment could not be processed and the fallback was blocked: [${linkVerdict.rule}] ${linkVerdict.reason}`;
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "payment_fallback",
      status: "FAILED",
      reasoning: message,
      amountInPaise: amount,
      sessionId,
    });
    return { status: "FAILED", attempts, message };
  }

  const description = `CommerceAgent chat order (${sessionId.slice(0, 12)})`;
  try {
    // Prefer a link tied to an existing order; otherwise a standalone link.
    const link = session.context.orderId
      ? await createPaymentLink(session.context.orderId)
      : await createPaymentLinkForAmount(amount, description);

    if (session.context.orderId) {
      await prisma.order.update({
        where: { razorpayOrderId: session.context.orderId },
        data: { status: "LINK_SENT", razorpayPaymentLinkId: link.id },
      }).catch(() => undefined);
    }

    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "payment_fallback_link",
      status: "SUCCESS",
      reasoning: "Payment link sent after failed order attempts (graceful fallback)",
      amountInPaise: amount,
      sessionId,
      meta: { link_id: link.id, attempts: attempts.length },
    });

    return {
      status: "LINK_SENT",
      attempts,
      paymentLinkUrl: link.short_url,
      message: `No worries — payment kept failing, so here's a secure Razorpay payment link instead: ${link.short_url}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "payment_fallback_link",
      status: "FAILED",
      reasoning: `Payment link fallback failed: ${message}`,
      amountInPaise: amount,
      sessionId,
    });
    return {
      status: "FAILED",
      attempts,
      message: `Sorry — we couldn't process your payment right now (${message}). Please try again in a little while.`,
    };
  }
}

