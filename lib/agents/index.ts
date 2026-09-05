/**
 * Agent registry — the single source of truth for which agents exist and how
 * the API routes dispatch to them.
 */

import {
  paymentLinkAgentMetadata,
  runPaymentLinkAgent,
} from "@/lib/agents/payment-link-agent";
import { refundAgentMetadata, runRefundAgent } from "@/lib/agents/refund-agent";
import {
  paymentStatusAgentMetadata,
  runPaymentStatusAgent,
} from "@/lib/agents/payment-status-agent";
import type { AgentMetadata, AgentRunResult } from "@/lib/agents/executor";
import type {
  PaymentLinkAgentInput,
  PaymentStatusAgentInput,
  RefundAgentInput,
} from "@/lib/agents/types";

export type {
  AgentMetadata,
  AgentRunResult,
} from "@/lib/agents/executor";
export type {
  PaymentLinkAgentInput,
  PaymentLinkAgentOutput,
  PaymentStatusAgentInput,
  PaymentStatusAgentOutput,
  RefundAgentInput,
  RefundAgentOutput,
} from "@/lib/agents/types";

export const agents: AgentMetadata[] = [
  paymentLinkAgentMetadata,
  refundAgentMetadata,
  paymentStatusAgentMetadata,
];

export function getAgentMetadata(type: string): AgentMetadata | undefined {
  return agents.find((a) => a.type === type);
}

/** Dispatch an agent run by type. Returns null for unknown agent types. */
export async function dispatchAgent(
  type: string,
  input: unknown
): Promise<AgentRunResult | null> {
  switch (type) {
    case "payment-link":
      return runPaymentLinkAgent(input as PaymentLinkAgentInput);
    case "refund":
      return runRefundAgent(input as RefundAgentInput);
    case "payment-status":
      return runPaymentStatusAgent(input as PaymentStatusAgentInput);
    default:
      return null;
  }
}
