/**
 * Print recent agent decisions from the audit_logs table.
 *   node scripts/audit-check.mjs [limit]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const limit = Number(process.argv[2] ?? 12);

const rows = await prisma.auditLog.findMany({
  where: { agentType: { in: ["GROWTH", "CHECKOUT", "GUARDIAN", "SYSTEM"] } },
  orderBy: { createdAt: "desc" },
  take: limit,
});

for (const row of rows) {
  const reasoning = (row.reasoning ?? "").slice(0, 80);
  console.log(`[${row.agentType}] ${row.action} -> ${row.status} | ${reasoning}`);
}

await prisma.$disconnect();
