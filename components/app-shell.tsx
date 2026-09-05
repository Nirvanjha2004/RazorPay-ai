"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar:collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // 292 when expanded (12 + 268 + 12), 92 when collapsed (12 + 68 + 12)
  const pl = collapsed ? "pl-[92px]" : "pl-[292px]";

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className={`${pl} pr-3 pt-3 transition-all duration-300 ease-in-out`}>
        {/* Floating navbar */}
        <div className="sticky top-3 z-20 flex h-[56px] items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-6 shadow-[0_4px_16px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-1.5 text-slate-400 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Test mode
            </span>
            <span className="hidden h-4 w-px bg-slate-200 md:block" />
            <span className="text-slate-500">
              Operations / <span className="font-medium text-slate-900">Overview</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 md:inline-flex">
              No real money moves
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              AK
            </div>
          </div>
        </div>
        <main className="mt-3 min-h-[calc(100vh-92px)] pb-3">{children}</main>
      </div>
    </>
  );
}
