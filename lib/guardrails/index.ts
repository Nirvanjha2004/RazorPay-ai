/**
 * Guardrails for autonomous agents: spend caps + allowlists.
 *
 * Every agent run must pass through `assertAllowedToAct` before touching the
 * Razorpay API. Failed checks throw `GuardrailViolation`, which the agent
 * executor catches and records in the audit trail with status BLOCKED.
 */

import { prisma } from "@/lib/db";

export class GuardrailViolation extends Error {
  constructor(public readonly rule: string, message: string) {
    super(message);
    this.name = "GuardrailViolation";
  }
}

// ---------------------------------------------------------------------------
// Configuration (override via env in production)
// ---------------------------------------------------------------------------

/** Max spend for a single agent action, in paise. Default ₹1,000. */
export const PER_ACTION_SPEND_CAP_PAISE = Number(
  process.env.GUARDRAIL_PER_ACTION_CAP_PAISE ?? 100_000
);

/** Max cumulative spend per UTC day across all agents, in paise. Default ₹5,000. */
export const DAILY_SPEND_CAP_PAISE = Number(
  process.env.GUARDRAIL_DAILY_CAP_PAISE ?? 500_000
);

/** Max refunds allowed per day. */
export const DAILY_REFUND_COUNT_CAP = Number(
  process.env.GUARDRAIL_DAILY_REFUND_CAP ?? 10
);

/** Only these currencies may be transacted. */
export const ALLOWED_CURRENCIES = ["INR"] as const;

/** Only these agent action types are permitted to move money. */
export const ALLOWED_ACTIONS = [
  "create_payment_link",
  "create_order",
  "refund_payment",
] as const;

/** When true, refunds are only allowed for allowlisted payment IDs. */
export const REFUND_ALLOWLIST_ENABLED =
  process.env.GUARDRAIL_REFUND_ALLOWLIST !== "false";

/**
 * Payment IDs that may be refunded. In a real deployment this would come from
 * your support desk / order management system. Test-mode payment IDs
 * (pay_test_...) are always allowed since no real money moves.
 */
export const REFUND_ALLOWLIST: string[] = (
  process.env.GUARDRAIL_REFUND_ALLOWLIST_IDS ?? ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function checkCurrency(currency: string): void {
  if (!ALLOWED_CURRENCIES.includes(currency as (typeof ALLOWED_CURRENCIES)[number])) {
    throw new GuardrailViolation(
      "currency_allowlist",
      `Currency "${currency}" is not allowlisted. Allowed: ${ALLOWED_CURRENCIES.join(", ")}`
    );
  }
}

export function checkAction(action: string): void {
  if (!ALLOWED_ACTIONS.includes(action as (typeof ALLOWED_ACTIONS)[number])) {
    throw new GuardrailViolation(
      "action_allowlist",
      `Action "${action}" is not allowlisted. Allowed: ${ALLOWED_ACTIONS.join(", ")}`
    );
  }
}

export function checkPerActionCap(amountInPaise: number): void {
  if (amountInPaise > PER_ACTION_SPEND_CAP_PAISE) {
    throw new GuardrailViolation(
      "per_action_spend_cap",
      `Amount ₹${(amountInPaise / 100).toFixed(2)} exceeds the per-action cap of ₹${(
        PER_ACTION_SPEND_CAP_PAISE / 100
      ).toFixed(2)}`
    );
  }
}

export function checkRefundAllowlist(paymentId: string): void {
  if (!REFUND_ALLOWLIST_ENABLED) return;
  if (paymentId.startsWith("pay_test_")) return; // test-mode money is not real
  if (REFUND_ALLOWLIST.length === 0 || !REFUND_ALLOWLIST.includes(paymentId)) {
    throw new GuardrailViolation(
      "refund_allowlist",
      `Payment "${paymentId}" is not on the refund allowlist`
    );
  }
}

/** Sum of successful spend (orders + payment links + refunds) for today. */
export async function getSpendTodayUtc(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const result = await prisma.auditLog.aggregate({
    _sum: { amountInPaise: true },
    where: {
      status: "SUCCESS",
      amountInPaise: { not: null },
      action: { in: ["create_payment_link", "create_order", "refund_payment"] },
      createdAt: { gte: startOfDay },
    },
  });

  return result._sum.amountInPaise ?? 0;
}

/** Number of successful refunds today. */
export async function getRefundCountTodayUtc(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  return prisma.auditLog.count({
    where: {
      status: "SUCCESS",
      action: "refund_payment",
      createdAt: { gte: startOfDay },
    },
  });
}

export async function checkDailySpendCap(amountInPaise: number): Promise<void> {
  const spentToday = await getSpendTodayUtc();
  if (spentToday + amountInPaise > DAILY_SPEND_CAP_PAISE) {
    throw new GuardrailViolation(
      "daily_spend_cap",
      `Action would push today's spend to ₹${((spentToday + amountInPaise) / 100).toFixed(
        2
      )}, exceeding the daily cap of ₹${(DAILY_SPEND_CAP_PAISE / 100).toFixed(2)}`
    );
  }
}

export async function checkDailyRefundCap(): Promise<void> {
  const refundsToday = await getRefundCountTodayUtc();
  if (refundsToday >= DAILY_REFUND_COUNT_CAP) {
    throw new GuardrailViolation(
      "daily_refund_cap",
      `Daily refund cap of ${DAILY_REFUND_COUNT_CAP} already reached (${refundsToday} today)`
    );
  }
}

/** Run every pre-flight check relevant to a money-moving action. */
export async function assertAllowedToAct(params: {
  action: string;
  amountInPaise?: number;
  currency?: string;
  paymentId?: string;
}): Promise<void> {
  checkAction(params.action);
  if (params.currency) checkCurrency(params.currency);
  if (params.amountInPaise != null) {
    checkPerActionCap(params.amountInPaise);
    await checkDailySpendCap(params.amountInPaise);
  }
  if (params.action === "refund_payment") {
    if (params.paymentId) checkRefundAllowlist(params.paymentId);
    await checkDailyRefundCap();
  }
}
