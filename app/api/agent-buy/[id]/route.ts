import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/agent-buy/[id] — full session replay of a saved buyer run. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const run = await prisma.buyerRun.findUnique({ where: { id: params.id } });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    request: run.request,
    intent: JSON.parse(run.intentJson),
    steps: JSON.parse(run.stepsJson),
    summary: JSON.parse(run.summaryJson),
    createdAt: run.createdAt,
  });
}