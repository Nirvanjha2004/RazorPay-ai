"use client";

import { motion } from "framer-motion";

import type { GuardianStatus } from "./types";
import { formatINR } from "@/lib/utils";

interface Props {
  guardian: GuardianStatus;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}

/** Guardian status: spend cap progress, order budget, pending approvals. */
export function GuardianCard({ guardian, onApprove, onReject, busy }: Props) {
  const pct =
    guardian.maxSpendPaise > 0
      ? Math.min(100, Math.round((guardian.spendPaise / guardian.maxSpendPaise) * 100))
      : 0;
  const orderPips = Array.from({ length: guardian.maxOrders }, (_, i) => i < guardian.orderCount);

  return (
    <section className="px-4 py-4">
      <header className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-widest text-slate-700">Guardian</p>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          Governor
        </span>
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
            <span
              key={i}
              className={`h-2.5 w-5 rounded-full ${used ? "bg-[#204CF5]" : "bg-slate-200"}`}
            />
          ))}
          <span className="ml-1 font-mono text-xs font-semibold text-slate-700">
            {guardian.orderCount}/{guardian.maxOrders}
          </span>
        </span>
      </div>

      {/* Pending approvals */}
      <div className="mt-3">
        {guardian.pendingApproval ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold tracking-wide text-amber-800">
              Requires approval
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {formatINR(guardian.pendingApproval.amountInPaise)} — {guardian.pendingApproval.reason}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onApprove}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
            No pending approvals — flow unblocked.
          </p>
        )}
      </div>
    </section>
  );
}
