/**
 * Multi-agent orchestrator — a shared state machine coordinating:
 *
 *   GROWTH AGENT   (upsell analysis, OpenAI tool-calling)
 *   GUARDIAN AGENT (deterministic governor — every money action passes through)
 *   CHECKOUT AGENT (Razorpay transaction, OpenAI tool-calling)
 *
 * Phases:
 *   GROWTH_ANALYSIS -> GUARDIAN_REVIEW -> CHECKOUT -> COMPLETED
 *                                     |-> AWAITING_HUMAN_APPROVAL (paused)
 *                                     |-> BLOCKED / FAILED
 *
 * Sessions live in an in-memory map (fine for dev / single-node); every
 * decision is persisted to the audit_logs table by the agents themselves.
 */

import { prisma } from "@/lib/db";
import { runGrowthAgent } from "@/lib/agents/multiagent/growth";
import { runCheckoutAgent, PauseSignal } from "@/lib/agents/multiagent/checkout";
import { getGuardian, GuardianAgent } from "@/lib/agents/multiagent/guardian";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import type {
  AgentSessionState,
  SessionPhase,
  TranscriptEntry,
} from "@/lib/agents/multiagent/types";

export class MultiAgentOrchestrator {
  private readonly guardian: GuardianAgent;
  private readonly sessions = new Map<string, AgentSessionState>();

  constructor(guardian: GuardianAgent) {
    this.guardian = guardian;
  }

  get(sessionId: string): AgentSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  private touch(state: AgentSessionState, phase: SessionPhase): void {
    state.phase = phase;
    state.updatedAt = new Date().toISOString();
  }

  private trace(
    state: AgentSessionState,
    agent: TranscriptEntry["agent"],
    event: string,
    detail?: string
  ): void {
    state.transcript.push({ agent, event, detail, at: new Date().toISOString() });
  }

  /** Start a new session from cart items (product ids + quantities). */
  async start(items: { productId: string; quantity?: number }[]): Promise<AgentSessionState> {
    const sessionId = `sess_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const state: AgentSessionState = {
      sessionId,
      phase: "GROWTH_ANALYSIS",
      cart: [],
      cartTotalPaise: 0,
      upsell: null,
      upsellAccepted: false,
      effectiveTotalPaise: 0,
      orders: [],
      guardianVerdicts: [],
      pendingApproval: null,
      error: null,
      reasoning: null,
      transcript: [],
      startedAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, state);
    this.guardian.initSession(sessionId);
    this.trace(state, "SYSTEM", "session_started");

    try {
      // ---- Validate & build the cart from the real catalog ----------------
      const wantedIds = Array.from(new Set(items.map((i) => i.productId)));
      const products = await prisma.product.findMany({ where: { id: { in: wantedIds } } });
      const byId = new Map(products.map((p) => [p.id, p]));

      const unknown = wantedIds.filter((id) => !byId.has(id));
      const emptyStock = wantedIds.filter((id) => byId.has(id) && (byId.get(id)?.stock ?? 0) <= 0);
      if (items.length === 0 || unknown.length > 0 || emptyStock.length > 0) {
        const reason = [
          items.length === 0 ? "Cart is empty" : null,
          unknown.length ? `Unknown product(s): ${unknown.join(", ")}` : null,
          emptyStock.length ? `Out of stock: ${emptyStock.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        this.touch(state, "BLOCKED");
        state.error = reason;
        this.trace(state, "GUARDIAN", "cart_blocked", reason);
        await logAgentDecision({
          agentName: "GUARDIAN",
          action: "cart_validation",
          status: "BLOCKED",
          reasoning: reason,
          sessionId,
        });
        return state;
      }

      state.cart = items.map((item) => {
        const product = byId.get(item.productId)!;
        return {
          productId: product.id,
          name: product.name,
          priceInPaise: product.priceInPaise,
          quantity: Math.max(1, Math.min(item.quantity ?? 1, 10)),
        };
      });
      state.cartTotalPaise = state.cart.reduce(
        (sum, item) => sum + item.priceInPaise * item.quantity,
        0
      );
      this.trace(state, "SYSTEM", "cart_loaded", `total ₹${(state.cartTotalPaise / 100).toFixed(2)}`);

      // ---- Phase 1: GROWTH ------------------------------------------------
      const growth = await runGrowthAgent(sessionId, state.cart, state.cartTotalPaise);
      state.upsell = growth.suggestion;
      state.upsellAccepted = growth.suggestion != null;
      state.effectiveTotalPaise = state.cartTotalPaise + (growth.suggestion?.priceInPaise ?? 0);
      state.reasoning = growth.reasoning;
      this.trace(state, "GROWTH", growth.suggestion ? "upsell_suggested" : "no_upsell", growth.reasoning);
      this.touch(state, "GUARDIAN_REVIEW");

      return await this.guardianAndCheckout(state);
    } catch (error) {
      if (error instanceof PauseSignal) {
        state.pendingApproval = error.pending;
        this.touch(state, "AWAITING_HUMAN_APPROVAL");
        this.trace(state, "GUARDIAN", "requires_human_approval", error.pending.reason);
        return state;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.touch(state, "FAILED");
      state.error = message;
      this.trace(state, "SYSTEM", "session_failed", message);
      await logAgentDecision({
        agentName: "SYSTEM",
        action: "session_error",
        status: "FAILED",
        reasoning: message,
        sessionId,
      });
      return state;
    }
  }

