"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Shield } from "lucide-react";

import type { GuardianStatus } from "./types";
import { formatINR } from "@/lib/utils";

interface Props {
  guardian: GuardianStatus;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
  approvalRef?: React.RefObject<HTMLDivElement>;
  transitionState?: "idle" | "approving" | "rejecting";
}

/** Guardian status: spend cap progress, order budget, pending approvals. */
export function GuardianCard({ guardian, onApprove, onReject, busy, approvalRef, transitionState = "idle" }: Props) {
  const pct =
    guardian.maxSpendPaise > 0
      ? Math.min(100, Math.round((guardian.spendPaise / guardian.maxSpendPaise) * 100))
      : 0;
  const orderPips = Array.from({ length: guardian.maxOrders }, (_, i) => i < guardian.orderCount);
  const isAwaiting = !!guardian.pendingApproval;

  return (
    <section className="px-4 py-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={isAwaiting ? { scale: [1, 1.06, 1] } : {}}
            transition={isAwaiting ? { duration: 1.2, repeat: Infinity } : {}}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${isAwaiting ? "bg-amber-500 text-white" : "bg-slate-900 text-white"}`}
          >
            <Shield className="h-4 w-4" />
          </motion.div>
          <p className="text-xs font-semibold tracking-widest text-slate-700">Guardian</p>
          {isAwaiting && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              AWAITING HUMAN
            </motion.span>
          )}
        </div>
        <AnimatePresence mode="wait">
          {isAwaiting ? (
            <motion.span
              key="awaiting"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Paused
            </motion.span>
          ) : (
            <motion.span
              key="governor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
            >
              Governor
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      {/* Session spend vs cap */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-500">Session spend</span>
          <span className="font-mono text-sm font-semibold text-slate-900">
            {formatINR(guardian.spendPaise)}{" "}
            <span className="font-normal text-slate-500">/ {formatINR(guardian.maxSpendPaise)}</span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500">{pct}% of cap used</span>
          <span className={`font-medium ${pct > 80 ? "text-red-600" : pct > 50 ? "text-amber-600" : "text-emerald-700"}`}>
            {pct > 80 ? "At risk" : pct > 50 ? "Watch" : "Healthy"}
          </span>
        </div>
      </div>

      {/* Order budget */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
        <span className="text-xs font-medium text-slate-500">Orders used</span>
        <span className="flex items-center gap-1.5">
          {orderPips.map((used, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`h-2.5 w-5 rounded-full ${used ? "bg-[#204CF5]" : "bg-slate-200"}`}
            />
          ))}
          <span className="ml-1 font-mono text-xs font-semibold text-slate-700">
            {guardian.orderCount}/{guardian.maxOrders}
          </span>
        </span>
      </div>

      {/* Pending approvals — HERO moment */}
      <div className="mt-3" ref={approvalRef}>
        <AnimatePresence mode="wait">
          {guardian.pendingApproval ? (
            <motion.div
              key={guardian.pendingApproval.amountInPaise + guardian.pendingApproval.reason}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                borderColor: transitionState === "approving" ? "rgb(16 185 129)" : transitionState === "rejecting" ? "rgb(239 68 68)" : "rgb(251 191 36)",
                backgroundColor: transitionState === "approving" ? "rgb(236 253 245)" : transitionState === "rejecting" ? "rgb(254 242 242)" : "rgb(255 251 235)",
              }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="rounded-2xl border-2 bg-amber-50 p-4 shadow-sm"
            >
              {/* Pulse border effect when awaiting */}
              {transitionState === "idle" && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  animate={{ boxShadow: ["0 0 0 0 rgba(245,158,11,0)", "0 0 0 6px rgba(245,158,11,0.12)", "0 0 0 0 rgba(245,158,11,0)"] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ borderRadius: 16 }}
                />
              )}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <motion.span
                    animate={transitionState === "idle" ? { rotate: [0, 6, -6, 0] } : {}}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${transitionState === "approving" ? "bg-emerald-500 text-white" : transitionState === "rejecting" ? "bg-red-500 text-white" : "bg-amber-500 text-white"}`}
                  >
                    {transitionState === "approving" ? <CheckCircle2 className="h-4 w-4" /> : transitionState === "rejecting" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </motion.span>
                  <p className={`text-xs font-bold tracking-wide ${transitionState === "approving" ? "text-emerald-700" : transitionState === "rejecting" ? "text-red-700" : "text-amber-800"}`}>
                    {transitionState === "approving" ? "APPROVED — RESUMING" : transitionState === "rejecting" ? "REJECTED" : "REQUIRES HUMAN APPROVAL"}
                  </p>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {guardian.pendingApproval.action}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Amount</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{formatINR(guardian.pendingApproval.amountInPaise)}</span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Reason</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">{guardian.pendingApproval.reason}</p>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                    Rule: <span className="font-mono font-semibold text-slate-700">human_approval_required</span> · Threshold ₹1,000
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onApprove}
                    disabled={busy || transitionState !== "idle"}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    ✓ Approve
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onReject}
                    disabled={busy || transitionState !== "idle"}
                    className="rounded-xl border-2 border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    ✕ Reject
                  </motion.button>
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-500">Your decision is audited and final</p>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500"
            >
              No pending approvals — flow unblocked.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
