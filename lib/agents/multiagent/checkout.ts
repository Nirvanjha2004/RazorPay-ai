/**
 * CHECKOUT AGENT — handles the transaction via OpenAI tool-calling.
 *
 * Tools: create_razorpay_order | create_payment_link | check_order_status.
 * Hard rule (enforced in code): it cannot create an order above the cart value.
 *
 * Every money tool call is gated by the GUARDIAN agent first. If the guardian
 * returns NEEDS_APPROVAL, a PauseSignal is thrown to freeze the whole session.
 * When OPENAI_API_KEY is unset, a deterministic fallback creates a single
 * order for the effective cart total.
 */

import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

import { prisma } from "@/lib/db";
import { createOrder, createPaymentLink } from "@/lib/razorpay/client";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import type { GuardianAgent } from "@/lib/agents/multiagent/guardian";
import type { AgentSessionState, PendingApproval } from "@/lib/agents/multiagent/types";

/** Thrown from a tool executor when the guardian demands human approval. */
export class PauseSignal extends Error {
  constructor(public readonly pending: PendingApproval) {
    super("REQUIRES_HUMAN_APPROVAL — session paused by guardian");
    this.name = "PauseSignal";
  }
}

export interface CheckoutResult {
  reasoning: string;
  source: "openai" | "deterministic-fallback";
}

interface ToolContext {
  state: AgentSessionState;
  guardian: GuardianAgent;
}

type ToolResult = Record<string, unknown>;

function ok(value: ToolResult): string {
  return JSON.stringify(value);
}

/** Tool: create_razorpay_order — gated by the guardian, capped at cart value. */
async function execCreateOrder(
  args: { amount_in_paise?: number; receipt?: string },
  ctx: ToolContext
): Promise<string> {
  const { state, guardian } = ctx;
  const amount = Number(args?.amount_in_paise);

  if (!Number.isInteger(amount) || amount <= 0) {
    return ok({ status: "ERROR", reason: `amount_in_paise must be a positive integer, got ${args?.amount_in_paise}` });
  }

  // Hard rule: the checkout agent cannot create orders above the cart value.
  if (amount > state.effectiveTotalPaise) {
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "create_razorpay_order",
      status: "BLOCKED",
      reasoning: `Rejected ₹${(amount / 100).toFixed(2)}: exceeds the effective cart value of ₹${(
        state.effectiveTotalPaise / 100
      ).toFixed(2)}`,
      amountInPaise: amount,
      sessionId: state.sessionId,
    });
    return ok({ status: "REJECTED", reason: "amount exceeds the effective cart value" });
  }

  const verdict = await guardian.review({
    sessionId: state.sessionId,
    action: "create_razorpay_order",
    amountInPaise: amount,
    productIds: state.cart.map((item) => item.productId),
  });

  if (verdict.decision === "NEEDS_APPROVAL") {
    throw new PauseSignal({
      action: "create_razorpay_order",
      amountInPaise: amount,
      reason: verdict.reason,
      requestedAt: new Date().toISOString(),
    });
  }
  if (verdict.decision === "BLOCKED") {
    return ok({ status: "BLOCKED", reason: verdict.reason, rule: verdict.rule });
  }

  try {
    const order = await createOrder(amount, { session_id: state.sessionId, source: "checkout-agent" }, args?.receipt);
    await prisma.order.create({
      data: {
        razorpayOrderId: order.id,
        amountInPaise: order.amount,
        currency: order.currency,
        receipt: args?.receipt ?? null,
        notes: JSON.stringify({ session_id: state.sessionId }),
        status: "CREATED",
      },
    });
    guardian.commitSpend(state.sessionId, order.amount);
    state.orders.push({ razorpayOrderId: order.id, amountInPaise: order.amount, status: order.status });

    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "create_razorpay_order",
      status: "SUCCESS",
      reasoning: "Order created via Razorpay Orders API after guardian approval",
      amountInPaise: order.amount,
      sessionId: state.sessionId,
      meta: { order_id: order.id },
    });
    return ok({ status: "OK", order_id: order.id, amount_in_paise: order.amount, currency: order.currency });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "create_razorpay_order",
      status: "FAILED",
      reasoning: `Razorpay order creation failed: ${message}`,
      amountInPaise: amount,
      sessionId: state.sessionId,
    });
    return ok({ status: "ERROR", reason: message });
  }
}

