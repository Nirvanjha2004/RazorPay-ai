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

  // Toast on PAID (replaces big green banner)
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const st = (view as StreamResponse).orderStatus ?? null;
    const id = (view as StreamResponse).orderId ?? null;
    if (st === "PAID" && prevStatusRef.current !== "PAID" && id) {
      const short = `•••${id.slice(-4)}`;
      toast.success(`Order ${short} paid ✓ — revenue captured`, { duration: 3500 });
    }
    prevStatusRef.current = st;
  }, [view]);

  // Reset transition when pending clears
  const prevPendingRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevPendingRef.current && !isAwaiting && transitionState !== "idle") {
      if (transitionState === "approving") toast.success("✅ Human approved — resuming checkout");
      else if (transitionState === "rejecting") toast.error("Human rejected — customer informed");
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
    void post("/api/chat", { message: "approve" }).then(() => toast.dismiss("approval"));
  }, [post]);

  const handleReject = useCallback(() => {
    setTransitionState("rejecting");
    toast.loading("Rejecting…", { id: "approval" });
    void post("/api/chat", { message: "cancel" }).then(() => toast.dismiss("approval"));
  }, [post]);

  const injectFailure = useCallback(async () => {
    if (recoveryActive) return;
    setRecoveryActive(true);
    setRecoverySteps([]);
    setRecoveryCustomerMsg(false);
    void post("/api/simulate-payment-failure", {});
    let idx = 0;
    const step = () => {
      if (idx >= RECOVERY_SCRIPT.length) {
        setRecoveryCustomerMsg(true);
        toast.success("Failure handled gracefully — revenue saved", { duration: 3500 });
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
    setTimeout(step, 400);
  }, [post, recoveryActive]);

  const scrollToApproval = useCallback(() => {
    approvalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const payOrderId = (view as StreamResponse).orderId ?? null;
  const payAmount = (view as StreamResponse).amountPaise ?? null;
  const orderStatus = (view as StreamResponse).orderStatus ?? null;
  const cart = (view as StreamResponse).cart ?? [];
  const showPay = !!payOrderId && view.phase === "AWAITING_PAYMENT" && !isAwaiting && orderStatus !== "PAID";

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
    if (isAwaiting && escalated === 0) escalated = 1;
    if (logs.length === 0) {
      gatesPassed = view.feed.filter((f) => f.agent === "GUARDIAN" && (f.status === "APPROVED" || f.status === "SUCCESS")).length || 0;
    }
    return { gatesPassed, blocked, escalated, moneySavedPaise: moneySaved };
  })();

  return (
    <div className="mx-auto flex max-w-[1440px] h-[calc(100vh-92px)] flex-col overflow-hidden">
      {/* Header — minimal */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-900 ring-1 ring-slate-200">
            ◈
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Live terminal</h1>
            <p className="text-xs text-slate-500">Customer · Agents · Governance</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AiBuyerDemo />
          <span className="hidden font-mono text-xs text-slate-400 md:block">{clock}</span>
          <span className="hidden rounded-xl bg-white px-2.5 py-1.5 font-mono text-xs text-slate-500 ring-1 ring-slate-200 md:block">{sessionId.slice(0, 14)}…</span>
          <button onClick={resetSession} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            New session
          </button>
        </div>
      </div>

      {/* Awaiting banner — subtle, not full shout */}
      <AnimatePresence>
        {isAwaiting && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              1 action waiting for your approval
            </span>
            <button onClick={scrollToApproval} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600">
              Review
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Three columns — 30 / 40 / 30 with breathing room */}
      <div
        className="grid min-h-0 flex-1 gap-6"
        style={
          sidebarCollapsed
            ? { gridTemplateColumns: "380px minmax(0,1.35fr) 420px" }
            : { gridTemplateColumns: "360px minmax(0,1.35fr) 400px" }
        }
      >
        {/* LEFT — Customer */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <CustomerChat
            feed={view.feed}
            busy={busy}
            onSend={sendMessage}
            recoveryMessage={recoveryCustomerMsg ? "Looks like the payment didn't go through — I've sent you a secure payment link instead 🙏" : null}
            orderId={payOrderId}
            orderStatus={orderStatus}
            cart={cart}
            amountPaise={payAmount}
            onInjectFailure={injectFailure}
            recoveryActive={recoveryActive}
            sessionPhase={view.phase}
          />
          {/* Pay CTA lives in LEFT compact order card now — not center. Also provide Checkout here when AWAITING_PAYMENT */}
          {showPay && payOrderId && (
            <div className="border-t border-slate-100 bg-slate-50 p-3">
              <RazorpayCheckoutButton orderId={payOrderId} amountPaise={payAmount} sessionId={sessionId} />
            </div>
          )}
        </div>

        {/* MIDDLE — Hero Agent Activity */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <ActivityFeed
            feed={view.feed}
            phase={view.phase}
            pendingApproval={isAwaiting}
            recoverySteps={recoverySteps}
            recoveryActive={recoveryActive}
          />
        </div>

        {/* RIGHT — Governance single zone */}
        <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <GuardianCard
              guardian={view.guardian}
              onApprove={handleApprove}
              onReject={handleReject}
              busy={busy}
              approvalRef={approvalRef}
              transitionState={transitionState}
            />
            {/* Compact stats chips — inline, not full strip */}
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Passed <b className="text-slate-900">{stats.gatesPassed}</b>
              </span>
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Blocked <b className="text-red-700">{stats.blocked}</b>
              </span>
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Escalated <b className="text-amber-700">{stats.escalated}</b>
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Saved <b className="font-mono text-slate-900">₹{(stats.moneySavedPaise / 100).toLocaleString("en-IN")}</b>
              </span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <AuditPanel logs={audit?.logs ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
