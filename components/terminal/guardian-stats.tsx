"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield, Ban, ArrowUpRight, PiggyBank } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  gatesPassed: number;
  blocked: number;
  escalated: number;
  moneySavedPaise: number;
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const diff = value - display;
    if (diff === 0) return;
    const start = performance.now();
    const dur = 600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(display + diff * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className="tabular-nums">{display}</span>;
}

function fmtINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function GuardianStatsStrip({ gatesPassed, blocked, escalated, moneySavedPaise }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Shield className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-slate-600">Gates passed</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
          <CountUp value={gatesPassed} />
        </span>
      </div>
      <span className="hidden h-4 w-px bg-slate-200 sm:block" />
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <Ban className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-slate-600">Blocked</span>
        <span className="rounded-full bg-red-50 px-2 py-0.5 font-mono text-xs font-bold text-red-700 ring-1 ring-red-200">
          <CountUp value={blocked} />
        </span>
      </div>
      <span className="hidden h-4 w-px bg-slate-200 sm:block" />
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-slate-600">Escalated</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-800 ring-1 ring-amber-200">
          <CountUp value={escalated} />
        </span>
      </div>
      <span className="hidden h-4 w-px bg-slate-200 sm:block" />
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <PiggyBank className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-slate-600">Saved by blocks</span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={moneySavedPaise}
            initial={{ scale: 0.9, backgroundColor: "rgb(237 233 254)" }}
            animate={{ scale: 1, backgroundColor: "rgb(255 255 255)" }}
            transition={{ duration: 0.4 }}
            className="rounded-full bg-white px-2 py-0.5 font-mono text-xs font-bold text-violet-700 ring-1 ring-violet-200"
          >
            {fmtINR(moneySavedPaise)}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="ml-auto hidden items-center gap-1 text-[10px] font-medium text-slate-400 md:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live governance
      </span>
    </div>
  );
}
