import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SimItem {
  productId: string;
  name: string;
  priceInPaise: number;
  quantity: number;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GET /api/analytics/revenue — agents-ON revenue vs simulated baseline.
 * Reads the PAID orders seeded by `npm run seed:revenue`
 * (channel = "baseline" | "agent").
 */
export async function GET() {
  const orders = await prisma.order.findMany({
    where: { channel: { in: ["baseline", "agent"] }, status: "PAID" },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return NextResponse.json({ seeded: false });
  }

  const baseline = orders.filter((o) => o.channel === "baseline");
  const agent = orders.filter((o) => o.channel === "agent");
  const sum = (rows: typeof orders) => rows.reduce((total, o) => total + o.amountInPaise, 0);

  const baselineRevenue = sum(baseline);
  const agentRevenue = sum(agent);
  const agentUpsells = agent.filter((o) => {
    const items = JSON.parse(o.itemsJson ?? "[]") as SimItem[];
    return items.length > 1;
  });

  const liftPct =
    baselineRevenue > 0 ? ((agentRevenue - baselineRevenue) / baselineRevenue) * 100 : 0;
  const conversionPct = agent.length > 0 ? (agentUpsells.length / agent.length) * 100 : 0;

  // Revenue over time (per-day totals per channel, last 14 days)
  const dayMap = new Map<string, { baselinePaise: number; agentPaise: number }>();
  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const bucket = dayMap.get(key) ?? { baselinePaise: 0, agentPaise: 0 };
    if (order.channel === "baseline") bucket.baselinePaise += order.amountInPaise;
    else bucket.agentPaise += order.amountInPaise;
    dayMap.set(key, bucket);
  }
  const revenueOverTime = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      baselinePaise: bucket.baselinePaise,
      agentPaise: bucket.agentPaise,
    }));

  // Upsell conversion over time (per-day % among agent orders)
  const convMap = new Map<string, { total: number; accepted: number }>();
  for (const order of agent) {
    const key = dayKey(order.createdAt);
    const bucket = convMap.get(key) ?? { total: 0, accepted: 0 };
    bucket.total += 1;
    const items = JSON.parse(order.itemsJson ?? "[]") as SimItem[];
    if (items.length > 1) bucket.accepted += 1;
    convMap.set(key, bucket);
  }
  const conversionOverTime = Array.from(convMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      pct: bucket.total > 0 ? Math.round((bucket.accepted / bucket.total) * 100) : 0,
      accepted: bucket.accepted,
      total: bucket.total,
    }));

  // Top products by revenue (both channels)
  const productMap = new Map<string, { name: string; units: number; revenuePaise: number }>();
  for (const order of orders) {
    const items = JSON.parse(order.itemsJson ?? "[]") as SimItem[];
    for (const item of items) {
      const entry = productMap.get(item.productId) ?? { name: item.name, units: 0, revenuePaise: 0 };
      entry.units += item.quantity;
      entry.revenuePaise += item.priceInPaise * item.quantity;
      productMap.set(item.productId, entry);
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([productId, entry]) => ({ productId, ...entry }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, 6);

  return NextResponse.json({
    seeded: true,
    baseline: {
      orders: baseline.length,
      revenuePaise: baselineRevenue,
      avgOrderPaise: baseline.length > 0 ? Math.round(baselineRevenue / baseline.length) : 0,
    },
    agent: {
      orders: agent.length,
      revenuePaise: agentRevenue,
      avgOrderPaise: agent.length > 0 ? Math.round(agentRevenue / agent.length) : 0,
      upsells: agentUpsells.length,
    },
    liftPct: Math.round(liftPct * 10) / 10,
    conversionPct: Math.round(conversionPct * 10) / 10,
    revenueOverTime,
    conversionOverTime,
    topProducts,
  });
}
