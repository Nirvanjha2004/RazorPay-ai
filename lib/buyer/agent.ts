/**
 * AI BUYER AGENT — transacts on natural language.
 *
 * Pipeline:
 *   1. Parse the request (budget/category/add-ons)            BUYER
 *   2. Read the agent-readable /api/catalog feed              BUYER
 *   3. Pick the best in-stock product within budget (+add-ons) BUYER
 *   4. Guardian-gated money action                             GUARDIAN
 *   5. Create the order (live Razorpay, or demo when no keys)  CHECKOUT
 *
 * Every step is both audited AND persisted as a replayable run in the
 * BuyerRun table (session replay for judges).
 */

import { prisma } from "@/lib/db";
import { buildAgentCatalog } from "@/lib/catalog";
import { parseBuyerIntent, type BuyerIntent } from "@/lib/buyer/intent";
import {
  createOrder,
  createPaymentLinkForAmount,
  isRazorpayConfigured,
} from "@/lib/razorpay/client";
import {
  getGuardian,
  MAX_SESSION_SPEND_PAISE,
} from "@/lib/agents/multiagent/guardian";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import type { GuardianVerdict } from "@/lib/agents/multiagent/types";
import { formatINR } from "@/lib/utils";

export const MAINTENANCE_KIT_ID = "prod_maintenance_kit";

export type BuyStepAgent = "BUYER" | "GUARDIAN" | "CHECKOUT" | "SYSTEM";

export interface BuyerStep {
  at: string;
  agent: BuyStepAgent;
  action: string;
  detail: string;
  status: string; // INFO | SUCCESS | WARN | FAILED | BLOCKED | NEEDS_APPROVAL
}

export interface BuyerSelection {
  productId: string;
  name: string;
  priceInPaise: number;
  reason: string;
}

export interface BuyerRunSummary {
  sessionId: string;
  engine: string;
  request: string;
  intent: {
    budgetPaise: number | null;
    categories: string[];
    wantMaintenanceKit: boolean;
  };
  selections: BuyerSelection[];
  totalPaise: number;
  guardian: GuardianVerdict;
  pendingApproval: {
    action: string;
    amountInPaise: number;
    reason: string;
  } | null;
  order: {
    mode: "live" | "demo";
    orderId: string;
    status: string;
    paymentLinkUrl?: string;
  } | null;
  demoMode: boolean;
}

function stepOf(agent: BuyStepAgent, action: string, detail: string, status = "INFO"): BuyerStep {
  return { at: new Date().toISOString(), agent, action, detail, status };
}

