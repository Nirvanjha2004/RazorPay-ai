/**
 * GUARDIAN AGENT (governor).
 *
 * Deterministic by design — governance must never depend on an LLM. Every
 * money-moving action from any agent passes through `review()` and gets a
 * verdict: APPROVED | BLOCKED | NEEDS_APPROVAL (with a reason).
 *
 * Enforced policies per session:
 *   - Max spend:          MAX_SESSION_SPEND paise (default ₹2,000)
 *   - Max orders:         MAX_SESSION_ORDERS (default 3)
 *   - Product allowlist:  products table (+ optional PRODUCT_ALLOWLIST env)
 *   - Human approval:     any action > HUMAN_APPROVAL_THRESHOLD_PAISE (₹1,000)
 *                         pauses the session until a human approves.
 */

import { prisma } from "@/lib/db";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import type { GuardianVerdict } from "@/lib/agents/multiagent/types";

export const MAX_SESSION_SPEND_PAISE = Number(process.env.MAX_SESSION_SPEND ?? 200_000);
export const MAX_SESSION_ORDERS = Number(process.env.MAX_SESSION_ORDERS ?? 3);
export const HUMAN_APPROVAL_THRESHOLD_PAISE = Number(
  process.env.HUMAN_APPROVAL_THRESHOLD_PAISE ?? 100_000
);

/** Actions that create (or commit spend towards) an order. */
const ORDER_CREATING_ACTIONS = new Set(["checkout_session", "create_razorpay_order"]);

interface SessionLedger {
  spendPaise: number;
  orderCount: number;
  /** Amounts a human has explicitly approved this session. */
  approvedAmounts: Set<number>;
}

export class GuardianAgent {
  readonly name = "GUARDIAN";

  private sessions = new Map<string, SessionLedger>();

  initSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      spendPaise: 0,
      orderCount: 0,
      approvedAmounts: new Set<number>(),
    });
  }

  private ledgerFor(sessionId: string): SessionLedger {
    let ledger = this.sessions.get(sessionId);
    if (!ledger) {
      ledger = { spendPaise: 0, orderCount: 0, approvedAmounts: new Set<number>() };
      this.sessions.set(sessionId, ledger);
    }
    return ledger;
  }

  getSessionSpend(sessionId: string): { spendPaise: number; orderCount: number } {
    const ledger = this.ledgerFor(sessionId);
    return { spendPaise: ledger.spendPaise, orderCount: ledger.orderCount };
  }

  /**
   * Gate a money action. Async because the product allowlist is the DB catalog.
   */
  async review(params: {
    sessionId: string;
    action: string;
    amountInPaise?: number;
    productIds?: string[];
  }): Promise<GuardianVerdict> {
    const verdict = await this.evaluate(params);
    await logAgentDecision({
      agentName: this.name,
      action: `gate_${params.action}`,
      status: verdict.decision,
      reasoning: verdict.reason,
      amountInPaise: params.amountInPaise ?? null,
      sessionId: params.sessionId,
      meta: { rule: verdict.rule ?? null, product_ids: params.productIds ?? null },
    });
    return verdict;
  }

  private async evaluate(params: {
    sessionId: string;
    action: string;
    amountInPaise?: number;
    productIds?: string[];
  }): Promise<GuardianVerdict> {
    const { sessionId, action, amountInPaise, productIds } = params;

    // 1. Product allowlist ---------------------------------------------------
    if (productIds && productIds.length > 0) {
      const blocked = await this.findBlockedProducts(productIds);
      if (blocked.length > 0) {
        return {
          decision: "BLOCKED",
          rule: "product_allowlist",
          reason: `Product(s) not in the allowlist or unavailable: ${blocked.join(", ")}`,
          amountInPaise,
        };
      }
    }

    const ledger = this.ledgerFor(sessionId);

    // 2. Session order-count cap ---------------------------------------------
    if (ORDER_CREATING_ACTIONS.has(action) && ledger.orderCount >= MAX_SESSION_ORDERS) {
      return {
        decision: "BLOCKED",
        rule: "max_session_orders",
        reason: `Session already created ${ledger.orderCount} orders (max ${MAX_SESSION_ORDERS})`,
        amountInPaise,
      };
    }

    // 3. Session spend cap ----------------------------------------------------
    if (amountInPaise != null && ledger.spendPaise + amountInPaise > MAX_SESSION_SPEND_PAISE) {
      return {
        decision: "BLOCKED",
        rule: "max_session_spend",
        reason: `Action of ₹${(amountInPaise / 100).toFixed(2)} would exceed the session cap of ₹${(
          MAX_SESSION_SPEND_PAISE / 100
        ).toFixed(2)} (already spent ₹${(ledger.spendPaise / 100).toFixed(2)})`,
        amountInPaise,
      };
    }

    // 4. Human-approval threshold ----------------------------------------------
    if (
      amountInPaise != null &&
      amountInPaise > HUMAN_APPROVAL_THRESHOLD_PAISE &&
      !ledger.approvedAmounts.has(amountInPaise)
    ) {
      return {
        decision: "NEEDS_APPROVAL",
        rule: "human_approval_required",
        reason: `Action of ₹${(amountInPaise / 100).toFixed(2)} exceeds ₹${(
          HUMAN_APPROVAL_THRESHOLD_PAISE / 100
        ).toFixed(2)} — REQUIRES_HUMAN_APPROVAL, session paused`,
        amountInPaise,
      };
    }

    return {
      decision: "APPROVED",
      rule: "all_checks_passed",
      reason: "All guardian policies satisfied",
      amountInPaise,
    };
  }

  /** Products that are unknown, out of stock, or excluded by env allowlist. */
  private async findBlockedProducts(productIds: string[]): Promise<string[]> {
    const envAllowlist = (process.env.PRODUCT_ALLOWLIST ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return productIds.filter((id) => {
      const product = byId.get(id);
      if (!product) return true; // not a real catalog product
      if (product.stock <= 0) return true; // unavailable
      if (envAllowlist.length > 0 && !envAllowlist.includes(id)) return true;
      return false;
    });
  }

  /** Record a human approval for a specific amount (un-pauses the session). */
  async recordApproval(sessionId: string, amountInPaise: number, approved: boolean): Promise<void> {
    const ledger = this.ledgerFor(sessionId);
    if (approved) ledger.approvedAmounts.add(amountInPaise);
    await logAgentDecision({
      agentName: this.name,
      action: "human_approval",
      status: approved ? "APPROVED" : "BLOCKED",
      reasoning: approved
        ? `Human approved the paused action of ₹${(amountInPaise / 100).toFixed(2)} — session resumed`
        : `Human rejected the paused action of ₹${(amountInPaise / 100).toFixed(2)} — session blocked`,
      amountInPaise,
      sessionId,
    });
  }

  /** Commit spend after a successful order (updates session caps usage). */
  commitSpend(sessionId: string, amountInPaise: number): void {
    const ledger = this.ledgerFor(sessionId);
    ledger.spendPaise += amountInPaise;
    ledger.orderCount += 1;
  }
}

const globalForGuardian = globalThis as unknown as { __guardian?: GuardianAgent };

/** Singleton so session ledgers survive across requests (dev / single node). */
export function getGuardian(): GuardianAgent {
  if (!globalForGuardian.__guardian) {
    globalForGuardian.__guardian = new GuardianAgent();
  }
  return globalForGuardian.__guardian;
}
