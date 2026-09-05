/**
 * Shared types for the multi-agent system (GROWTH / CHECKOUT / GUARDIAN).
 */

export type AgentName = "GROWTH" | "CHECKOUT" | "GUARDIAN" | "SYSTEM";

/** Verdict returned by the GUARDIAN agent for every money action. */
export type GuardianDecision = "APPROVED" | "BLOCKED" | "NEEDS_APPROVAL";

export interface CartItem {
  productId: string;
  name: string;
  priceInPaise: number;
  quantity: number;
}

export interface UpsellSuggestion {
  productId: string;
  name: string;
  priceInPaise: number;
  reason: string;
}

export interface GuardianVerdict {
  decision: GuardianDecision;
  rule?: string;
  reason: string;
  amountInPaise?: number;
}

export interface SessionOrder {
  razorpayOrderId: string;
  amountInPaise: number;
  status: string;
  paymentLinkUrl?: string;
}

/** State machine phases. */
export type SessionPhase =
  | "GROWTH_ANALYSIS"
  | "GUARDIAN_REVIEW"
  | "CHECKOUT"
  | "AWAITING_HUMAN_APPROVAL"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED";

export interface PendingApproval {
  action: string;
  amountInPaise: number;
  reason: string;
  requestedAt: string;
}

export interface TranscriptEntry {
  agent: AgentName;
  event: string;
  detail?: string;
  at: string;
}

/** The shared state every agent reads from and writes to. */
export interface AgentSessionState {
  sessionId: string;
  phase: SessionPhase;
  cart: CartItem[];
  cartTotalPaise: number;
  upsell: UpsellSuggestion | null;
  upsellAccepted: boolean;
  effectiveTotalPaise: number;
  orders: SessionOrder[];
  guardianVerdicts: GuardianVerdict[];
  pendingApproval: PendingApproval | null;
  error: string | null;
  reasoning: string | null;
  transcript: TranscriptEntry[];
  startedAt: string;
  updatedAt: string;
}
