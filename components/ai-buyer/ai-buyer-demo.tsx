"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AGENT_STYLES, statusChip } from "@/components/terminal/types";
import { formatINR } from "@/lib/utils";
import type { BuyerRunSummary, BuyerStep } from "@/lib/buyer/agent";

interface RunResult {
  replayId: string;
  sessionId: string;
  steps: BuyerStep[];
  summary: BuyerRunSummary;
}

interface RecentRun {
  id: string;
  request: string;
  createdAt: string;
}

const DEFAULT_REQUEST =
  "Buy me the best coffee maker under ₹20,000 with a maintenance kit";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function AgentBadge({ agent }: { agent: string }) {
  const style = AGENT_STYLES[agent as keyof typeof AGENT_STYLES] ?? AGENT_STYLES.SYSTEM;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${style.badge.replace("border","ring")}`}>
      {style.label}
    </span>
  );
}

export function AiBuyerDemo() {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RecentRun[]>([]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-buy/runs", { cache: "no-store" });
      const json = (await res.json()) as { runs: RecentRun[] };
      setRuns(json.runs ?? []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (open) void loadRuns();
  }, [open, loadRuns]);

  const animateSteps = useCallback(async (steps: BuyerStep[]) => {
    for (let i = 0; i < steps.length; i++) {
      setRevealed(i + 1);
      await wait(320);
    }
  }, []);

  async function runBuyer() {
    if (!request.trim() || running) return;
    setRunning(true);
    setError(null);
    setRun(null);
    setRevealed(0);
    try {
      const res = await fetch("/api/agent-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const json = (await res.json()) as RunResult & { error?: string };
      if (!res.ok || !json.replayId) {
        setError(json.error ?? "Buyer run failed");
        return;
      }
      setRun(json);
      await animateSteps(json.steps);
      void loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function replay(id: string) {
    setRunning(true);
    setError(null);
    setRun(null);
    setRevealed(0);
    try {
      const res = await fetch(`/api/agent-buy/${id}`, { cache: "no-store" });
      const json = (await res.json()) as RunResult & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Replay failed");
        return;
      }
      setRun(json);
      await animateSteps(json.steps);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function decide(id: string, approved: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-buy/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const json = (await res.json()) as RunResult & { steps: BuyerStep[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Decision failed");
        return;
      }
      setRun(json);
      setRevealed(0);
      await animateSteps(json.steps);
      void loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const done = run && revealed >= run.steps.length && run.steps.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#204CF5] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1a3fd6]"
      >
        ⟡ AI Buyer
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 10 }}
              className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div>
                  <p className="text-sm font-bold tracking-tight text-slate-900">
                    AI Buyer <span className="font-normal text-slate-500">— natural language checkout</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Catalog read → Guardian-gated order → replayable log
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </header>

              <div className="border-b border-slate-100 bg-white p-4">
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runBuyer();
                  }}
                >
                  <input
                    value={request}
                    onChange={(event) => setRequest(event.target.value)}
                    disabled={running}
                    placeholder="What should the buyer purchase?"
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-[#204CF5]/30 focus:outline-none focus:ring-2 focus:ring-[#204CF5]/15"
                  />
                  <button
                    type="submit"
                    disabled={running || !request.trim()}
                    className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {running ? "Running…" : "Run buyer"}
                  </button>
                </form>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#F9F8F6] p-4 scrollbar-thin">
                {!run && !error && (
                  <RecentRuns runs={runs} onReplay={(id) => void replay(id)} />
                )}
                {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
                {run && <StepsLog run={run} revealed={revealed} running={running} />}
              </div>

              {done && run && (
                <SummaryFooter
                  run={run}
                  onReplay={(id) => void replay(id)}
                  onDecide={(approved) => void decide(run.replayId, approved)}
                  busy={running}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function RecentRuns(props: { runs: RecentRun[]; onReplay: (id: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-widest text-slate-500">
        PREVIOUS REPLAYS ({props.runs.length})
      </p>
      {props.runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">No saved runs yet. Run the buyer to create one.</p>
      ) : (
        <ul className="space-y-2">
          {props.runs.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => props.onReplay(item.id)}
                className="w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="font-mono text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-IN")}</span>
                <span className="ml-2">{item.request}</span>
                <span className="ml-2 text-xs font-semibold text-[#204CF5]">Replay →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepsLog(props: { run: RunResult; revealed: number; running: boolean }) {
  const { run, revealed, running } = props;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-widest text-slate-500">
        STREAM · replay #{run.replayId.slice(0, 8)}
      </p>
      {run.steps.slice(0, revealed).map((step, index) => {
        const chip = step.status ? statusChip(step.status) : null;
        return (
          <motion.div
            key={`${step.at}-${index}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AgentBadge agent={step.agent} />
              <span className="text-xs font-semibold text-slate-600">{step.action}</span>
              {chip && (
                <span className={`rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold ring-1 ring-slate-200 ${chip.cls}`}>
                  {step.status}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{step.detail}</p>
          </motion.div>
        );
      })}
      {running && revealed < run.steps.length && (
        <p className="animate-pulse text-sm font-medium text-[#204CF5]">Working…</p>
      )}
    </div>
  );
}

function SummaryFooter(props: {
  run: RunResult;
  onReplay: (id: string) => void;
  onDecide: (approved: boolean) => void;
  busy: boolean;
}) {
  const { run, onReplay, onDecide, busy } = props;
  const paused = run.summary.guardian.decision === "NEEDS_APPROVAL" && run.summary.pendingApproval;
  return (
    <footer className="border-t border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-slate-500">TRANSACTION SUMMARY</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {run.summary.selections.map((selection) => (
              <li key={selection.productId} className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  {selection.name} — <span className="font-mono font-semibold">{formatINR(selection.priceInPaise)}</span>{" "}
                  <span className="text-slate-500">({selection.reason})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs font-medium text-slate-500">
            Total <span className="ml-1 font-mono text-sm font-bold text-slate-900">{formatINR(run.summary.totalPaise)}</span>
          </p>
          <p className="mt-1 text-xs">
            Guardian{" "}
            <span
              className={
                run.summary.guardian.decision === "APPROVED"
                  ? "font-semibold text-emerald-700"
                  : run.summary.guardian.decision === "NEEDS_APPROVAL"
                    ? "font-semibold text-amber-700"
                    : "font-semibold text-red-600"
              }
            >
              {run.summary.guardian.decision}
            </span>
          </p>
          {paused && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onDecide(true)}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => onDecide(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
          {run.summary.order && (
            <p className="mt-2 max-w-[260px] truncate text-xs text-slate-600">
              {run.summary.order.mode === "demo" ? "Demo " : ""}order {run.summary.order.orderId}
              {run.summary.order.paymentLinkUrl && (
                <span className="block truncate font-mono text-[#204CF5]">{run.summary.order.paymentLinkUrl}</span>
              )}
            </p>
          )}
          {run.summary.demoMode && (
            <p className="mt-1 text-xs font-medium text-amber-700">Demo mode — Razorpay test keys not configured</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="font-mono text-xs text-slate-500">
          replay id: <span className="text-slate-700">{run.replayId}</span>
        </span>
        <button
          onClick={() => onReplay(run.replayId)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Replay this run
        </button>
      </div>
    </footer>
  );
}