  /** Phase 2 (guardian review) + Phase 3 (checkout). */
  private async guardianAndCheckout(state: AgentSessionState): Promise<AgentSessionState> {
    const verdict = await this.guardian.review({
      sessionId: state.sessionId,
      action: "checkout_session",
      amountInPaise: state.effectiveTotalPaise,
      productIds: state.cart.map((item) => item.productId),
    });
    state.guardianVerdicts.push(verdict);

    if (verdict.decision === "BLOCKED") {
      this.touch(state, "BLOCKED");
      state.error = `[${verdict.rule}] ${verdict.reason}`;
      this.trace(state, "GUARDIAN", "blocked", state.error);
      return state;
    }
    if (verdict.decision === "NEEDS_APPROVAL") {
      state.pendingApproval = {
        action: "checkout_session",
        amountInPaise: state.effectiveTotalPaise,
        reason: verdict.reason,
        requestedAt: new Date().toISOString(),
      };
      this.touch(state, "AWAITING_HUMAN_APPROVAL");
      this.trace(state, "GUARDIAN", "requires_human_approval", verdict.reason);
      return state;
    }

    this.trace(state, "GUARDIAN", "approved", verdict.reason);
    this.touch(state, "CHECKOUT");
    return this.executeCheckout(state);
  }

  /** Phase 3: run the checkout agent; convert a PauseSignal into a paused state. */
  private async executeCheckout(state: AgentSessionState): Promise<AgentSessionState> {
    try {
      const result = await runCheckoutAgent(state, this.guardian);
      state.reasoning = result.reasoning;
      this.trace(state, "CHECKOUT", "checkout_finished", result.reasoning);
      this.touch(state, state.orders.length > 0 ? "COMPLETED" : "FAILED");
      if (state.phase === "FAILED" && !state.error) {
        state.error = "Checkout finished without creating an order";
      }
    } catch (error) {
      if (error instanceof PauseSignal) {
        state.pendingApproval = error.pending;
        this.touch(state, "AWAITING_HUMAN_APPROVAL");
        this.trace(state, "GUARDIAN", "requires_human_approval", error.pending.reason);
        return state;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.touch(state, "FAILED");
      state.error = message;
      this.trace(state, "SYSTEM", "checkout_failed", message);
    }
    return state;
  }

  /**
   * Resume a session paused in AWAITING_HUMAN_APPROVAL.
   * `approved=true` records the human approval with the guardian and proceeds
   * to checkout; `false` blocks the session permanently.
   */
  async resume(sessionId: string, approved: boolean): Promise<AgentSessionState | undefined> {
    const state = this.sessions.get(sessionId);
    if (!state) return undefined;
    if (state.phase !== "AWAITING_HUMAN_APPROVAL" || !state.pendingApproval) {
      return state;
    }

    const amount = state.pendingApproval.amountInPaise;
    await this.guardian.recordApproval(sessionId, amount, approved);

    if (!approved) {
      this.touch(state, "BLOCKED");
      state.error = `Human rejected the paused action of ₹${(amount / 100).toFixed(2)}`;
      this.trace(state, "GUARDIAN", "human_rejected", state.error);
      return state;
    }

    this.trace(state, "GUARDIAN", "human_approved", `₹${(amount / 100).toFixed(2)} approved — resuming`);
    this.touch(state, "CHECKOUT");
    return this.executeCheckout(state);
  }
}

const globalForOrchestrator = globalThis as unknown as { __orchestrator?: MultiAgentOrchestrator };

/** Singleton so paused sessions can be resumed across requests. */
export function getOrchestrator(): MultiAgentOrchestrator {
  if (!globalForOrchestrator.__orchestrator) {
    globalForOrchestrator.__orchestrator = new MultiAgentOrchestrator(getGuardian());
  }
  return globalForOrchestrator.__orchestrator;
}
