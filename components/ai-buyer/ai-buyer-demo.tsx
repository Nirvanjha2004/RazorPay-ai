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
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
      {style.label}
    </span>
  );
}

/**
 * "AI BUYER DEMO" — the dashboard button + modal that runs the buyer agent
 * with a streaming step log, and lets judges replay any saved run.
 */
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
        className="rounded border border-emerald-500/60 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold tracking-widest text-emerald-300 hover:bg-emerald-500/25"
      >
        ⟡ AI BUYER DEMO
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 10 }}
              className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                  <p className="text-sm font-bold tracking-widest">
                    AI BUYER <span className="text-emerald-400">DEMO</span>
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    natural language → catalog read → Guardian-gated order → replayable log
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                >
                  ✕ CLOSE
                </button>
              </header>

              <div className="border-b border-zinc-800 p-3">
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
                    className="h-9 flex-1 rounded border border-input bg-transparent px-3 font-mono text-[12px] placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={running || !request.trim()}
                    className="h-9 rounded border border-emerald-500/60 bg-emerald-500/15 px-4 text-[12px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {running ? "RUNNING…" : "RUN BUYER"}
                  </button>
                </form>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono scrollbar-thin">
                {!run && !error && (
                  <RecentRuns runs={runs} onReplay={(id) => void replay(id)} />
                )}
                {error && <p className="mb-3 text-[12px] text-red-400">❌ {error}</p>}
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
      <p className="mb-2 text-[10px] tracking-widest text-zinc-600">
        PREVIOUS REPLAYS ({props.runs.length})
      </p>
      {props.runs.length === 0 ? (
        <p className="text-[11px] text-zinc-600">No saved runs yet. Run the buyer to create one.</p>
      ) : (
        <ul className="space-y-1">
          {props.runs.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => props.onReplay(item.id)}
                className="w-full truncate rounded border border-zinc-800 px-2 py-1 text-left text-[11px] text-zinc-300 hover:border-zinc-600"
              >
                {new Date(item.createdAt).toLocaleString("en-IN")} — {item.request}
                <span className="ml-2 text-[10px] text-emerald-400">replay ▶</span>
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
      <p className="text-[10px] tracking-widest text-zinc-500">
        STREAM · replay#{run.replayId.slice(0, 8)}
      </p>
      {run.steps.slice(0, revealed).map((step, index) => {
        const chip = step.status ? statusChip(step.status) : null;
        return (
          <motion.div
            key={`${step.at}-${index}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded border border-zinc-800/80 bg-zinc-900/50 p-2"
          >
            <div className="flex items-center gap-2">
              <AgentBadge agent={step.agent} />
              <span className="text-[10px] font-semibold text-zinc-400">{step.action}</span>
              {chip && (
                <span className={`text-[10px] ${chip.cls}`}>
                  {chip.icon} {step.status}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{step.detail}</p>
          </motion.div>
        );
      })}
      {running && revealed < run.steps.length && (
        <p className="animate-pulse text-[11px] text-emerald-400">▸ working…</p>
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
    <footer className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-widest text-zinc-500">TRANSACTION SUMMARY</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-300">
            {run.summary.selections.map((selection) => (
              <li key={selection.productId}>
                ▸ {selection.name} — {formatINR(selection.priceInPaise)}{" "}
                <span className="text-zinc-500">({selection.reason})</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-right text-[11px]">
          <p className="text-zinc-500">
            TOTAL{" "}
            <span className="ml-1 text-sm font-bold text-zinc-100">{formatINR(run.summary.totalPaise)}</span>
          </p>
          <p className="mt-0.5">
            GUARDIAN{" "}
            <span
              className={
                run.summary.guardian.decision === "APPROVED"
                  ? "text-emerald-400"
                  : run.summary.guardian.decision === "NEEDS_APPROVAL"
                    ? "text-amber-400"
                    : "text-red-400"
              }
            >
              {run.summary.guardian.decision}
            </span>
          </p>
          {paused && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onDecide(true)}
                disabled={busy}
                className="flex-1 rounded border border-emerald-500/50 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                ✓ APPROVE
              </button>
              <button
                onClick={() => onDecide(false)}
                disabled={busy}
                className="flex-1 rounded border border-red-500/50 bg-red-500/15 px-2 py-1 text-[10px] font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
              >
                ✕ REJECT
              </button>
            </div>
          )}
          {run.summary.order && (
            <p className="mt-0.5 text-zinc-400">
              {run.summary.order.mode === "demo" ? "DEMO " : ""}order {run.summary.order.orderId}
              {run.summary.order.paymentLinkUrl && (
                <span className="block truncate text-sky-400">{run.summary.order.paymentLinkUrl}</span>
              )}
            </p>
          )}
          {run.summary.demoMode && (
            <p className="mt-1 text-[10px] text-amber-400">Demo mode — Razorpay test keys not configured</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2">
        <span className="text-[10px] text-zinc-600">
          replay id: <span className="text-zinc-400">{run.replayId}</span>
        </span>
        <button
          onClick={() => onReplay(run.replayId)}
          className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-500"
        >
          ▶ REPLAY THIS RUN
        </button>
      </div>
    </footer>
  );
}