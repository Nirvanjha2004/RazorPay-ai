"use client";

import { useCallback, useEffect, useState, useRef, useContext } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarCollapsedContext } from "@/components/app-shell";

import { usePolling } from "./use-polling";
import type { StreamResponse, AuditLogRow } from "./types";
import { ActivityFeed, type RecoveryStep } from "./activity-feed";
import { AuditPanel } from "./audit-panel";
import { GuardianCard } from "./guardian-card";
import { CustomerChat } from "./customer-chat";
import { GuardianStatsStrip } from "./guardian-stats";
import { AiBuyerDemo } from "@/components/ai-buyer/ai-buyer-demo";
import { RazorpayCheckoutButton } from "@/components/razorpay-checkout-button";

const SESSION_KEY = "commerceagent_session_id";
const EMPTY_STREAM: StreamResponse = {
  sessionId: "",
  phase: "BROWSING",
  feed: [],
  guardian: {
    spendPaise: 0,
    orderCount: 0,
    maxSpendPaise: 200_000,
    maxOrders: 3,
    pendingApproval: null,
  },
};

const RECOVERY_SCRIPT: Omit<RecoveryStep, "id">[] = [
  { agent: "CHECKOUT", text: "Processing payment...", kind: "processing" },
  { agent: "CHECKOUT", text: "❌ Payment declined (test failure injected)", status: "FAILED", kind: "failure" },
  { agent: "CHECKOUT", text: "Payment failed. Policy: retry once, fallback to payment link.", kind: "thought" },
  { agent: "CHECKOUT", text: "retry_payment(order_id: order_78x2)", kind: "tool", detail: "tool · checkout.retry" },
  { agent: "CHECKOUT", text: "❌ Retry also declined", status: "FAILED", kind: "retry_fail" },
  { agent: "CHECKOUT", text: "Escalating to fallback per recovery policy.", kind: "thought" },
  { agent: "CHECKOUT", text: "create_payment_link(amount: ₹8,499)", kind: "tool", detail: "tool · checkout.create_payment_link" },
  { agent: "CHECKOUT", text: "✅ Fallback payment link created & sent to customer", status: "SUCCESS", kind: "fallback" },
];

