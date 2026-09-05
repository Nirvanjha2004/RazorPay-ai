/**
 * PaymentStatusAgent — read-only lookup of a Razorpay payment's current state.
 * Moves no money, so only the action allowlist applies.
 */

import { fetchPayment } from "@/lib/razorpay/client";
import { executeAgent, type AgentMetadata, type AgentRunResult } from "@/lib/agents/executor";
import type { AgentType, PaymentStatusAgentInput, PaymentStatusAgentOutput } from "@/lib/agents/types";

export const paymentStatusAgentMetadata: AgentMetadata = {
  type: "payment-status",
  name: "Payment Status Agent",
  description:
    "Read-only agent that fetches the current status, method and capture state of a Razorpay payment.",
  movesMoney: false,
};

export async function runPaymentStatusAgent(
  input: PaymentStatusAgentInput
): Promise<AgentRunResult<PaymentStatusAgentOutput>> {
  return executeAgent<PaymentStatusAgentInput, PaymentStatusAgentOutput>({
    agent: paymentStatusAgentMetadata,
    action: "fetch_payment_status",
    input,
    guardrails: { paymentId: input.paymentId },
    execute: async () => {
      const payment = await fetchPayment(input.paymentId);
      return {
        output: {
          paymentId: payment.id,
          status: payment.status,
          method: payment.method ?? null,
          amountInPaise: payment.amount,
          currency: payment.currency,
          captured: Boolean(payment.captured),
          email: payment.email,
        } satisfies PaymentStatusAgentOutput,
        amountInPaise: undefined, // read-only: no spend
        currency: payment.currency,
        razorpayPaymentId: payment.id,
      };
    },
  });
}
