import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Stock at or below this level is reported as "low_stock" to agents. */
const LOW_STOCK_THRESHOLD = 3;
/** Max upsell candidates suggested per product. */
const MAX_UPSELLS = 3;

type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price_in_paise: number;
  price_display: string;
  availability: "in_stock" | "low_stock" | "out_of_stock";
  stock: number;
  upsell_candidates: { id: string; name: string; price_in_paise: number; reason: string }[];
};

function toAvailability(stock: number): CatalogProduct["availability"] {
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

/**
 * Deterministic upsell ranking (no LLM needed at read time):
 *   1. Cheaper items from the same category ("same_category")
 *   2. Cheapest items from other categories ("also_considered")
 * Agents can re-rank these using their own heuristics.
 */
function computeUpsellCandidates(
  product: { id: string; category: string; priceInPaise: number },
  all: { id: string; name: string; category: string; priceInPaise: number }[]
): CatalogProduct["upsell_candidates"] {
  const others = all.filter((p) => p.id !== product.id);
  const sameCategory = others
    .filter((p) => p.category === product.category)
    .sort((a, b) => a.priceInPaise - b.priceInPaise)
    .slice(0, 2)
    .map((p) => ({ id: p.id, name: p.name, price_in_paise: p.priceInPaise, reason: "same_category" }));

  const remaining = MAX_UPSELLS - sameCategory.length;
  const alsoConsidered =
    remaining > 0
      ? others
          .filter((p) => p.category !== product.category)
          .sort((a, b) => a.priceInPaise - b.priceInPaise)
          .slice(0, remaining)
          .map((p) => ({
            id: p.id,
            name: p.name,
            price_in_paise: p.priceInPaise,
            reason: "also_considered",
          }))
      : [];

  return [...sameCategory, ...alsoConsidered];
}

/**
 * GET /api/catalog — agent-readable product catalog.
 *
 * Designed for AI agents to consume: flat JSON, prices in paise,
 * explicit availability, and pre-computed upsell candidates.
 */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { priceInPaise: "asc" }],
    });

    const summary = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      priceInPaise: p.priceInPaise,
    }));

    const catalog: CatalogProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price_in_paise: p.priceInPaise,
      price_display: formatINR(p.priceInPaise),
      availability: toAvailability(p.stock),
      stock: p.stock,
      upsell_candidates: computeUpsellCandidates(p, summary),
    }));

    return NextResponse.json(
      {
        catalog_version: "1.0",
        generated_at: new Date().toISOString(),
        currency: "INR",
        product_count: catalog.length,
        products: catalog,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/catalog] failed:", message);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
