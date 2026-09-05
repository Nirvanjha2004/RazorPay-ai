"use client";

import { useCallback, useEffect, useState } from "react";

import { usePolling } from "./use-polling";
import type { StreamResponse, AuditLogRow } from "./types";
import { ActivityFeed } from "./activity-feed";
import { AuditPanel } from "./audit-panel";
import { GuardianCard } from "./guardian-card";
import { CustomerChat } from "./customer-chat";

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
    <div className="flex h-full flex-col bg-[#050507] font-mono text-[13px] text-zinc-200">
      {/* ── Header bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-widest">
            COMMERCEAGENT <span className="text-emerald-400">TERMINAL</span>
          </span>
          <span className="hidden text-[10px] text-zinc-600 md:inline">
            RAZORPAY · TEST MODE · MULTI-AGENT
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-zinc-500">
            SESSION <span className="text-zinc-300">{sessionId || "…"}</span>
          </span>
          <span className="font-mono text-emerald-400">{clock}</span>
          <button
            onClick={resetSession}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            NEW SESSION
          </button>
        </div>
      </header>

      {/* ── Three-column terminal body ─────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_400px]">
        {/* Left: customer simulator + inject failure */}
        <aside className="flex min-h-0 flex-col border-r border-zinc-800 bg-[#07070a]">
          <CustomerChat feed={view.feed} busy={busy} onSend={sendMessage} />
          <div className="border-t border-zinc-800 p-3">
            <button
              onClick={() => void injectFailure()}
              disabled={busy}
              className="w-full rounded border border-red-500/60 bg-red-500/15 px-3 py-2 text-[11px] font-bold tracking-widest text-red-300 hover:bg-red-500/25 disabled:opacity-50"
            >
              ⚠ INJECT FAILURE
            </button>
            <p className="mt-1.5 h-3 text-center text-[10px] text-red-400">
              {failureInjected ? "PAYMENT FAILURE INJECTED — watch the fallback flow" : ""}
            </p>
          </div>
        </aside>

        {/* Center: live agent activity */}
        <main className="min-h-0 overflow-hidden">
          <ActivityFeed feed={view.feed} phase={view.phase} />
        </main>

        {/* Right: guardian + audit trail */}
        <aside className="flex min-h-0 flex-col border-l border-zinc-800 bg-[#07070a]">
          <GuardianCard
            guardian={view.guardian}
            onApprove={approve}
            onReject={reject}
            busy={busy}
          />
          <AuditPanel logs={audit?.logs ?? []} />
        </aside>
      </div>
    </div>
  );
}
