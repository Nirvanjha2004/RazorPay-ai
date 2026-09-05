/**
 * Revenue simulation seed: 50 baseline orders (agents OFF, no upsells) vs
 * 50 agent-driven orders (agents ON, same product mix + upsells).
 *
 * Deterministic: an LCG RNG with an auto-calibrated seed so the revenue lift
 * lands on +23% (the hero metric). Spread over the last 14 days.
 *
 *   npm run seed:revenue
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORDER_COUNT = 50;
const DAYS = 14;

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function generate(rand, products) {
  const pool = products.filter((p) => p.priceInPaise >= 50000 && p.priceInPaise <= 500000 && p.stock > 0);
  const upsellPool = products.filter((p) => p.priceInPaise <= 250000).sort((a, b) => a.priceInPaise - b.priceInPaise);

  // Baseline: one random product per order, no upsells.
  const baseline = [];
  for (let i = 0; i < ORDER_COUNT; i++) {
    baseline.push({
      product: pool[Math.floor(rand() * pool.length)],
      day: Math.floor(rand() * DAYS),
    });
  }
  const baselineTotal = baseline.reduce((sum, o) => sum + o.product.priceInPaise, 0);

  // Agent: same product mix, upsells attached greedily toward a +23% target.
  const target = baselineTotal * 1.23;
  const agent = baseline.map(({ product, day }) => ({ product, day, upsell: null }));
  let acc = baselineTotal;
  let cursor = 0;
  let guard = 0;
  while (acc < target && guard < 400) {
    const idx = cursor % ORDER_COUNT;
    const remaining = target - acc;
    const available = upsellPool.filter((p) => !agent[idx].upsell && p.priceInPaise <= remaining);
    const choice =
      available.length > 0 ? available[available.length - 1] : upsellPool.find((p) => p.priceInPaise <= remaining);
    if (choice) {
      agent[idx].upsell = choice;
      acc += choice.priceInPaise;
    }
    cursor++;
    guard++;
  }

  const liftPct = ((acc - baselineTotal) / baselineTotal) * 100;
  return { baseline, agent, baselineTotal, agentTotal: acc, liftPct };
}

async function main() {
  console.log("Seeding revenue simulation (50 baseline vs 50 agent orders)…");

  const products = await prisma.product.findMany();
  if (products.length === 0) {
    throw new Error("No products found — run `npx prisma db seed` first.");
  }

  // Auto-calibrate: first seed whose lift rounds to exactly +23%.
  let chosen = null;
  for (let seed = 1; seed <= 50000; seed++) {
    const result = generate(lcg(seed), products);
    if (result.liftPct >= 22.5 && result.liftPct < 23.5) {
      chosen = { seed, ...result };
      break;
    }
  }
  if (!chosen) throw new Error("Calibration failed — no seed produced a +23% lift.");
  console.log(`Calibrated: seed=${chosen.seed}, lift=${chosen.liftPct.toFixed(2)}%`);

  // Replace previous simulation data (idempotent re-runs).
  const deleted = await prisma.order.deleteMany({
    where: { razorpayOrderId: { startsWith: "order_sim_" } },
  });
  console.log(`Cleared ${deleted.count} previous simulated orders.`);

  const timeRand = lcg(777);
  let n = 0;

  async function createOrder(order, channel, index) {
    const items = [
      { productId: order.product.id, name: order.product.name, priceInPaise: order.product.priceInPaise, quantity: 1 },
    ];
    if (order.upsell) {
      items.push({
        productId: order.upsell.id,
        name: order.upsell.name,
        priceInPaise: order.upsell.priceInPaise,
        quantity: 1,
      });
    }
    const total = items.reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0);
    const createdAt = new Date(
      Date.now() - (DAYS - 1 - order.day) * 86400000 - Math.floor(timeRand() * 10) * 3600000
    );
    await prisma.order.create({
      data: {
        razorpayOrderId: `order_sim_${channel}_${index}`,
        amountInPaise: total,
        currency: "INR",
        status: "PAID",
        channel,
        receipt: `sim-${channel}-${index}`,
        itemsJson: JSON.stringify(items),
        notes: JSON.stringify({ simulated: true, upsell: Boolean(order.upsell) }),
        createdAt,
        updatedAt: createdAt,
      },
    });
    n++;
  }

  for (const [index, order] of chosen.baseline.entries()) {
    await createOrder(order, "baseline", index);
  }
  for (const [index, order] of chosen.agent.entries()) {
    await createOrder(order, "agent", index);
  }

  const upsells = chosen.agent.filter((o) => o.upsell).length;
  console.log(`Created ${n} PAID orders over ${DAYS} days:`);
  console.log(`  baseline: 50 orders, ₹${(chosen.baselineTotal / 100).toLocaleString("en-IN")} revenue, 0 upsells`);
  console.log(
    `  agent:    50 orders, ₹${(chosen.agentTotal / 100).toLocaleString("en-IN")} revenue, ${upsells} upsells (${(
      (upsells / ORDER_COUNT) *
      100
    ).toFixed(0)}% conversion)`
  );
  console.log(`  revenue lift: +${chosen.liftPct.toFixed(2)}%`);
}

main()
  .catch((error) => {
    console.error("Revenue seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
