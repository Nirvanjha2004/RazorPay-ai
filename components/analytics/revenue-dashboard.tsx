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
  contentStyle: { background: "#09090b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
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
      <div className="grid min-h-40 animate-pulse place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-600">
        Loading revenue analytics…
      </div>
    );
  }

  if (!data?.seeded) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 text-sm">
        <p className="font-semibold text-amber-400">No simulation data found.</p>
        <p className="mt-1 text-muted-foreground">
          Run <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">npm run seed:revenue</code> to
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
        className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-zinc-950 p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-emerald-400">REVENUE LIFT</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-6xl font-bold tabular-nums text-emerald-400">+{displayLift.toFixed(0)}%</span>
              <span className="text-sm text-zinc-400">revenue from agents</span>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
              50 agent-driven orders vs 50 baseline orders without upsells over the last 14 days
              (simulated, test mode). Agents suggest one upsell per cart under the 40% price cap.
            </p>
          </div>
          <div className="space-y-1 text-right text-xs">
            <p className="text-zinc-500">
              AGENTS ON{" "}
              <span className="ml-2 font-mono text-lg font-semibold text-emerald-400">
                {formatINR(data.agent.revenuePaise)}
              </span>
            </p>
            <p className="text-zinc-500">
              AGENTS OFF{" "}
              <span className="ml-2 font-mono text-lg font-semibold text-zinc-300">
                {formatINR(data.baseline.revenuePaise)}
              </span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Metric cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Agent Revenue"
          value={formatINR(data.agent.revenuePaise)}
          hint={`${data.agent.orders} orders · ${data.agent.upsells} upsells`}
          accent="text-emerald-400"
        />
        <MetricCard
          title="Baseline Revenue"
          value={formatINR(data.baseline.revenuePaise)}
          hint={`${data.baseline.orders} orders · no upsells`}
          accent="text-zinc-200"
        />
        <MetricCard
          title="Upsell Conversion"
          value={`${data.conversionPct}%`}
          hint={`${data.agent.upsells} of ${data.agent.orders} carts accepted`}
          accent="text-sky-400"
        />
        <MetricCard
          title="Avg Order Value"
          value={formatINR(data.agent.avgOrderPaise)}
          hint={`baseline: ${formatINR(data.baseline.avgOrderPaise)}`}
          accent="text-violet-400"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue Over Time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.revenueOverTime}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 100)}`} />
              <Tooltip {...chartTooltip} formatter={(v) => formatINR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="agentPaise" name="Agents ON" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="baselinePaise" name="Baseline" stroke="#71717a" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Upsell Conversion Rate (daily)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.conversionOverTime}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip {...chartTooltip} formatter={(v) => `${v}%`} />
              <Bar dataKey="pct" name="Conversion" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Products by Revenue" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.topProducts} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 100)}`} />
              <YAxis type="category" dataKey="name" width={220} tick={{ fill: "#a1a1aa", fontSize: 10 }} />
              <Tooltip {...chartTooltip} formatter={(v) => formatINR(Number(v))} />
              <Bar dataKey="revenuePaise" name="Revenue" fill="#a78bfa" radius={[0, 4, 4, 0]} />
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">{props.title}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${props.accent}`}>{props.value}</p>
      <p className="mt-1 text-[11px] text-zinc-600">{props.hint}</p>
    </div>
  );
}

function ChartCard(props: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-950 p-4 ${props.className ?? ""}`}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-400">
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
  const statusLabel =
    health.status === "live" ? "LIVE & VALID" : health.status === "checking" ? "CHECKING…" : "INVALID";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${led}`} />
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-400">
              AGENT-READABLE CATALOG HEALTH
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              GET /api/catalog — the feed AI agents buy from
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={props.onRecheck}
            className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            RE-CHECK
          </button>
          <button
            onClick={props.onOpen}
            disabled={health.status === "checking"}
            className="rounded border border-sky-500/50 bg-sky-500/15 px-3 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
          >
            VIEW AGENT CATALOG FEED
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 p-2">
          <p className="text-zinc-600">STATUS</p>
          <p className={health.status === "live" ? "text-emerald-400" : health.status === "checking" ? "text-amber-400" : "text-red-400"}>
            {statusLabel}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-2">
          <p className="text-zinc-600">PRODUCTS</p>
          <p className="font-mono text-zinc-300">{health.productCount ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-2">
          <p className="text-zinc-600">FEED VERSION</p>
          <p className="font-mono text-zinc-300">{health.version ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-2">
          <p className="text-zinc-600">RESPONSE TIME</p>
          <p className="font-mono text-zinc-300">{health.ms != null ? `${health.ms} ms` : "—"}</p>
        </div>
      </div>

      {health.status === "invalid" && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-red-400">
          {(health.issues ?? []).map((issue) => (
            <li key={issue}>❌ {issue}</li>
          ))}
        </ul>
      )}
      {health.status === "live" && (
        <p className="mt-2 text-[11px] text-emerald-400/80">
          ✅ Schema valid: ids, numeric paise prices, availability states and upsell candidates all present —
          the store is AI-buyer transactable.
        </p>
      )}
    </div>
  );
}

function CatalogFeedModal(props: { health: CatalogHealth; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={props.onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-300">
              AGENT CATALOG FEED — GET /api/catalog
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {props.health.status === "live" ? "✅ live & valid · " : ""}
              {props.health.productCount} products · v{props.health.version} · {props.health.ms} ms
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            ✕ CLOSE
          </button>
        </header>
        <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-emerald-300/90 scrollbar-thin">
          {props.health.raw || "—"}
        </pre>
        <footer className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
          This exact JSON is what GROWTH/CHECKOUT agents consume via their get_catalog tool — proving the
          store is AI-buyer transactable.
        </footer>
      </motion.div>
    </motion.div>
  );
}