/** Tool: create_payment_link — fallback flow, also guardian-gated. */
async function execCreatePaymentLink(
  args: { order_id?: string },
  ctx: ToolContext
): Promise<string> {
  const { state, guardian } = ctx;
  const orderId = args?.order_id;
  if (!orderId || typeof orderId !== "string") {
    return ok({ status: "ERROR", reason: "order_id is required" });
  }

  const localOrder = await prisma.order.findUnique({ where: { razorpayOrderId: orderId } });
  if (!localOrder) {
    return ok({ status: "ERROR", reason: `No local order found for ${orderId}` });
  }

  const verdict = await guardian.review({
    sessionId: state.sessionId,
    action: "create_payment_link",
    amountInPaise: localOrder.amountInPaise,
    productIds: state.cart.map((item) => item.productId),
  });

  if (verdict.decision === "NEEDS_APPROVAL") {
    throw new PauseSignal({
      action: "create_payment_link",
      amountInPaise: localOrder.amountInPaise,
      reason: verdict.reason,
      requestedAt: new Date().toISOString(),
    });
  }
  if (verdict.decision === "BLOCKED") {
    return ok({ status: "BLOCKED", reason: verdict.reason, rule: verdict.rule });
  }

  try {
    const link = await createPaymentLink(orderId);
    await prisma.order.update({
      where: { razorpayOrderId: orderId },
      data: { status: "LINK_SENT", razorpayPaymentLinkId: link.id },
    });
    const stateOrder = state.orders.find((o) => o.razorpayOrderId === orderId);
    if (stateOrder) {
      stateOrder.status = "LINK_SENT";
      stateOrder.paymentLinkUrl = link.short_url;
    }

    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "create_payment_link",
      status: "SUCCESS",
      reasoning: "Payment link created as fallback checkout flow",
      amountInPaise: localOrder.amountInPaise,
      sessionId: state.sessionId,
      meta: { order_id: orderId, link_id: link.id },
    });
    return ok({ status: "OK", order_id: orderId, payment_link_url: link.short_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "create_payment_link",
      status: "FAILED",
      reasoning: `Payment link creation failed: ${message}`,
      amountInPaise: localOrder.amountInPaise,
      sessionId: state.sessionId,
    });
    return ok({ status: "ERROR", reason: message });
  }
}

/** Tool: check_order_status — read-only, no guardian gate needed. */
async function execCheckOrderStatus(args: { order_id?: string }, ctx: ToolContext): Promise<string> {
  const orderId = args?.order_id;
  if (!orderId || typeof orderId !== "string") {
    return ok({ status: "ERROR", reason: "order_id is required" });
  }

  const order = await prisma.order.findUnique({ where: { razorpayOrderId: orderId } });
  await logAgentDecision({
    agentName: "CHECKOUT",
    action: "check_order_status",
    status: order ? "SUCCESS" : "FAILED",
    reasoning: order
      ? `Read-only status check: ${order.status}`
      : `No local order found for ${orderId}`,
    amountInPaise: order?.amountInPaise ?? null,
    sessionId: ctx.state.sessionId,
    meta: { order_id: orderId },
  });

  if (!order) return ok({ status: "ERROR", reason: `No local order found for ${orderId}` });
  return ok({
    order_id: order.razorpayOrderId,
    status: order.status,
    amount_in_paise: order.amountInPaise,
    currency: order.currency,
  });
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const CHECKOUT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_razorpay_order",
      description:
        "Create a Razorpay order (test mode). The amount must not exceed the effective cart total.",
      parameters: {
        type: "object",
        properties: {
          amount_in_paise: { type: "integer", description: "Order amount in paise" },
          receipt: { type: "string", description: "Optional receipt reference" },
        },
        required: ["amount_in_paise"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_payment_link",
      description: "Fallback: create a Razorpay payment link for an existing order id.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string", description: "Razorpay order id (order_...)" } },
        required: ["order_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Read-only: check the local status of an existing order.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string", description: "Razorpay order id (order_...)" } },
        required: ["order_id"],
      },
    },
  },
];

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case "create_razorpay_order":
      return execCreateOrder(args as { amount_in_paise?: number; receipt?: string }, ctx);
    case "create_payment_link":
      return execCreatePaymentLink(args as { order_id?: string }, ctx);
    case "check_order_status":
      return execCheckOrderStatus(args as { order_id?: string }, ctx);
    default:
      return ok({ status: "ERROR", reason: `Unknown tool "${name}"` });
  }
}