function summarizeIntent(intent: BuyerIntent): string {
  const budget = intent.budgetPaise != null ? formatINR(intent.budgetPaise) : "unlimited";
  const categories = intent.categories.length > 0 ? intent.categories.join(", ") : "all";
  const kit = intent.wantMaintenanceKit ? "maintenance kit requested" : "no add-on requested";
  return `budget: ${budget} · categories: ${categories} · ${kit}`;
}
export async function runBuyerRun(
  request: string
): Promise<{ replayId: string; steps: BuyerStep[]; summary: BuyerRunSummary }> {
  const sessionId = `buy_${crypto.randomUUID()}`;
  const steps: BuyerStep[] = [];
  const push = (agent: BuyStepAgent, action: string, detail: string, status = "INFO") =>
    steps.push(stepOf(agent, action, detail, status));

  const demoMode = !isRazorpayConfigured();

  // 1. Parse ----------------------------------------------------------------
  push("BUYER", "parse_request", `Parsing: "${request}"`);
  const intent = parseBuyerIntent(request);
  push("BUYER", "parse_request", summarizeIntent(intent), "SUCCESS");

  // 2. Read the agent-readable catalog feed ----------------------------------
  push("BUYER", "read_catalog_feed", "GET /api/catalog …");
  const catalog = await buildAgentCatalog();
  push("BUYER", "read_catalog_feed", `Feed OK: ${catalog.product_count} products · v${catalog.catalog_version}`, "SUCCESS");

  // 3. Pick products ----------------------------------------------------------
  const categorySet = new Set(
    intent.categories.length > 0 ? intent.categories : catalog.products.map((p) => p.category)
  );
  const candidates = catalog.products.filter(
    (p) =>
      categorySet.has(p.category) &&
      p.availability !== "out_of_stock" &&
      (intent.budgetPaise == null || p.price_in_paise <= intent.budgetPaise)
  );

  const selections: BuyerSelection[] = [];
  if (candidates.length === 0) {
    const detail = "No in-stock product matches the request within budget.";
    push("BUYER", "select_products", detail, "BLOCKED");
    await logAgentDecision({
      agentName: "BUYER", action: "select_products", status: "BLOCKED",
      reasoning: detail, sessionId,
    });
    return {
      replayId: "",
      steps,
      summary: { sessionId, engine: "deterministic", request, intent, selections, totalPaise: 0, guardian: { decision: "BLOCKED", rule: "no_match", reason: detail }, pendingApproval: null, order: null, demoMode },
    };
  }

  // "Best" = highest-value in-stock item within budget.
  candidates.sort((a, b) => b.price_in_paise - a.price_in_paise);
  const best = candidates[0];
  selections.push({
    productId: best.id,
    name: best.name,
    priceInPaise: best.price_in_paise,
    reason: `Best in-stock ${best.category} within budget`,
  });
  push(
    "BUYER",
    "select_products",
    `Selected ${best.name} — ${formatINR(best.price_in_paise)} (in stock, within budget)`,
    "SUCCESS"
  );

  // Add-on: requested maintenance kit
  if (intent.wantMaintenanceKit) {
    push("BUYER", "find_addon", `Looking for a maintenance kit in the feed…`);
    const kit = catalog.products.find(
      (p) => p.id === MAINTENANCE_KIT_ID && p.availability !== "out_of_stock"
    );
    if (!kit) {
      push("BUYER", "add_addon", "Maintenance kit not available", "WARN");
    } else {
      const runningTotal = selections.reduce((sum, s) => sum + s.priceInPaise, 0);
      const remaining = intent.budgetPaise != null ? intent.budgetPaise - runningTotal : Infinity;
      if (kit.price_in_paise <= remaining) {
        selections.push({
          productId: kit.id,
          name: kit.name,
          priceInPaise: kit.price_in_paise,
          reason: "Requested maintenance kit add-on",
        });
        push("BUYER", "add_addon", `Added ${kit.name} — ${formatINR(kit.price_in_paise)} (within remaining budget)`, "SUCCESS");
      } else {
        push("BUYER", "add_addon", `Maintenance kit (${formatINR(kit.price_in_paise)}) exceeds remaining budget — skipped`, "WARN");
      }
    }
  }
let totalPaise = selections.reduce((sum, s) => sum + s.priceInPaise, 0);

  // 4. Guardian gate ----------------------------------------------------------
  push("GUARDIAN", "gate_checkout", `Amount ${formatINR(totalPaise)} passed to the governor…`);
  const guardian = getGuardian();
  let verdict = await guardian.review({
    sessionId,
    action: "checkout_session",
    amountInPaise: totalPaise,
    productIds: selections.map((s) => s.productId),
  });
  push("GUARDIAN", "gate_checkout", `${verdict.decision} — ${verdict.reason}`, verdict.decision);

  // 4b. Adaptive re-plan when the guardian's session spend cap stops the buy.
  if (verdict.decision === "BLOCKED" && verdict.rule === "max_session_spend") {
    push(
      "BUYER",
      "adapt_to_guardian",
      `Governor capped autonomous spend at ${formatINR(MAX_SESSION_SPEND_PAISE)} — re-planned within the cap`
    );
    const candidatesWithinCap = candidates.filter((p) => p.price_in_paise <= MAX_SESSION_SPEND_PAISE);
    if (candidatesWithinCap.length > 0) {
      const replanned: BuyerSelection[] = [];
      const primaryWithinCap = candidatesWithinCap.sort((a, b) => b.price_in_paise - a.price_in_paise)[0];
      replanned.push({
        productId: primaryWithinCap.id,
        name: primaryWithinCap.name,
        priceInPaise: primaryWithinCap.price_in_paise,
        reason: `Best ${primaryWithinCap.category} within the governor's session cap`,
      });
      const kit = catalog.products.find(
        (p) => p.id === MAINTENANCE_KIT_ID && p.availability !== "out_of_stock"
      );
      if (intent.wantMaintenanceKit && kit && replanned[0].priceInPaise + kit.price_in_paise <= MAX_SESSION_SPEND_PAISE) {
        replanned.push({ productId: kit.id, name: kit.name, priceInPaise: kit.price_in_paise, reason: "Maintenance kit (within session cap)" });
      }
      selections.length = 0;
      selections.push(...replanned);
      totalPaise = selections.reduce((sum, s) => sum + s.priceInPaise, 0);
      push("BUYER", "adapt_to_guardian", `Re-planned basket: ${selections.map((s) => s.name).join(" + ")} (${formatINR(totalPaise)})`, "SUCCESS");
      verdict = await guardian.review({
        sessionId,
        action: "checkout_session",
        amountInPaise: totalPaise,
        productIds: selections.map((s) => s.productId),
      });
      push("GUARDIAN", "gate_checkout", `(re-check) ${verdict.decision} — ${verdict.reason}`, verdict.decision);
      push("GUARDIAN", "gate_checkout", `(re-check) ${verdict.decision} — ${verdict.reason}`, verdict.decision);
    } else {
      push("BUYER", "adapt_to_guardian", "No qualifying product fits inside the session cap", "WARN");
    }
  }

  let pendingApproval: BuyerRunSummary["pendingApproval"] = null;
  if (verdict.decision === "NEEDS_APPROVAL") {
    pendingApproval = {
      action: "checkout_session",
      amountInPaise: totalPaise,
      reason: verdict.reason,
    };
    push(
      "GUARDIAN",
      "requires_human_approval",
      `Run paused — ${verdict.reason} (approve or reject the run)`,
      "NEEDS_APPROVAL"
    );
  }

  let orderInfo: BuyerRunSummary["order"] = null;
  if (verdict.decision === "APPROVED") {
    orderInfo = await createOrderForBuyer({ sessionId, totalPaise, selections, push, demoMode });
  }

  push("SYSTEM", "complete", verdict.decision === "NEEDS_APPROVAL" ? "AI buyer run paused for human approval" : "AI buyer run finished", verdict.decision === "NEEDS_APPROVAL" ? "NEEDS_APPROVAL" : "SUCCESS");

  // Persist as a session replay + audit every step
  const summary: BuyerRunSummary = {
    sessionId,
    engine: "deterministic",
    request,
    intent: { budgetPaise: intent.budgetPaise, categories: intent.categories, wantMaintenanceKit: intent.wantMaintenanceKit },
    selections,
    totalPaise,
    guardian: verdict,
    pendingApproval,
    order: orderInfo,
    demoMode,
  };

  const run = await prisma.buyerRun.create({
    data: {
      request,
      intentJson: JSON.stringify(intent),
      stepsJson: JSON.stringify(steps),
      summaryJson: JSON.stringify(summary),
    },
  });

  for (const step of steps) {
    await logAgentDecision({
      agentName: step.agent,
      action: step.action,
      status: step.status,
      reasoning: step.detail,
      amountInPaise: totalPaise || null,
      sessionId,
      meta: { replay_id: run.id },
    });
  }

  return { replayId: run.id, steps, summary };
}

