"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ReceiptText,
  BarChart3,
  Settings,
  Terminal,
  ShieldCheck,
  ChevronDown,
  Search,
  Sparkles,
  ExternalLink,
} from "lucide-react";

import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/terminal", label: "Live Terminal", icon: Terminal, badge: "Live" },
  { href: "/agents", label: "Agents", icon: Bot },
];

const opsNav = [
  { href: "/audit", label: "Audit trail", icon: ReceiptText },
  { href: "/analytics", label: "Revenue", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-3 top-3 bottom-3 z-30 flex w-[268px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12),0_4px_16px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)]">
      {/* Org switcher */}
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F172A] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">CommerceAgent</p>
            <p className="text-xs text-slate-500">Razorpay workspace</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search agents, orders…"
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-[#204CF5]/30 focus:outline-none focus:ring-2 focus:ring-[#204CF5]/15"
          />
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 md:block">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className="px-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-400">COMMAND</p>
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-[#204CF5] text-white shadow-sm shadow-[#204CF5]/20"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
                <span className="flex-1">{item.label}</span>
                {(item as { badge?: string }).badge && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                      isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <p className="px-2 pb-2 pt-6 text-[11px] font-semibold tracking-widest text-slate-400">OPERATIONS</p>
        <div className="space-y-1">
          {opsNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              pathname === "/settings"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Settings className={cn("h-4 w-4", pathname === "/settings" ? "text-white" : "text-slate-400")} />
            Settings
          </Link>
        </div>

        {/* Guardrails card */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-900">Guardrails active</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80">
            ₹2K session cap · 3 orders · human approvals for high-value moves.
          </p>
          <Link href="/settings" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800">
            View policy <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200">
            AK
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">A. Kumar</p>
            <p className="truncate text-[11px] text-slate-500">ops@razorpay.test</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
        </div>
        <p className="mt-2 px-1 text-center text-[10px] text-slate-400">v0.1.0 · Razorpay test mode</p>
      </div>
    </aside>
  );
}