export async function runCheckoutAgent(
  state: AgentSessionState,
  guardian: GuardianAgent
): Promise<CheckoutResult> {
  const ctx: ToolContext = { state, guardian };
  const openai = getOpenAI();

  // Deterministic fallback: one order for the effective cart total.
  if (!openai) {
    const result = await execCreateOrder({ amount_in_paise: state.effectiveTotalPaise }, ctx);
    const parsed = parseToolArgs(result) as { status?: string; reason?: string; order_id?: string };
    const reasoning =
      parsed.status === "OK"
        ? `Deterministic checkout: order ${parsed.order_id} created for ₹${(
            state.effectiveTotalPaise / 100
          ).toFixed(2)}.`
        : `Deterministic checkout failed: ${parsed.status} — ${parsed.reason ?? "unknown"}`;
    state.reasoning = reasoning;
    return { reasoning, source: "deterministic-fallback" };
  }

  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: [
          "You are the CHECKOUT agent of an autonomous commerce system, transacting on Razorpay (test mode).",
          `The effective cart total is ${state.effectiveTotalPaise} paise. You must NEVER create an order above that amount.`,
          "Create exactly one order for the effective cart total using create_razorpay_order.",
          "If order creation returns status ERROR, retry once with create_payment_link as a fallback using the same order_id if one exists.",
          "You may use check_order_status to verify an order's local status.",
          "Every money action you attempt is enforced by a guardian agent; obey its verdicts.",
          'Final answer must be JSON only: {"status": "completed" | "failed", "reasoning": "...", "order_id": "..."}',
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          session_id: state.sessionId,
          cart: state.cart,
          effective_total_paise: state.effectiveTotalPaise,
        }),
      },
    ];

    for (let iteration = 0; iteration < 6; iteration++) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        tools: CHECKOUT_TOOLS,
        temperature: 0.1,
      });
      const message = completion.choices[0]?.message;
      if (!message) break;

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message as ChatCompletionMessageParam);
        for (const toolCall of message.tool_calls) {
          const args = parseToolArgs(toolCall.function.arguments);
          const result = await executeToolCall(toolCall.function.name, args, ctx);
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
        }
        continue;
      }

      const parsed = (() => {
        try {
          return JSON.parse(message.content ?? "{}") as {
            status?: string;
            reasoning?: string;
            order_id?: string;
          };
        } catch {
          return {} as { status?: string; reasoning?: string; order_id?: string };
        }
      })();

      const reasoning =
        parsed.reasoning ??
        (state.orders.length > 0
          ? `Checkout finished with ${state.orders.length} order(s).`
          : "Checkout completed without creating an order.");
      state.reasoning = reasoning;

      await logAgentDecision({
        agentName: "CHECKOUT",
        action: "session_summary",
        status: parsed.status === "completed" || state.orders.length > 0 ? "SUCCESS" : "FAILED",
        reasoning,
        amountInPaise: state.orders.at(-1)?.amountInPaise ?? null,
        sessionId: state.sessionId,
        meta: { order_ids: state.orders.map((o) => o.razorpayOrderId) },
      });

      return { reasoning, source: "openai" };
    }

    // Loop exhausted without a final answer.
    const reasoning = "Checkout agent ended without a final answer.";
    state.reasoning = reasoning;
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "session_summary",
      status: state.orders.length > 0 ? "SUCCESS" : "FAILED",
      reasoning,
      sessionId: state.sessionId,
    });
    return { reasoning, source: "openai" };
  } catch (error) {
    // PauseSignal must bubble up so the orchestrator can pause the session.
    if (error instanceof PauseSignal) throw error;

    const message = error instanceof Error ? error.message : String(error);
    state.reasoning = `Checkout agent error: ${message}`;
    await logAgentDecision({
      agentName: "CHECKOUT",
      action: "session_summary",
      status: "FAILED",
      reasoning: state.reasoning,
      sessionId: state.sessionId,
    });
    return { reasoning: state.reasoning, source: "openai" };
  }
}
