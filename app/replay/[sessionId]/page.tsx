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
  GROWTH: "text-violet-700", CHECKOUT: "text-[#204CF5]", GUARDIAN: "text-amber-700",
  BUYER: "text-violet-700", SYSTEM: "text-slate-600", CUSTOMER: "text-slate-700",
};
const AB: Record<string, string> = {
  GROWTH: "bg-violet-50 text-violet-700 ring-violet-200",
  CHECKOUT: "bg-blue-50 text-[#204CF5] ring-blue-200",
  GUARDIAN: "bg-amber-50 text-amber-800 ring-amber-200",
  BUYER: "bg-violet-50 text-violet-700 ring-violet-200",
  SYSTEM: "bg-slate-50 text-slate-700 ring-slate-200",
  CUSTOMER: "bg-slate-900 text-white ring-slate-900",
};

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "SUCCESS" || s === "APPROVED") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (s === "BLOCKED") return <XCircle className="h-4 w-4 text-red-500" />;
  if (s === "NEEDS_APPROVAL") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
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

  if (loading) return <div className="grid h-[60vh] place-items-center text-sm text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-[#204CF5]" /> Loading replay…</div>;
  if (error || !data) return (
    <div className="grid h-[60vh] place-items-center p-8 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Replay not found</p>
        <p className="mt-1 text-sm text-slate-500">{error ?? "No data for this session."}</p>
        <Link href="/audit" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#204CF5] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to Audit Trail</Link>
      </div>
    </div>
  );

  const visible = data.steps.slice(0, stepIndex + 1);
  const cur = data.steps[stepIndex];

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/audit" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link>
              <div>
                <p className="text-sm font-semibold text-slate-900">Session replay</p>
                <p className="font-mono text-xs text-slate-500">{sessionId}</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{data.source} · {data.steps.length} steps</span>
          </header>

          <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-2">
            <button onClick={stepBack} disabled={stepIndex === 0} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><SkipBack className="h-4 w-4" /></button>
            <button onClick={() => setPlaying(!playing)} className="rounded-xl bg-slate-900 p-2 text-white hover:bg-slate-800">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
            <button onClick={stepForward} disabled={stepIndex >= data.steps.length - 1} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><SkipForward className="h-4 w-4" /></button>
            <button onClick={restart} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><RotateCcw className="h-4 w-4" /></button>
            <div className="ml-auto text-xs text-slate-500">Step <span className="font-semibold text-slate-900">{stepIndex + 1}</span> / {data.steps.length}</div>
          </div>

          <div className="h-1 bg-slate-100"><motion.div className="h-full bg-[#204CF5]" animate={{ width: `${((stepIndex + 1) / data.steps.length) * 100}%` }} transition={{ duration: 0.3 }} /></div>

          <div className="space-y-3 bg-[#F9F8F6] p-4">
            <AnimatePresence>
              {visible.map((step, i) => (
                <motion.div key={step.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                  className={`rounded-xl border p-4 ${i === stepIndex ? "border-[#204CF5]/30 bg-white shadow-sm" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <StatusIcon s={step.status} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-bold ${AC[step.agent] ?? "text-slate-700"}`}>{step.agent}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${AB[step.agent] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>{step.action}</span>
                          {step.amount != null && <span className="font-mono text-xs font-medium text-slate-600">{fmt(step.amount)}</span>}
                        </div>
                        {step.reasoning && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">{step.reasoning}</p>}
                        {step.error && <p className="mt-1 text-sm text-red-600">{step.error}</p>}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-slate-400">{new Date(step.at).toLocaleTimeString("en-GB")}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {cur && (
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`font-bold ${AC[cur.agent] ?? "text-slate-700"}`}>{cur.agent}</span><span>·</span><span>{cur.action}</span><span>·</span>
                <span className={cur.status === "SUCCESS" || cur.status === "APPROVED" ? "font-semibold text-emerald-700" : cur.status === "BLOCKED" ? "font-semibold text-red-600" : "font-semibold text-amber-700"}>{cur.status}</span>
              </div>
              {cur.reasoning && <p className="mt-1 text-sm text-slate-700">{cur.reasoning}</p>}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
