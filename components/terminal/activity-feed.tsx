"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Zap, Info, ChevronDown } from "lucide-react";

import { AGENT_STYLES, statusChip, type FeedEntry, isGuardianGate, parseGateMeta, extractAmount } from "./types";

function timeOf(at: string): string {
  const d = new Date(at);
  return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatCollapsed(entry: FeedEntry): string {
  const amt = extractAmount(entry);
  const amtStr = amt != null ? `₹${(amt / 100).toLocaleString("en-IN")}` : "order";
  return `🛡️ ${amtStr} — ${entry.status ?? "APPROVED"}`;
}

function GuardianGateCard({ entry, pending }: { entry: FeedEntry; pending: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const meta = parseGateMeta(entry);
  const isApproved = entry.status === "APPROVED" || entry.status === "SUCCESS";
  const isBlocked = entry.status === "BLOCKED" || entry.status === "FAILED";
  const isNeedsApproval = entry.status === "NEEDS_APPROVAL";

  useEffect(() => {
    if (isApproved && !pending) {
      const t = setTimeout(() => setCollapsed(true), 2000);
      return () => clearTimeout(t);
    }
  }, [isApproved, pending]);

  const left = isBlocked ? "border-l-red-500" : isNeedsApproval ? "border-l-amber-500" : "border-l-emerald-500";

  if (collapsed && isApproved) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] text-slate-600 ring-1 ring-slate-200 border-l-4 ${left}`}
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span className="font-mono text-xs">{formatCollapsed(entry)}</span>
        <button onClick={() => setCollapsed(false)} className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700">
          Expand
        </button>
      </motion.div>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 border-l-4 ${left}`}
    >
      {isNeedsApproval && pending && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{ boxShadow: ["0 0 0 0 rgba(245,158,11,0)", "0 0 0 8px rgba(245,158,11,0.08)", "0 0 0 0 rgba(245,158,11,0)"] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
            {isBlocked ? <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> : isNeedsApproval ? <Shield className="h-3.5 w-3.5 text-amber-500" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
          </span>
          <span className="text-xs font-semibold text-slate-700">Guardian</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isBlocked ? "bg-red-50 text-red-700 ring-1 ring-red-200" : isNeedsApproval ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
            {entry.status ?? "CHECK"}
          </span>
          <span className="ml-auto font-mono text-xs text-slate-400">{timeOf(entry.at)}</span>
        </div>
        <p className="mt-2 text-[13px] font-medium text-slate-900">{entry.text.split("—")[0]?.trim()}</p>
        <p className="mt-1 text-xs italic leading-relaxed text-slate-500">{meta.reason}</p>
        {meta.rule && <p className="mt-1.5 flex items-center gap-1 font-mono text-xs text-slate-400"><Zap className="h-3 w-3" />{meta.rule}</p>}
        <button onClick={() => setShowRaw((v) => !v)} className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
          <ChevronDown className={`h-3 w-3 transition ${showRaw ? "rotate-180" : ""}`} /> {showRaw ? "Hide raw" : "Raw"}
        </button>
        {showRaw && <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-600">{JSON.stringify(entry, null, 2)}</pre>}
      </div>
      {isNeedsApproval && pending && (
        <div className="flex items-center justify-center gap-1.5 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Flow paused — waiting for approval
        </div>
      )}
    </motion.article>
  );
}

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
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
        <Info className="h-3.5 w-3.5 text-slate-500" /> Recovery playbook <span className="font-normal text-slate-400">— deterministic</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 ring-slate-200">7 steps</span>
      </div>
      <AnimatePresence>
        {steps.map((s, idx) => {
          const isFailure = s.kind === "failure" || s.kind === "retry_fail";
          const isTool = s.kind === "tool";
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.02 }}
              className={`rounded-xl bg-white p-3 ring-1 ${isFailure ? "ring-red-200" : isTool ? "ring-slate-900" : "ring-slate-200"}`}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{s.agent}</span>
                {s.status && <span className={`text-xs font-bold ${isFailure ? "text-red-600" : "text-emerald-600"}`}>{s.status}</span>}
              </div>
              <p className={`mt-1.5 text-[13px] leading-relaxed ${isTool ? "font-mono text-slate-700" : s.kind === "thought" ? "italic text-slate-500" : "text-slate-800"}`}>{s.text}</p>
              {s.detail && <p className="mt-1 font-mono text-xs text-slate-400">{s.detail}</p>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

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

  // Only agent-internal events
  const agentFeed = feed.filter((f) => ["GROWTH", "CHECKOUT", "GUARDIAN"].includes(f.agent));

  // Find last customer message for dim reference
  const lastCustomer = [...feed].reverse().find((f) => f.agent === "CUSTOMER");

  const latestNeedsApprovalId = (() => {
    if (!pendingApproval) return null;
    for (let i = agentFeed.length - 1; i >= 0; i--) {
      const e = agentFeed[i];
      if (e.agent === "GUARDIAN" && e.status === "NEEDS_APPROVAL") return e.id;
    }
    return null;
  })();

  return (
    <section className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Live agent activity</h2>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          {pendingApproval ? "AWAITING_APPROVAL" : phase}
        </span>
      </header>

      {lastCustomer && (
        <div className="mx-4 mb-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-200">
          ↳ responding to: <span className="italic">“{lastCustomer.text.slice(0, 80)}”</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 pb-4 scrollbar-thin">
        {agentFeed.length === 0 && !recoveryActive && (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No agent activity yet</p>
            <p className="mt-1 text-xs text-slate-400">Pick a product on the left to start</p>
          </div>
        )}

        {recoveryActive && recoverySteps && recoverySteps.length > 0 && <RecoverySequence steps={recoverySteps} />}

        <AnimatePresence initial={false}>
          {agentFeed.map((entry) => {
            if (isGuardianGate(entry)) {
              const isPendingLeader = entry.id === latestNeedsApprovalId;
              return <GuardianGateCard key={entry.id} entry={entry} pending={!!isPendingLeader} />;
            }
            const style = AGENT_STYLES[entry.agent] ?? AGENT_STYLES.SYSTEM;
            const chip = entry.status ? statusChip(entry.status) : null;
            return (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{style.label}</span>
                  {chip && <span className={`text-xs font-bold ${chip.cls}`}>• {entry.status}</span>}
                  <span className="ml-auto font-mono text-xs text-slate-400">{timeOf(entry.at)}</span>
                </div>
                <p className="mt-2 text-[13px] font-medium text-slate-900">{entry.text.split("—")[0]?.trim()}</p>
                <p className="mt-1 text-xs italic leading-relaxed text-slate-500">{entry.text.split("—").slice(1).join("—").trim() || "…"}</p>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
