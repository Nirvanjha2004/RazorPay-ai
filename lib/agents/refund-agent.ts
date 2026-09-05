/**
 * RefundAgent — issues a full or partial Razorpay refund for a payment.
 * Guardrails: refund allowlist, daily refund count cap, per-action + daily spend caps.
 */

import { refundPayment } from "@/lib/razorpay/client";
import { executeAgent, type AgentMetadata, type AgentRunResult } from "@/lib/agents/executor";
import type { AgentType, RefundAgentInput, RefundAgentOutput } from "@/lib/agents/types";

export const refundAgentMetadata: AgentMetadata = {
  type: "refund",
  name: "Refund Agent",
  description:
    "Issues a full or partial refund for a Razorpay payment, subject to the refund allowlist and daily refund cap.",
  movesMoney: true,
};

export async function runRefundAgent(
  input: RefundAgentInput
): Promise<AgentRunResult<RefundAgentOutput>> {
  return executeAgent<RefundAgentInput, RefundAgentOutput>({
    agent: refundAgentMetadata,
    action: "refund_payment",
    input,
    guardrails: {
      amountInPaise: input.amountInPaise, // undefined = full refund, still capped once we know it? keep simple: partial refunds are capped
      paymentId: input.paymentId,
      currency: "INR",
    },
    execute: async () => {
      const refund = await refundPayment({
        paymentId: input.paymentId,
        amountInPaise: input.amountInPaise,
        speed: "normal",
        notes: input.reason ? { reason: input.reason } : undefined,
      });
      return {
        output: {
          refundId: refund.id,
          paymentId: refund.payment_id,
          amountInPaise: refund.amount,
          currency: refund.currency,
          status: refund.status,
        } satisfies RefundAgentOutput,
        amountInPaise: refund.amount,
        currency: refund.currency,
        razorpayPaymentId: refund.payment_id,
        razorpayRefundId: refund.id,
      };
    },
  });
}
