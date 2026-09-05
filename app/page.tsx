import Link from "next/link";
import { ArrowRight, Shield, Eye, Terminal as TerminalIcon, BarChart3, Activity } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "CommerceAgent — Autonomous Commerce for Razorpay" };

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#050507] text-zinc-200">
      {/* ── Ambient grid ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_50%)]" />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          RAZORPAY · TEST MODE · MULTI-AGENT
        </div>

        <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent md:text-6xl">
          AI agents that
          <br />
          <span className="text-emerald-400">buy &amp; sell</span> on Razorpay
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          Growth, Checkout, and Guardian agents transact autonomously — with full
          audit trails, spend caps, and human-in-the-loop approvals.
          <span className="text-zinc-200"> Every money action is bounded, gated, and explainable.</span>
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/terminal"
            className="group inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-8 py-3.5 text-sm font-bold tracking-wide text-zinc-950 shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 hover:shadow-emerald-400/30"
          >
            LAUNCH DEMO
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            <BarChart3 className="h-4 w-4" />
            View Analytics
          </Link>
        </div>

        {/* ── Feature strip ─────────────────────────────────── */}
        <div className="mt-20 grid w-full grid-cols-2 gap-4 text-left md:grid-cols-4">
          {[
            { icon: Activity, label: "Live Agent Feed", desc: "Watch Growth · Checkout · Guardian negotiate in real time" },
            { icon: Shield, label: "Hard Guardrails", desc: "₹2K session cap, allowlists, human approvals" },
            { icon: Eye, label: "Full Audit Trail", desc: "Every decision logged with reasoning" },
            { icon: TerminalIcon, label: "AI Buyer", desc: "Natural-language autonomous checkout" },
          ].map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 backdrop-blur"
            >
              <f.icon className="mb-2 h-5 w-5 text-emerald-400" />
              <p className="text-sm font-semibold text-zinc-100">{f.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── One-line pitch ────────────────────────────────── */}
        <p className="mt-16 max-w-xl text-xs tracking-wide text-zinc-600">
          &ldquo;CommerceAgent is the bar for autonomous commerce: explainable ✅ bounded ✅ gated ✅
          auditable ✅ graceful-failure ✅&rdquo;
        </p>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 flex items-center justify-between border-t border-zinc-900 px-8 py-4 text-xs text-zinc-600">
        <span>COMMERCEAGENT · v0.1.0</span>
        <span>Razorpay Test Mode · No real money moves</span>
      </footer>
    </div>
  );
}
