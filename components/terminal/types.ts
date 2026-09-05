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
  orderId?: string | null;
  paymentLinkUrl?: string | null;
  amountPaise?: number | null;
  orderStatus?: string | null;
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
    label: "Growth",
    initials: "GR",
    avatar: "bg-violet-600 text-white",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  CHECKOUT: {
    label: "Checkout",
    initials: "CK",
    avatar: "bg-[#204CF5] text-white",
    badge: "bg-blue-50 text-[#204CF5] ring-blue-200",
  },
  GUARDIAN: {
    label: "Guardian",
    initials: "GD",
    avatar: "bg-amber-500 text-white",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  SYSTEM: {
    label: "System",
    initials: "SY",
    avatar: "bg-slate-700 text-white",
    badge: "bg-slate-50 text-slate-700 ring-slate-200",
  },
  CUSTOMER: {
    label: "Customer",
    initials: "CU",
    avatar: "bg-slate-900 text-white",
    badge: "bg-slate-900 text-white ring-slate-900",
  },
};

export function statusChip(status: string): { icon: string; cls: string } {
  switch (status) {
    case "APPROVED":
    case "SUCCESS":
      return { icon: "●", cls: "text-emerald-600" };
    case "NEEDS_APPROVAL":
      return { icon: "●", cls: "text-amber-600" };
    case "BLOCKED":
    case "FAILED":
      return { icon: "●", cls: "text-red-600" };
    default:
      return { icon: "●", cls: "text-slate-400" };
  }
}

export function isGuardianGate(entry: FeedEntry): boolean {
  return entry.agent === "GUARDIAN";
}

export function parseGateMeta(entry: FeedEntry): { rule: string | null; reason: string } {
  const text = entry.text;
  // rule is often logged as [rule] or in reasoning
  const bracket = text.match(/\[([^\]]+)\]/);
  const rule = bracket?.[1] ?? null;
  // reason is the detail after "—"
  const parts = text.split("—");
  const reason = parts.length > 1 ? parts.slice(1).join("—").trim() : text;
  return { rule, reason };
}

export function extractAmount(entry: FeedEntry): number | null {
  // try ₹ amount in text
  const m = entry.text.match(/₹\s?([\d,]+\.\d{2}|[\d,]+)/);
  if (m) {
    const num = Number(m[1].replace(/,/g, ""));
    if (!Number.isNaN(num)) return Math.round(num * 100);
  }
  return null;
}
