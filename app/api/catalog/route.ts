import { NextResponse } from "next/server";
import { buildAgentCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/catalog — agent-readable product catalog.
 *
 * Designed for AI agents to consume: flat JSON, prices in paise,
 * explicit availability, and pre-computed upsell candidates.
 */
export async function GET() {
  try {
    const catalog = await buildAgentCatalog();
    return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/catalog] failed:", message);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}

