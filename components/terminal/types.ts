/** Shared types & styling for the terminal dashboard. */

export type FeedAgent = "GROWTH" | "CHECKOUT" | "GUARDIAN" | "SYSTEM" | "CUSTOMER";

export interface FeedEntry {
  id: string;
  at: string;
  agent: FeedAgent;
  text: string;
  status?: string;
}

export interface GuardianStatus {
  spendPaise: number;
  orderCount: number;
  maxSpendPaise: number;
  maxOrders: number;
  pendingApproval: { action: string; amountInPaise: number; reason: string } | null;
}

export interface StreamResponse {
  sessionId: string;
  phase: string;
  feed: FeedEntry[];
  guardian: GuardianStatus;
}

export interface AuditLogRow {
  id: string;
  agentType: string;
  action: string;
  status: string;
  reasoning?: string | null;
  blockedReason?: string | null;
  error?: string | null;
  output?: string | null;
  amountInPaise?: number | null;
  currency?: string | null;
  createdAt: string;
  requestId?: string | null;
}

export const AGENT_STYLES: Record<
  FeedAgent,
  { label: string; initials: string; avatar: string; badge: string }
> = {
  GROWTH: {
    label: "GROWTH AGENT",
    initials: "GR",
    avatar: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  CHECKOUT: {
    label: "CHECKOUT AGENT",
    initials: "CK",
    avatar: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  },
  GUARDIAN: {
    label: "GUARDIAN AGENT",
    initials: "GD",
    avatar: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  },
  SYSTEM: {
    label: "AGENT",
    initials: "SY",
    avatar: "border-zinc-600 bg-zinc-800 text-zinc-300",
    badge: "border-zinc-700 bg-zinc-900 text-zinc-400",
  },
  CUSTOMER: {
    label: "CUSTOMER",
    initials: "CU",
    avatar: "border-violet-500/40 bg-violet-500/15 text-violet-300",
    badge: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  },
};

export function statusChip(status: string): { icon: string; cls: string } {
  switch (status) {
    case "APPROVED":
    case "SUCCESS":
      return { icon: "✅", cls: "text-emerald-400" };
    case "NEEDS_APPROVAL":
      return { icon: "🔒", cls: "text-amber-400" };
    case "BLOCKED":
    case "FAILED":
      return { icon: "❌", cls: "text-red-400" };
    default:
      return { icon: "•", cls: "text-zinc-500" };
  }
}
