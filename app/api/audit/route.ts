import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/audit?limit=50&status=BLOCKED&agentType=refund — list audit logs. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);
  const status = searchParams.get("status");
  const agentType = searchParams.get("agentType");

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(agentType ? { agentType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ logs, count: logs.length });
}
