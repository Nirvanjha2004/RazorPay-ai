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

export function GuardianCard({ guardian, onApprove, onReject, busy, approvalRef, transitionState = "idle" }: Props) {
  const pct =
    guardian.maxSpendPaise > 0
      ? Math.min(100, Math.round((guardian.spendPaise / guardian.maxSpendPaise) * 100))
      : 0;
  const orderPips = Array.from({ length: guardian.maxOrders }, (_, i) => i < guardian.orderCount);
  const isAwaiting = !!guardian.pendingApproval;

  return (
    <section className="p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">Guardian</h3>
          {isAwaiting && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">Awaiting</span>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${isAwaiting ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
          {isAwaiting ? "Paused" : "Active"}
        </span>
      </header>

      {/* Spend */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Session spend</span>
          <span className="font-mono text-sm font-semibold text-slate-900">
            {formatINR(guardian.spendPaise)} <span className="font-normal text-slate-400">/ {formatINR(guardian.maxSpendPaise)}</span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-slate-900"}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-slate-400">{pct}% of cap used</p>
      </div>

      {/* Orders */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
        <span className="text-xs font-medium text-slate-600">Orders</span>
        <span className="flex items-center gap-1.5">
          {orderPips.map((used, i) => (
            <span key={i} className={`h-2 w-5 rounded-full ${used ? "bg-slate-900" : "bg-white ring-1 ring-slate-200"}`} />
          ))}
          <span className="ml-1 font-mono text-xs font-semibold text-slate-700">
            {guardian.orderCount}/{guardian.maxOrders}
          </span>
        </span>
      </div>

      {/* Pending — only if any (clean) */}
      <div className="mt-4" ref={approvalRef}>
        <AnimatePresence mode="wait">
          {guardian.pendingApproval ? (
            <motion.div
              key={guardian.pendingApproval.amountInPaise + guardian.pendingApproval.reason}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${transitionState === "approving" ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : transitionState === "rejecting" ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-amber-50 text-amber-600 ring-1 ring-amber-200"}`}>
                  {transitionState === "approving" ? <CheckCircle2 className="h-3.5 w-3.5" /> : transitionState === "rejecting" ? <XCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                </span>
                <p className="text-xs font-bold text-slate-800">
                  {transitionState === "approving" ? "Approved — resuming" : transitionState === "rejecting" ? "Rejected" : "Needs approval"}
                </p>
                <span className="ml-auto rounded-full bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500 ring-1 ring-slate-200">{guardian.pendingApproval.action}</span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Amount</span>
                  <span className="font-mono text-sm font-bold text-slate-900">{formatINR(guardian.pendingApproval.amountInPaise)}</span>
                </div>
                <p className="rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">{guardian.pendingApproval.reason}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <ShieldCheck className="h-3 w-3" /> human_approval_required · ₹1,000 threshold
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={onApprove}
                  disabled={busy || transitionState !== "idle"}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={onReject}
                  disabled={busy || transitionState !== "idle"}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500 ring-1 ring-slate-200"
            >
              No approvals needed — flow clear
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
