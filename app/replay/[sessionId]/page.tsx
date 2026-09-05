"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

interface ReplayStep {
  id: string;
  at: string;
  agent: string;
  action: string;
  amount: number | null;
  status: "SUCCESS" | "BLOCKED" | "FAILED" | "APPROVED" | "NEEDS_APPROVAL";
  reasoning: string | null;
  error: string | null;
}

interface ReplayData {
  sessionId: string;
  steps: ReplayStep[];
  source: string;
}

const AC: Record<string, string> = {
  GROWTH: "text-emerald-400", CHECKOUT: "text-sky-400", GUARDIAN: "text-amber-400",
  BUYER: "text-violet-400", SYSTEM: "text-zinc-400", CUSTOMER: "text-zinc-300",
};
const AB: Record<string, string> = {
  GROWTH: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  CHECKOUT: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  GUARDIAN: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  BUYER: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  SYSTEM: "border-zinc-600 bg-zinc-800 text-zinc-300",
  CUSTOMER: "border-zinc-600 bg-zinc-800 text-zinc-200",
};

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "SUCCESS" || s === "APPROVED") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (s === "BLOCKED") return <XCircle className="h-4 w-4 text-red-400" />;
  if (s === "NEEDS_APPROVAL") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
};

const fmt = (p: number | null) => (p == null ? "—" : `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);

export default function ReplayPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [speed, setSpeed] = useState(1500);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/replay/${sessionId}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ReplayData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!playing || !data) return;
    if (stepIndex >= data.steps.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStepIndex((i) => i + 1), speed);
    return () => clearTimeout(t);
  }, [playing, stepIndex, speed, data]);

  const stepForward = useCallback(() => { if (data) setStepIndex((i) => Math.min(i + 1, data.steps.length - 1)); }, [data]);
  const stepBack = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);
  const restart = useCallback(() => { setStepIndex(0); setPlaying(true); }, []);

  if (loading) return <div className="grid h-full place-items-center bg-[#050507] font-mono text-zinc-400"><span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" /> Loading replay…</div>;
  if (error || !data) return (
    <div className="grid h-full place-items-center bg-[#050507] p-8 text-center font-mono">
      <div>
        <p className="text-lg font-bold text-red-400">REPLAY NOT FOUND</p>
        <p className="mt-2 text-sm text-zinc-400">{error ?? "No data for this session."}</p>
        <Link href="/audit" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to Audit Trail</Link>
      </div>
    </div>
  );

  const visible = data.steps.slice(0, stepIndex + 1);
  const cur = data.steps[stepIndex];

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col bg-[#050507] font-mono text-[13px] text-zinc-200">
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
          <div className="flex items-center gap-3">
            <Link href="/audit" className="text-zinc-500 hover:text-zinc-300"><ArrowLeft className="h-4 w-4" /></Link>
            <span className="text-sm font-bold tracking-widest">SESSION REPLAY <span className="text-emerald-400">▶</span></span>
            <span className="text-[10px] text-zinc-500">{sessionId}</span>
          </div>
          <span className="text-[11px] text-zinc-500">{data.source.toUpperCase()} · {data.steps.length} steps</span>
        </header>

        <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#07070a] px-4 py-2">
          <button onClick={stepBack} disabled={stepIndex === 0} className="rounded border border-zinc-700 p-1.5 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30"><SkipBack className="h-4 w-4" /></button>
          <button onClick={() => setPlaying(!playing)} className="rounded border border-emerald-500/50 bg-emerald-500/15 p-1.5 text-emerald-300 hover:bg-emerald-500/25">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
          <button onClick={stepForward} disabled={stepIndex >= data.steps.length - 1} className="rounded border border-zinc-700 p-1.5 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30"><SkipForward className="h-4 w-4" /></button>
          <button onClick={restart} className="rounded border border-zinc-700 p-1.5 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"><RotateCcw className="h-4 w-4" /></button>
          <div className="ml-auto text-[11px] text-zinc-500">STEP <span className="text-zinc-200">{stepIndex + 1}</span> / {data.steps.length}</div>
        </div>

        <div className="h-1 bg-zinc-900"><motion.div className="h-full bg-emerald-500" animate={{ width: `${((stepIndex + 1) / data.steps.length) * 100}%` }} transition={{ duration: 0.3 }} /></div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <AnimatePresence>
            {visible.map((step, i) => (
              <motion.div key={step.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className={`mb-3 rounded-lg border p-3 ${i === stepIndex ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800/60 bg-zinc-950/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <StatusIcon s={step.status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${AC[step.agent] ?? "text-zinc-300"}`}>{step.agent}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${AB[step.agent] ?? "border-zinc-700 text-zinc-400"}`}>{step.action}</span>
                        {step.amount != null && <span className="text-[11px] text-zinc-400">{fmt(step.amount)}</span>}
                      </div>
                      {step.reasoning && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">{step.reasoning}</p>}
                      {step.error && <p className="mt-1 text-xs text-red-400/80">{step.error}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-600">{new Date(step.at).toLocaleTimeString("en-GB")}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {cur && (
          <div className="border-t border-zinc-800 bg-[#07070a] px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className={`font-bold ${AC[cur.agent] ?? "text-zinc-300"}`}>{cur.agent}</span><span>·</span><span>{cur.action}</span><span>·</span>
              <span className={cur.status === "SUCCESS" || cur.status === "APPROVED" ? "text-emerald-400" : cur.status === "BLOCKED" ? "text-red-400" : "text-amber-400"}>{cur.status}</span>
            </div>
            {cur.reasoning && <p className="mt-1 text-xs text-zinc-300">{cur.reasoning}</p>}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