export function TerminalDashboard() {
  const [sessionId, setSessionId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState("");
  const [recoveryActive, setRecoveryActive] = useState(false);
  const [recoverySteps, setRecoverySteps] = useState<RecoveryStep[]>([]);
  const [recoveryCustomerMsg, setRecoveryCustomerMsg] = useState(false);
  const [transitionState, setTransitionState] = useState<"idle" | "approving" | "rejecting">("idle");
  const approvalRef = useRef<HTMLDivElement>(null);
  const sidebarCollapsed = useContext(SidebarCollapsedContext);

  // Stable session id per browser (persisted so reloads resume the chat).
  useEffect(() => {
    const saved = window.localStorage.getItem(SESSION_KEY);
    const id = saved ?? `terminal_${crypto.randomUUID().slice(0, 8)}`;
    if (!saved) window.localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(timer);
  }, []);

  const stream = usePolling<StreamResponse>(
    sessionId ? `/api/chat/stream?sessionId=${sessionId}` : "",
    1200
  );
  const audit = usePolling<{ logs: AuditLogRow[] }>(`/api/audit?limit=40`, 2500);
  const view = stream ?? EMPTY_STREAM;
  const isAwaiting = !!view.guardian.pendingApproval;

  // Reset transition when pending clears
  const prevPendingRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevPendingRef.current && !isAwaiting && transitionState !== "idle") {
      // pending cleared -> show success toast based on last transition
      if (transitionState === "approving") {
        toast.success("✅ Human approved — resuming checkout");
      } else if (transitionState === "rejecting") {
        toast.error("Human rejected — customer informed");
      }
      const t = setTimeout(() => setTransitionState("idle"), 1200);
      return () => clearTimeout(t);
    }
    prevPendingRef.current = isAwaiting;
  }, [isAwaiting, transitionState]);

  const post = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      setBusy(true);
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...body }),
        });
      } catch {
        // polling keeps last state; errors surface in the feed
      } finally {
        setBusy(false);
      }
    },
    [sessionId]
  );

  const sendMessage = useCallback((text: string) => void post("/api/chat", { message: text }), [post]);

  const handleApprove = useCallback(() => {
    setTransitionState("approving");
    toast.loading("Approving — resuming flow…", { id: "approval" });
    void post("/api/chat", { message: "approve" }).then(() => {
      toast.dismiss("approval");
    });
    // optimistic: after 800ms show green, feed will poll
    setTimeout(() => {
      // banner will clear when polling returns no pending
    }, 800);
  }, [post]);

  const handleReject = useCallback(() => {
    setTransitionState("rejecting");
    toast.loading("Rejecting…", { id: "approval" });
    void post("/api/chat", { message: "cancel" }).then(() => {
      toast.dismiss("approval");
    });
  }, [post]);

  const injectFailure = useCallback(async () => {
    if (recoveryActive) return;
    setRecoveryActive(true);
    setRecoverySteps([]);
    setRecoveryCustomerMsg(false);
    // Fire backend flag as well
    void post("/api/simulate-payment-failure", {});

    // stagger 600ms
    let idx = 0;
    const step = () => {
      if (idx >= RECOVERY_SCRIPT.length) {
        // show customer message in sync
        setRecoveryCustomerMsg(true);
        toast.success("Failure handled gracefully — revenue saved ✅", { duration: 3500 });
        // keep recovery visible for demo, auto-hide after 12s
        setTimeout(() => {
          setRecoveryActive(false);
          setRecoverySteps([]);
          setRecoveryCustomerMsg(false);
        }, 12000);
        return;
      }
      const tpl = RECOVERY_SCRIPT[idx];
      setRecoverySteps((prev) => [...prev, { ...tpl, id: `rec-${idx}-${Date.now()}` }]);
      idx += 1;
      setTimeout(step, 600);
    };
    // start after slight delay so user sees button feedback
    setTimeout(step, 400);
  }, [post, recoveryActive]);

  const scrollToApproval = useCallback(() => {
    approvalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // pulse highlight
    if (approvalRef.current) {
      approvalRef.current.animate(
        [{ boxShadow: "0 0 0 0 rgba(245,158,11,0.0)" }, { boxShadow: "0 0 0 8px rgba(245,158,11,0.25)" }, { boxShadow: "0 0 0 0 rgba(245,158,11,0.0)" }],
        { duration: 900, easing: "ease-out" }
      );
    }
  }, []);

  const resetSession = useCallback(() => {
    const id = `terminal_${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
    setRecoveryActive(false);
    setRecoverySteps([]);
    setRecoveryCustomerMsg(false);
    setTransitionState("idle");
  }, []);

  // Pay CTA — show when order exists & not awaiting approval
  const payOrderId = (view as StreamResponse & { orderId?: string | null }).orderId ?? null;
  const payAmount = (view as StreamResponse & { amountPaise?: number | null }).amountPaise ?? null;
  const showPay = !!payOrderId && view.phase === "AWAITING_PAYMENT" && !isAwaiting;

  // Stats derived from audit logs + feed
  const stats = (() => {
    const logs = audit?.logs ?? [];
    let gatesPassed = 0;
    let blocked = 0;
    let escalated = 0;
    let moneySaved = 0;
    for (const l of logs) {
      if (l.agentType !== "GUARDIAN") continue;
      if (l.status === "APPROVED" || l.status === "SUCCESS") gatesPassed += 1;
      else if (l.status === "BLOCKED") {
        blocked += 1;
        if (l.amountInPaise) moneySaved += l.amountInPaise;
      } else if (l.status === "NEEDS_APPROVAL") escalated += 1;
    }
    // Include current feed pending as escalated if not yet in audit
    if (isAwaiting && escalated === 0) escalated = 1;
    // Fallback demo numbers when empty
    if (logs.length === 0) {
      gatesPassed = view.feed.filter((f) => f.agent === "GUARDIAN" && (f.status === "APPROVED" || f.status === "SUCCESS")).length || 0;
      // show some live numbers for empty state using feed
      if (gatesPassed === 0 && !isAwaiting) {
        gatesPassed = 0;
        blocked = 0;
        escalated = 0;
        moneySaved = 0;
      }
    }
    return { gatesPassed, blocked, escalated, moneySavedPaise: moneySaved };
  })();

  return (
    <div className="flex h-[calc(100vh-92px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <span className="text-xs font-bold">◈</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Live terminal</p>
            <p className="text-xs text-slate-500">Growth · Checkout · Guardian · Customer simulator</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AiBuyerDemo />
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 md:inline-flex">
            {sessionId || "…"}
          </span>
          <span className="font-mono text-xs text-slate-500">{clock}</span>
          <button
            onClick={resetSession}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            New session
          </button>
        </div>
      </div>

      {/* Pending approval banner */}
      <AnimatePresence>
        {isAwaiting && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-500 px-4 py-2.5 text-white"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              1 action requires your approval
              <span className="hidden font-normal text-amber-100 md:inline">· Flow is paused — Guardian is waiting</span>
            </div>
            <button
              onClick={scrollToApproval}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50"
            >
              Review →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guardian stats strip */}
      <div className="border-b border-slate-200 bg-[#F9F8F6] px-4 py-2">
        <GuardianStatsStrip {...stats} />
      </div>

      {/* Three-column body — when sidebar collapses, give the extra 200px to customer simulator, not center */}
      <div
        className="grid min-h-0 flex-1 gap-4 bg-[#F9F8F6] p-4 transition-all duration-300 lg:grid-cols-[320px_1fr_380px]"
        style={
          sidebarCollapsed
            ? { gridTemplateColumns: "520px minmax(0,1fr) 380px" }
            : undefined
        }
      >
        {/* Left: customer simulator */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CustomerChat feed={view.feed} busy={busy} onSend={sendMessage} recoveryMessage={recoveryCustomerMsg ? "Looks like the payment didn't go through — I've sent you a secure payment link instead 🙏" : null} />
          <div className="border-t border-slate-100 bg-amber-50/50 p-3">
            <button
              onClick={() => void injectFailure()}
              disabled={busy || recoveryActive}
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
            >
              {recoveryActive ? "▶ Recovery playing…" : "Inject payment failure"}
            </button>
            <p className={`mt-1.5 min-h-[14px] text-center text-xs ${recoveryActive ? "text-violet-600 font-medium" : "text-slate-400"}`}>
              {recoveryActive ? "Cinematic recovery sequence — watch center feed" : "Test graceful failure handling"}
            </p>
          </div>
        </div>

        {/* Center: live agent activity */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {showPay && payOrderId && (
            <div className="border-b border-slate-200 bg-emerald-50/70 p-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-emerald-800">Ready to pay — Razorpay Checkout attached</p>
              <RazorpayCheckoutButton orderId={payOrderId} amountPaise={payAmount} sessionId={sessionId} />
              <p className="mt-2 text-xs text-slate-500">
                Order {payOrderId} is <span className="font-semibold text-slate-700">CREATED</span> — pay now to fire webhook → status becomes <span className="font-semibold text-emerald-700">PAID</span>. Then ask “what is my order status?” again.
              </p>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            <ActivityFeed
              feed={view.feed}
              phase={view.phase}
              pendingApproval={isAwaiting}
              recoverySteps={recoverySteps}
              recoveryActive={recoveryActive}
            />
          </div>
        </div>

        {/* Right: guardian + audit trail */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <GuardianCard
              guardian={view.guardian}
              onApprove={handleApprove}
              onReject={handleReject}
              busy={busy}
              approvalRef={approvalRef}
              transitionState={transitionState}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <AuditPanel logs={audit?.logs ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