/** Step 5: create the order via the same Guardian-gated flow (live or demo). */
async function createOrderForBuyer(params: {
  sessionId: string;
  totalPaise: number;
  selections: BuyerSelection[];
  push: (agent: BuyStepAgent, action: string, detail: string, status?: string) => void;
  demoMode: boolean;
}): Promise<BuyerRunSummary["order"]> {
  const { sessionId, totalPaise, selections, push, demoMode } = params;
  const itemsJson = JSON.stringify(
    selections.map((s) => ({ productId: s.productId, name: s.name, priceInPaise: s.priceInPaise, quantity: 1 }))
  );

  if (!demoMode) {
    push("CHECKOUT", "create_order", "Calling Razorpay Orders API (test mode)…");
    try {
      const order = await createOrder(totalPaise, { session_id: sessionId, source: "agent-buy" });
      await prisma.order.create({
        data: {
          razorpayOrderId: order.id,
          amountInPaise: order.amount,
          currency: order.currency,
          status: "CREATED",
          channel: "agent-buy",
          itemsJson,
          notes: JSON.stringify({ session_id: sessionId }),
        },
      });
      getGuardian().commitSpend(sessionId, order.amount);
      push("CHECKOUT", "create_order", `Order ${order.id} created (${formatINR(order.amount)})`, "SUCCESS");
      return { mode: "live", orderId: order.id, status: order.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      push("CHECKOUT", "create_order", `Razorpay order failed: ${message}`, "FAILED");
      push("CHECKOUT", "payment_fallback", "Falling back to a Razorpay payment link…");
      try {
        const link = await createPaymentLinkForAmount(totalPaise, `Agent-buy order ${sessionId.slice(0, 8)}`);
        push("CHECKOUT", "payment_fallback", `Payment link ready: ${link.short_url}`, "SUCCESS");
        return { mode: "live", orderId: "-", status: "LINK_SENT", paymentLinkUrl: link.short_url };
      } catch (linkError) {
        const linkMessage = linkError instanceof Error ? linkError.message : String(linkError);
        push("CHECKOUT", "payment_fallback", `Fallback failed: ${linkMessage}`, "FAILED");
        return null;
      }
    }
  }

  // Demo mode: local order row, no Razorpay call.
  const orderId = `order_demo_${crypto.randomUUID().slice(0, 8)}`;
  await prisma.order.create({
    data: {
      razorpayOrderId: orderId,
      amountInPaise: totalPaise,
      currency: "INR",
      status: "PAID",
      channel: "agent-buy",
      itemsJson,
      notes: JSON.stringify({ demo: true, session_id: sessionId }),
    },
  });
  getGuardian().commitSpend(sessionId, totalPaise);
  push(
    "CHECKOUT",
    "create_order",
    `DEMO order ${orderId} created for ${formatINR(totalPaise)} (no real money moved — Razorpay test keys not configured)`,
    "SUCCESS"
  );
  return { mode: "demo", orderId, status: "PAID" };
}
/**
 * Resume a paused buyer run (NEEDS_APPROVAL) with a human decision.
 * Re-loads the run from the replay table, then either creates the order
 * (approved) or marks it blocked (rejected).
 */
export async function approveBuyerRun(
  replayId: string,
  approved: boolean
): Promise<{ summary: BuyerRunSummary; steps: BuyerStep[] } | null> {
  const run = await prisma.buyerRun.findUnique({ where: { id: replayId } });
  if (!run) return null;

  const summary = JSON.parse(run.summaryJson) as BuyerRunSummary;
  if (!summary.pendingApproval || summary.order) {
    return { summary, steps: JSON.parse(run.stepsJson) as BuyerStep[] };
  }

  const guardian = getGuardian();
  const { sessionId, selections, demoMode } = summary;
  const amount = summary.pendingApproval.amountInPaise;
  const steps = JSON.parse(run.stepsJson) as BuyerStep[];
  const push = (agent: BuyStepAgent, action: string, detail: string, status = "INFO") =>
    steps.push({ at: new Date().toISOString(), agent, action, detail, status });

  await guardian.recordApproval(sessionId, amount, approved);

  if (!approved) {
    summary.guardian = { decision: "BLOCKED", rule: "human_rejected", reason: `Human rejected the paused buy of ${formatINR(amount)}` };
    summary.pendingApproval = null;
    summary.order = null;
    push("GUARDIAN", "human_rejected", `Buy of ${formatINR(amount)} rejected — run blocked`, "BLOCKED");
    await prisma.buyerRun.update({ where: { id: replayId }, data: { summaryJson: JSON.stringify(summary), stepsJson: JSON.stringify(steps) } });
    return { summary, steps };
  }

  push("GUARDIAN", "human_approved", `Buy of ${formatINR(amount)} approved — proceeding`, "APPROVED");
  summary.pendingApproval = null;

  const verdict = await guardian.review({
    sessionId,
    action: "checkout_session",
    amountInPaise: amount,
    productIds: selections.map((s) => s.productId),
  });
  if (verdict.decision === "APPROVED") {
    summary.order = await createOrderForBuyer({ sessionId, totalPaise: amount, selections, push, demoMode });
    summary.guardian = verdict;
    push("SYSTEM", "complete", "AI buyer run completed after human approval", "SUCCESS");
  } else {
    summary.guardian = verdict;
    push("GUARDIAN", "gate_checkout", `${verdict.decision} — ${verdict.reason}`, verdict.decision);
  }

  await prisma.buyerRun.update({ where: { id: replayId }, data: { summaryJson: JSON.stringify(summary), stepsJson: JSON.stringify(steps) } });
  return { summary, steps };
}