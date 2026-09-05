import Link from "next/link";
import { ArrowRight, Shield, Eye, Terminal as TerminalIcon, BarChart3, Activity, Check, Sparkles, Lock, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "CommerceAgent — Autonomous Commerce for Razorpay" };

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F9F8F6]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-grid opacity-[0.6]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
        {/* soft orb */}
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-[520px] w-[520px] rounded-full bg-[#204CF5]/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -top-16 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-500/[0.06] blur-3xl" />

        <div className="relative mx-auto max-w-[1160px] px-6 pb-10 pt-10 md:pb-14 md:pt-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <span className="flex h-2 w-2">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="ml-[-8px] h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Razorpay · Test mode · Multi-agent orchestration
            <span className="hidden h-3 w-px bg-slate-200 md:block" />
            <span className="hidden items-center gap-1 text-slate-500 md:inline-flex">
              <Lock className="h-3 w-3" /> Guardrails enforced
            </span>
          </div>

          <div className="mt-7 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <h1 className="text-balance text-[40px] font-[800] leading-[0.95] tracking-[-0.04em] text-slate-900 md:text-[52px]">
                AI agents that
                <br />
                <span className="bg-gradient-to-r from-[#204CF5] to-[#5B5BF6] bg-clip-text text-transparent">buy and sell</span>
                <br />
                on Razorpay.
              </h1>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-slate-600 md:text-base">
                Growth, Checkout and Guardian agents transact autonomously — with full audit trails, spend caps,
                and human-in-the-loop approvals. Every money action is bounded, explainable and reversible.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/terminal"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#204CF5] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-[#204CF5]/20 transition hover:bg-[#1a3fd6] hover:shadow-md"
                >
                  Launch live terminal
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                >
                  <BarChart3 className="h-4 w-4" />
                  View revenue lift
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> No real money moves
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> All runs audited
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> SOC-2 ready trail
                </span>
              </div>
            </div>

            {/* Preview card — ledger */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-saas">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold tracking-wide text-slate-700">LIVE RUN · #TRM-4821</span>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    ₹1,840 / ₹2,000 cap
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  {[
                    { agent: "GROWTH", text: "Picked upsell: Maintenance kit (₹1,200) within 40% price cap", status: "SUCCESS", color: "bg-violet-600" },
                    { agent: "CHECKOUT", text: "Created Razorpay order order_N3x… — payment link issued", status: "SUCCESS", color: "bg-[#204CF5]" },
                    { agent: "GUARDIAN", text: "Held for human approval — amount exceeds single-action threshold", status: "NEEDS APPROVAL", color: "bg-amber-500" },
                  ].map((r) => (
                    <div key={r.agent} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <span className={`mt-0.5 h-7 w-7 shrink-0 rounded-lg ${r.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                        {r.agent[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900">{r.agent}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{r.text}</p>
                      </div>
                      <span
                        className={`h-fit shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                          r.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3">
                  <span className="text-xs text-slate-500">Audited · Replayable · Bounded</span>
                  <Link href="/audit" className="text-xs font-semibold text-[#204CF5] hover:text-[#1a3fd6]">
                    Open audit trail →
                  </Link>
                </div>
              </div>

              {/* floating metric */}
              <div className="absolute -bottom-4 -left-4 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-saas md:flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">+18% revenue lift</p>
                  <p className="text-[11px] text-slate-500">Agent vs baseline · 14 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-slate-200 bg-[#F9F8F6]">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-6 py-4 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Built for Razorpay operations</span>
          <div className="flex flex-wrap items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-slate-400" /> Per-action + daily caps
            </span>
            <span className="inline-flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-slate-400" /> Full decision reasoning
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-slate-400" /> Human approvals
            </span>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-slate-400" /> Replay every run
            </span>
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section className="mx-auto max-w-[1160px] px-6 py-10">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-7">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#204CF5] text-white">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">Live agent feed</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Watch Growth, Checkout and Guardian negotiate in real time. Every decision streams with reasoning, status and phase — no black boxes.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { k: "Avg decision", v: "1.2s" },
                { k: "Runs today", v: "147" },
                { k: "Approval SLA", v: "< 30s" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{s.v}</p>
                  <p className="text-[11px] text-slate-500">{s.k}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white md:col-span-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Hard guardrails</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              Spend caps, allowlists, and human gates are enforced in code — not prompts. A blocked action never reaches Razorpay.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {["₹2,000 session cap", "3 orders per session", "Refund allowlist + pay_test_* only"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-slate-200">
                  <Check className="h-4 w-4 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Eye className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">Full audit trail</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Every agent run — success, failure or blocked — is logged with inputs, outputs, and reasoning. Export via API or replay in the terminal.
            </p>
            <Link href="/audit" className="mt-4 inline-flex text-sm font-semibold text-[#204CF5] hover:text-[#1a3fd6]">
              View last 100 entries →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-7">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <TerminalIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">AI Buyer — natural language checkout</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              &ldquo;Buy me the best coffee maker under ₹20,000 with a maintenance kit&rdquo; — the buyer reads the catalog, picks within guardrails, and waits for approval if needed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Catalog-aware", "Guardian-gated", "Replayable"].map((t) => (
                <span key={t} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            &ldquo;CommerceAgent is the bar for autonomous commerce: <span className="font-semibold text-slate-900">explainable</span> ·{" "}
            <span className="font-semibold text-slate-900">bounded</span> ·{" "}
            <span className="font-semibold text-slate-900">gated</span> ·{" "}
            <span className="font-semibold text-slate-900">auditable</span> ·{" "}
            <span className="font-semibold text-slate-900">graceful failure</span>.&rdquo;
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between px-6 py-4 text-xs text-slate-500">
          <span className="font-mono">CommerceAgent · v0.1.0</span>
          <span>Razorpay test mode · No real money moves</span>
        </div>
      </footer>
    </div>
  );
}
