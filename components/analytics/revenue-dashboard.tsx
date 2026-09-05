"use client";

import { useCallback, useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatINR } from "@/lib/utils";

interface RevenueData {
  seeded: boolean;
  baseline: { orders: number; revenuePaise: number; avgOrderPaise: number };
  agent: { orders: number; revenuePaise: number; avgOrderPaise: number; upsells: number };
  liftPct: number;
  conversionPct: number;
  revenueOverTime: { label: string; baselinePaise: number; agentPaise: number }[];
  conversionOverTime: { label: string; pct: number; accepted: number; total: number }[];
  topProducts: { productId: string; name: string; units: number; revenuePaise: number }[];
}

type CatalogHealth = {
  status: "checking" | "live" | "invalid";
  ms?: number;
  version?: string;
  productCount?: number;
  issues?: string[];
  raw?: string;
};

const chartTooltip = {
  contentStyle: { background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,0.06)" },
  labelStyle: { color: "#64748B", fontWeight: 600 },
  itemStyle: { color: "#0F172A" },
};

export function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<CatalogHealth>({ status: "checking" });
  const [modalOpen, setModalOpen] = useState(false);
  const [displayLift, setDisplayLift] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/revenue", { cache: "no-store" });
      setData((await res.json()) as RevenueData);
    } catch {
      // keep previous data on network hiccups
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkCatalog = useCallback(async () => {
    setHealth({ status: "checking" });
    const start = performance.now();
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      const ms = Math.round(performance.now() - start);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        catalog_version?: string;
        product_count?: number;
        products?: { id?: string; name?: string; price_in_paise?: unknown; availability?: string; upsell_candidates?: unknown }[];
      };
      const issues: string[] = [];
      if (!json.catalog_version) issues.push("missing catalog_version");
      if (!Array.isArray(json.products) || json.products.length === 0) {
        issues.push("products array empty or missing");
      } else {
        const validAvailability = ["in_stock", "low_stock", "out_of_stock"];
        for (const p of json.products) {
          if (!p.id || !p.name) issues.push("product missing id/name");
          if (typeof p.price_in_paise !== "number") issues.push(`${p.id ?? "?"}: price not a number`);
          if (!validAvailability.includes(p.availability ?? "")) issues.push(`${p.id ?? "?"}: invalid availability`);
          if (!Array.isArray(p.upsell_candidates)) issues.push(`${p.id ?? "?"}: upsell_candidates missing`);
        }
      }
      setHealth({
        status: issues.length > 0 ? "invalid" : "live",
        ms,
        version: String(json.catalog_version ?? "-"),
        productCount: Number(json.product_count ?? 0),
        issues: Array.from(new Set(issues)).slice(0, 4),
        raw: JSON.stringify(json, null, 2),
      });
    } catch (error) {
      setHealth({
        status: "invalid",
        ms: Math.round(performance.now() - start),
        version: "-",
        productCount: 0,
        issues: [error instanceof Error ? error.message : String(error)],
        raw: "",
      });
    }
  }, []);

  useEffect(() => {
    void checkCatalog();
  }, [checkCatalog]);

  // Animated hero counter
  useEffect(() => {
    if (!data?.seeded) return;
    const controls = animate(0, data.liftPct, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate: (value) => setDisplayLift(value),
    });
    return () => controls.stop();
  }, [data]);

  if (loading && !data) {
    return (
      <div className="grid min-h-40 animate-pulse place-items-center rounded-2xl border border-slate-200 bg-white text-xs text-slate-500">
        Loading revenue analytics…
      </div>
    );
  }

  if (!data?.seeded) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm">
        <p className="font-semibold text-amber-800">No simulation data found.</p>
        <p className="mt-1 text-amber-700/80">
          Run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs ring-1 ring-amber-200">npm run seed:revenue</code> to
          generate 50 baseline vs 50 agent orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Revenue Lift hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-7"
      >
        <div className="absolute right-0 top-0 h-[280px] w-[420px] rounded-full bg-[#204CF5]/[0.06] blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#204CF5]">REVENUE LIFT · AGENTS ON vs OFF</p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-6xl font-[800] tabular-nums tracking-tight text-[#204CF5]">+{displayLift.toFixed(0)}%</span>
              <span className="text-sm font-medium text-slate-500">from autonomous upsells</span>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
              50 agent-driven orders vs 50 baseline orders without upsells over the last 14 days
              (simulated, test mode). Agents suggest one upsell per cart under the 40% price cap.
            </p>
          </div>
          <div className="min-w-[220px] space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Agents on</span>
              <span className="font-mono text-sm font-semibold text-slate-900">{formatINR(data.agent.revenuePaise)}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Baseline</span>
              <span className="font-mono text-sm font-semibold text-slate-600">{formatINR(data.baseline.revenuePaise)}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Lift validated on simulation
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Metric cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Agent revenue"
          value={formatINR(data.agent.revenuePaise)}
          hint={`${data.agent.orders} orders · ${data.agent.upsells} upsells`}
          accent="text-slate-900"
        />
        <MetricCard
          title="Baseline revenue"
          value={formatINR(data.baseline.revenuePaise)}
          hint={`${data.baseline.orders} orders · no upsells`}
          accent="text-slate-600"
        />
        <MetricCard
          title="Upsell conversion"
          value={`${data.conversionPct}%`}
          hint={`${data.agent.upsells} of ${data.agent.orders} carts accepted`}
          accent="text-[#204CF5]"
        />
        <MetricCard
          title="Avg order value"
          value={formatINR(data.agent.avgOrderPaise)}
          hint={`baseline: ${formatINR(data.baseline.avgOrderPaise)}`}
          accent="text-violet-600"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.revenueOverTime}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v / 100)}`} />
              <Tooltip {...chartTooltip} formatter={(v) => formatINR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Line type="monotone" dataKey="agentPaise" name="Agents on" stroke="#204CF5" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="baselinePaise" name="Baseline" stroke="#94A3B8" strokeWidth={2} dot={false} strokeDasharray="6 4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Upsell conversion rate">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.conversionOverTime}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <Tooltip {...chartTooltip} formatter={(v) => `${v}%`} />
              <Bar dataKey="pct" name="Conversion" fill="#204CF5" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top products by revenue" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.topProducts} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v / 100)}`} />
              <YAxis type="category" dataKey="name" width={220} tick={{ fill: "#334155", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTooltip} formatter={(v) => formatINR(Number(v))} />
              <Bar dataKey="revenuePaise" name="Revenue" fill="#7C3AED" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Catalog health + modal ── */}
      <CatalogHealthCard health={health} onOpen={() => setModalOpen(true)} onRecheck={() => void checkCatalog()} />

      {modalOpen && <CatalogFeedModal health={health} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function MetricCard(props: { title: string; value: string; hint: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-slate-500">{props.title}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${props.accent}`}>{props.value}</p>
      <p className="mt-1 text-xs text-slate-500">{props.hint}</p>
    </div>
  );
}

function ChartCard(props: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${props.className ?? ""}`}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-slate-500">
        {props.title.toUpperCase()}
      </p>
      {props.children}
    </div>
  );
}

function CatalogHealthCard(props: {
  health: CatalogHealth;
  onOpen: () => void;
  onRecheck: () => void;
}) {
  const { health } = props;
  const led =
    health.status === "live"
      ? "bg-emerald-500"
      : health.status === "checking"
        ? "animate-pulse bg-amber-500"
        : "bg-red-500";
  const badge =
    health.status === "live" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : health.status === "checking" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200";
  const statusLabel =
    health.status === "live" ? "Live & valid" : health.status === "checking" ? "Checking…" : "Invalid";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${led}`} />
          <div>
            <p className="text-xs font-semibold tracking-widest text-slate-700">
              AGENT-READABLE CATALOG HEALTH
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              GET /api/catalog — the feed AI agents buy from
            </p>
          </div>
          <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold ring-1 md:inline-flex ${badge}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={props.onRecheck}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Re-check
          </button>
          <button
            onClick={props.onOpen}
            disabled={health.status === "checking"}
            className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            View catalog feed
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500">STATUS</p>
          <p className={`mt-1 text-sm font-semibold ${health.status === "live" ? "text-emerald-700" : health.status === "checking" ? "text-amber-700" : "text-red-600"}`}>
            {statusLabel}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500">PRODUCTS</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{health.productCount ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500">FEED VERSION</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{health.version ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500">RESPONSE TIME</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{health.ms != null ? `${health.ms} ms` : "—"}</p>
        </div>
      </div>

      {health.status === "invalid" && (
        <ul className="mt-3 space-y-1 text-xs text-red-600">
          {(health.issues ?? []).map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}
      {health.status === "live" && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
          Schema valid — ids, numeric paise prices, availability states and upsell candidates all present.
        </p>
      )}
    </div>
  );
}

function CatalogFeedModal(props: { health: CatalogHealth; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={props.onClose}
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-slate-700">
              AGENT CATALOG FEED — GET /api/catalog
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {props.health.status === "live" ? "Live & valid · " : ""}
              {props.health.productCount} products · v{props.health.version} · {props.health.ms} ms
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </header>
        <pre className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-200 scrollbar-thin">
          {props.health.raw || "—"}
        </pre>
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          This exact JSON is what Growth / Checkout agents consume via their get_catalog tool.
        </footer>
      </motion.div>
    </motion.div>
  );
}
