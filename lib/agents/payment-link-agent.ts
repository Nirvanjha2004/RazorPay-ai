/**
 * PaymentLinkAgent — creates a Razorpay Payment Link and returns the short URL.
 * Guardrails: per-action spend cap, daily spend cap, currency allowlist.
 */

import { createStandalonePaymentLink } from "@/lib/razorpay/client";
import { executeAgent, type AgentMetadata, type AgentRunResult } from "@/lib/agents/executor";
import type { AgentType, PaymentLinkAgentInput, PaymentLinkAgentOutput } from "@/lib/agents/types";

export const paymentLinkAgentMetadata: AgentMetadata = {
  type: "payment-link",
  name: "Payment Link Agent",
  description:
    "Creates a Razorpay Payment Link (with SMS/email notifications) for a customer and returns the checkout URL.",
  movesMoney: true,
};

export async function runPaymentLinkAgent(
  input: PaymentLinkAgentInput
): Promise<AgentRunResult<PaymentLinkAgentOutput>> {
  return executeAgent<PaymentLinkAgentInput, PaymentLinkAgentOutput>({
    agent: paymentLinkAgentMetadata,
    action: "create_payment_link",
    input,
    guardrails: {
      amountInPaise: input.amountInPaise,
      currency: input.currency ?? "INR",
    },
    execute: async () => {
      const link = await createStandalonePaymentLink({
        amountInPaise: input.amountInPaise,
        currency: input.currency,
        description: input.description,
        customer: input.customer,
      });
      return {
        output: {
          paymentLinkId: link.id,
          shortUrl: link.short_url,
          amountInPaise: link.amount,
          currency: link.currency,
          status: link.status,
        } satisfies PaymentLinkAgentOutput,
        amountInPaise: link.amount,
        currency: link.currency,
      };
    },
  });
}
