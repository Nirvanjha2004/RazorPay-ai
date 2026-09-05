/**
 * Shared agent types. Agents are pure functions over typed inputs; all
 * orchestration (guardrails + audit logging) happens in `executeAgent`.
 */

export type AgentStatus = "SUCCESS" | "FAILED" | "BLOCKED";

export type AgentType = "payment-link" | "refund" | "payment-status";

// -- Inputs -----------------------------------------------------------------

export interface PaymentLinkAgentInput {
  amountInPaise: number;
  currency?: string;
  description: string;
  customer: { name: string; email: string; contact: string };
}

export interface RefundAgentInput {
  paymentId: string;
  /** Partial refund amount in paise; omit for a full refund. */
  amountInPaise?: number;
  reason?: string;
}

export interface PaymentStatusAgentInput {
  paymentId: string;
}

// -- Outputs ----------------------------------------------------------------

export interface PaymentLinkAgentOutput {
  paymentLinkId: string;
  shortUrl: string;
  amountInPaise: number;
  currency: string;
  status: string;
}

export interface RefundAgentOutput {
  refundId: string;
  paymentId: string;
  amountInPaise: number;
  currency: string;
  status: string;
}

export interface PaymentStatusAgentOutput {
  paymentId: string;
  status: string;
  method: string | null;
  amountInPaise: number;
  currency: string;
  captured: boolean;
  email?: string;
}
