"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Zap, Info } from "lucide-react";

import { AGENT_STYLES, statusChip, type FeedEntry, isGuardianGate, parseGateMeta, extractAmount } from "./types";

function timeOf(at: string): string {
  const d = new Date(at);
  return isNaN(d.getTime()) ? "--:--:--" : d.toLocaleTimeString("en-GB");
}

function formatCollapsed(entry: FeedEntry): string {
  const amt = extractAmount(entry);
  const amtStr = amt != null ? `₹${(amt / 100).toLocaleString("en-IN")}` : "order";
  return `🛡️ ${amtStr} order — ${entry.status ?? "APPROVED"}`;
}

// Gate card with left border hero
function GuardianGateCard({
  entry,
  pending,
}: {
  entry: FeedEntry;
  pending: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = parseGateMeta(entry);
  const isApproved = entry.status === "APPROVED" || entry.status === "SUCCESS";
  const isBlocked = entry.status === "BLOCKED" || entry.status === "FAILED";
  const isNeedsApproval = entry.status === "NEEDS_APPROVAL";

  // auto-collapse APPROVED after 3s
  useEffect(() => {
    if (isApproved && !pending) {
      const t = setTimeout(() => setCollapsed(true), 3000);
      return () => clearTimeout(t);
    }
  }, [isApproved, pending]);

  const borderColor = isBlocked
    ? "border-l-red-500"
    : isNeedsApproval
      ? "border-l-amber-500"
      : "border-l-emerald-500";

  const bg = isBlocked
    ? "bg-red-50/60"
    : isNeedsApproval
      ? "bg-amber-50/80"
      : collapsed
        ? "bg-emerald-50/50"
        : "bg-white";

  if (collapsed && isApproved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-2 rounded-xl border border-slate-200 ${bg} border-l-4 ${borderColor} px-3 py-2 text-xs font-medium text-slate-700`}
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span className="font-mono">{formatCollapsed(entry)}</span>
        <button
          onClick={() => setCollapsed(false)}
          className="ml-auto text-[11px] font-semibold text-emerald-700 hover:underline"
        >
          Expand
        </button>
      </motion.div>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-xl border bg-white shadow-sm border-l-4 ${borderColor} ${isNeedsApproval && pending ? "ring-1 ring-amber-200" : "border-slate-200"}`}
    >
      {/* pulsing amber border when pending */}
      {isNeedsApproval && pending && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{ boxShadow: ["0 0 0 0 rgba(245,158,11,0)", "0 0 0 8px rgba(245,158,11,0.12)", "0 0 0 0 rgba(245,158,11,0)"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      <div className={`p-3 ${bg}`}>
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isBlocked ? "bg-red-500 text-white" : isNeedsApproval ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"}`}>
            {isBlocked ? <ShieldAlert className="h-4 w-4" /> : isNeedsApproval ? <Shield className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-700 ring-1 ring-slate-200">
            GUARDIAN GATE
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isBlocked ? "bg-red-500 text-white" : isNeedsApproval ? "bg-amber-500 text-white animate-pulse" : "bg-emerald-600 text-white"}`}>
            {entry.status ?? "CHECK"}
          </span>
          <span className="ml-auto font-mono text-xs text-slate-400">{timeOf(entry.at)}</span>
        </div>

        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">{entry.text.split("—")[0]?.trim()}</p>

        <div className="mt-2 space-y-1.5 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
          <p className="text-xs leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">Reason:</span> {meta.reason}
          </p>
          {meta.rule && (
            <p className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
              <Zap className="h-3 w-3 text-amber-500" /> Rule: <span className="font-semibold text-slate-700">{meta.rule}</span>
            </p>
          )}
          {isBlocked && (
            <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              This action was blocked by governance — no money moved.
            </p>
          )}
        </div>
      </div>

      {/* Ribbon for pending */}
      {isNeedsApproval && pending && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-1.5 bg-amber-500 px-3 py-1.5 text-xs font-bold tracking-wide text-white"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          ⏸ Flow paused — waiting for human approval
        </motion.div>
      )}

      {/* collapsed hint for approved */}
      {isApproved && !pending && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          <span>Auto-collapses in 3s to keep feed clean</span>
          <button onClick={() => setCollapsed(true)} className="font-semibold text-slate-600 hover:text-slate-800">Collapse now</button>
        </div>
      )}
    </motion.article>
  );
}

// Recovery step types
export interface RecoveryStep {
  id: string;
  agent: FeedEntry["agent"];
  text: string;
  status?: string;
  kind: "processing" | "failure" | "thought" | "tool" | "retry_fail" | "fallback";
  detail?: string;
}

function RecoverySequence({ steps }: { steps: RecoveryStep[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
        <Info className="h-3.5 w-3.5" />
        RECOVERY PLAYBOOK
        <span className="font-normal text-violet-600">— deterministic, not improvisation</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 ring-violet-200">7 steps</span>
      </div>
      <AnimatePresence>
        {steps.map((s, idx) => {
          const isFailure = s.kind === "failure" || s.kind === "retry_fail";
          const isTool = s.kind === "tool";
          const isThought = s.kind === "thought";
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -12, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: idx * 0.02 }}
              className={`rounded-xl border p-3 shadow-sm ${
                isFailure ? "border-red-200 bg-red-50" : isTool ? "border-slate-900 bg-slate-900 text-white" : isThought ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"
              } ${isFailure ? "animate-[shake_0.35s_ease]" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold ${isFailure ? "bg-red-500 text-white" : s.agent === "CHECKOUT" ? "bg-[#204CF5] text-white" : "bg-slate-700 text-white"}`}>
                  {s.agent === "CHECKOUT" ? "CK" : "SY"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isTool ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-white px-2 py-0.5 ring-1 ring-slate-200 text-slate-700"}`}>
                  {s.agent} {isTool ? "· tool call" : ""}
                </span>
                {s.status && <span className={`text-xs font-bold ${isFailure ? "text-red-600" : "text-emerald-600"}`}>{s.status}</span>}
              </div>
              <p className={`mt-2 text-sm leading-relaxed ${isTool ? "font-mono text-violet-200" : isThought ? "italic text-violet-800" : isFailure ? "font-semibold text-red-800" : "text-slate-800"}`}>
                {s.text}
              </p>
              {s.detail && <p className="mt-1 font-mono text-xs text-slate-500">{s.detail}</p>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Center panel: animated agent/customer flow. */
export function ActivityFeed({
  feed,
  phase,
  pendingApproval,
  recoverySteps,
  recoveryActive,
}: {
  feed: FeedEntry[];
  phase: string;
  pendingApproval?: boolean;
  recoverySteps?: RecoveryStep[];
  recoveryActive?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [feed.length, recoverySteps?.length]);

  // Identify latest gate needing approval to highlight
  const latestNeedsApprovalId = (() => {
    if (!pendingApproval) return null;
    for (let i = feed.length - 1; i >= 0; i--) {
      const e = feed[i];
      if (e.agent === "GUARDIAN" && e.status === "NEEDS_APPROVAL") return e.id;
    }
    return null;
  })();

  return (
    <section className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold tracking-wide text-slate-700">Live agent activity</span>
          {pendingApproval && (
            <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">PAUSED</span>
          )}
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          Phase · <span className={pendingApproval ? "text-amber-600" : "text-[#204CF5]"}>{pendingApproval ? "AWAITING_APPROVAL" : phase}</span>
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-white p-4 scrollbar-thin">
        {feed.length === 0 && !recoveryActive && (
          <div className="grid place-items-center py-16 text-center">
            <p className="text-sm font-medium text-slate-700">Waiting for activity</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Talk to the shop on the left — the agents will respond in real time.
            </p>
          </div>
        )}

        {/* Recovery playbook takes precedence when active */}
        {recoveryActive && recoverySteps && recoverySteps.length > 0 && (
          <RecoverySequence steps={recoverySteps} />
        )}

        <AnimatePresence initial={false}>
          {feed.map((entry) => {
            // Gate events get HERO treatment
            if (isGuardianGate(entry)) {
              const isPendingLeader = entry.id === latestNeedsApprovalId;
              return (
                <GuardianGateCard key={entry.id} entry={entry} pending={!!isPendingLeader} />
              );
            }

            const style = AGENT_STYLES[entry.agent] ?? AGENT_STYLES.SYSTEM;
            const chip = entry.status ? statusChip(entry.status) : null;
            const isCheckoutFailure = entry.agent === "CHECKOUT" && (entry.status === "FAILED" || entry.text.toLowerCase().includes("declined"));
            return (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`rounded-xl border bg-white p-3 shadow-sm ${isCheckoutFailure ? "border-red-200 bg-red-50" : "border-slate-200"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${style.avatar}`}
                  >
                    {style.initials}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${style.badge}`}>
                    {style.label}
                  </span>
                  {chip && (
                    <span className={`rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold ring-1 ring-slate-200 ${chip.cls}`}>
                      {entry.status}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-slate-400">
                    {timeOf(entry.at)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words pl-9 text-sm leading-relaxed text-slate-700">
                  {entry.text}
                </p>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
