import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/agent-buy/runs — recent buyer runs (for the judge replay list). */
export async function GET() {
  const runs = await prisma.buyerRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, request: true, createdAt: true },
  });
  return NextResponse.json({ runs });
}