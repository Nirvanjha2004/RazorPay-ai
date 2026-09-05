import { CheckCircle2, OctagonAlert, Wallet, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { DAILY_SPEND_CAP_PAISE } from "@/lib/guardrails";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — CommerceAgent" };

export default async function AnalyticsPage() {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [total, successful, failed, blocked, spendToday, byAgent] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { status: "SUCCESS" } }),
    prisma.auditLog.count({ where: { status: "FAILED" } }),
    prisma.auditLog.count({ where: { status: "BLOCKED" } }),
    prisma.auditLog.aggregate({
      _sum: { amountInPaise: true },
      where: { status: "SUCCESS", createdAt: { gte: startOfDay }, amountInPaise: { not: null } },
    }),
    prisma.auditLog.groupBy({ by: ["agentType"], _count: { _all: true } }),
  ]);

  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
  const dailyUsage =
    DAILY_SPEND_CAP_PAISE > 0
      ? Math.min(
          Math.round(((spendToday._sum.amountInPaise ?? 0) / DAILY_SPEND_CAP_PAISE) * 100),
          100
        )
      : 0;

  const cards = [
    { title: "Total Runs", value: String(total), icon: CheckCircle2 },
    { title: "Success Rate", value: `${successRate}%`, icon: CheckCircle2 },
    { title: "Failed", value: String(failed), icon: XCircle },
    { title: "Blocked", value: String(blocked), icon: OctagonAlert },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Operational metrics across all agent runs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Daily Spend Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{formatINR(spendToday._sum.amountInPaise ?? 0)}</span>
              <span className="text-muted-foreground">of {formatINR(DAILY_SPEND_CAP_PAISE)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${dailyUsage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {dailyUsage}% of the daily cap used (resets at 00:00 UTC)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runs by Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byAgent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
            ) : (
              byAgent
                .sort((a, b) => b._count._all - a._count._all)
                .map((group) => {
                  const pct = total > 0 ? Math.round((group._count._all / total) * 100) : 0;
                  return (
                    <div key={group.agentType} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs">{group.agentType}</span>
                        <span className="text-muted-foreground">
                          {group._count._all} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
