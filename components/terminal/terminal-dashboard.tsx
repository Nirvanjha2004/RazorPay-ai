"use client";

import { useCallback, useEffect, useState } from "react";

import { usePolling } from "./use-polling";
import type { StreamResponse, AuditLogRow } from "./types";
import { ActivityFeed } from "./activity-feed";
import { AuditPanel } from "./audit-panel";
import { GuardianCard } from "./guardian-card";
import { CustomerChat } from "./customer-chat";
import { AiBuyerDemo } from "@/components/ai-buyer/ai-buyer-demo";

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

export function TerminalDashboard() {
  const [sessionId, setSessionId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [failureInjected, setFailureInjected] = useState(false);
  const [clock, setClock] = useState("");

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
  const approve = useCallback(() => void post("/api/chat", { message: "approve" }), [post]);
  const reject = useCallback(() => void post("/api/chat", { message: "cancel" }), [post]);

  const injectFailure = useCallback(async () => {
    setFailureInjected(true);
    await post("/api/simulate-payment-failure", {});
    setTimeout(() => setFailureInjected(false), 4000);
  }, [post]);

  const resetSession = useCallback(() => {
    const id = `terminal_${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
  }, []);

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

      {/* Three-column body */}
      <div className="grid min-h-0 flex-1 gap-4 bg-[#F9F8F6] p-4 lg:grid-cols-[320px_1fr_380px]">
        {/* Left: customer simulator */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CustomerChat feed={view.feed} busy={busy} onSend={sendMessage} />
          <div className="border-t border-slate-100 bg-amber-50/50 p-3">
            <button
              onClick={() => void injectFailure()}
              disabled={busy}
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
            >
              Inject payment failure
            </button>
            <p className={`mt-1.5 min-h-[14px] text-center text-xs ${failureInjected ? "text-red-600" : "text-slate-400"}`}>
              {failureInjected ? "Payment failure injected — watch the fallback flow" : "Test graceful failure handling"}
            </p>
          </div>
        </div>

        {/* Center: live agent activity */}
        <div className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ActivityFeed feed={view.feed} phase={view.phase} />
        </div>

        {/* Right: guardian + audit trail */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <GuardianCard
              guardian={view.guardian}
              onApprove={approve}
              onReject={reject}
              busy={busy}
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
