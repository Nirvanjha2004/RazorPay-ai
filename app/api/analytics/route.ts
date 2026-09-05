import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/analytics — aggregate spend / activity stats for the dashboard. */
export async function GET(_request: NextRequest) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [totalRuns, blocked, failed, successful, spendToday, byAgent] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { status: "BLOCKED" } }),
    prisma.auditLog.count({ where: { status: "FAILED" } }),
    prisma.auditLog.count({ where: { status: "SUCCESS" } }),
    prisma.auditLog.aggregate({
      _sum: { amountInPaise: true },
      where: { status: "SUCCESS", createdAt: { gte: startOfDay }, amountInPaise: { not: null } },
    }),
    prisma.auditLog.groupBy({
      by: ["agentType"],
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    totalRuns,
    successful,
    failed,
    blocked,
    spendTodayPaise: spendToday._sum.amountInPaise ?? 0,
    runsByAgent: byAgent.map((g) => ({ agentType: g.agentType, runs: g._count._all })),
  });
}
