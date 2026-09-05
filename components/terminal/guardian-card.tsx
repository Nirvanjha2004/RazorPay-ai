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
    <section className="border-b border-zinc-800 px-4 py-3">
      <header className="mb-3 flex items-center justify-between">
        <div className="text-xs tracking-widest text-zinc-400">GUARDIAN STATUS</div>
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
          GOVERNOR
        </span>
      </header>

      {/* Session spend vs cap */}
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-zinc-500">SESSION SPEND</span>
        <span className="font-mono text-zinc-300">
          {formatINR(guardian.spendPaise)}{" "}
          <span className="text-zinc-600">/ {formatINR(guardian.maxSpendPaise)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
        <motion.div
          className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-zinc-600">{pct}% of cap used</div>

      {/* Order budget */}
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">ORDERS USED</span>
        <span className="flex items-center gap-1.5">
          {orderPips.map((used, i) => (
            <span
              key={i}
              className={`h-2.5 w-4 rounded-sm ${used ? "bg-sky-500" : "bg-zinc-800 border border-zinc-700"}`}
            />
          ))}
          <span className="ml-1 font-mono text-zinc-400">
            {guardian.orderCount}/{guardian.maxOrders}
          </span>
        </span>
      </div>

      {/* Pending approvals */}
      <div className="mt-3">
        {guardian.pendingApproval ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
            <p className="text-[10px] font-bold tracking-widest text-amber-400">
              🔒 REQUIRES_HUMAN_APPROVAL
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
              {formatINR(guardian.pendingApproval.amountInPaise)} — {guardian.pendingApproval.reason}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={onApprove}
                disabled={busy}
                className="flex-1 rounded border border-emerald-500/50 bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                APPROVE
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="flex-1 rounded border border-red-500/50 bg-red-500/15 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
              >
                REJECT
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-zinc-800 bg-zinc-950 p-2 text-[10px] text-zinc-600">
            No pending approvals — flow unblocked.
          </p>
        )}
      </div>
    </section>
  );
}
