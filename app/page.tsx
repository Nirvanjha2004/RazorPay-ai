import { ArrowRight, Bot, CheckCircle2, OctagonAlert, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { AgentRunner } from "@/components/agent-runner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { DAILY_SPEND_CAP_PAISE, PER_ACTION_SPEND_CAP_PAISE } from "@/lib/guardrails";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [totalRuns, blocked, successful, spendToday] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { status: "BLOCKED" } }),
    prisma.auditLog.count({ where: { status: "SUCCESS" } }),
    prisma.auditLog.aggregate({
      _sum: { amountInPaise: true },
      where: { status: "SUCCESS", createdAt: { gte: startOfDay }, amountInPaise: { not: null } },
    }),
  ]);

  const stats = [
    { title: "Agent Runs", value: String(totalRuns), icon: Bot, hint: "all time" },
    { title: "Successful", value: String(successful), icon: CheckCircle2, hint: "all time" },
    { title: "Blocked by Guardrails", value: String(blocked), icon: OctagonAlert, hint: "caps & allowlists" },
    {
      title: "Spend Today",
      value: formatINR(spendToday._sum.amountInPaise ?? 0),
      icon: Wallet,
      hint: `daily cap ${formatINR(DAILY_SPEND_CAP_PAISE)}`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Autonomous Razorpay operations with hard guardrails and a complete audit trail.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Guardrail summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" /> Guardrails
            </CardTitle>
            <CardDescription>Applied to every agent run before any Razorpay call.</CardDescription>
          </div>
          <Badge variant="success">Active</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="font-medium">Per-action cap</p>
            <p className="text-muted-foreground">{formatINR(PER_ACTION_SPEND_CAP_PAISE)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Daily cap</p>
            <p className="text-muted-foreground">{formatINR(DAILY_SPEND_CAP_PAISE)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Allowlists</p>
            <p className="text-muted-foreground">INR-only · refund allowlist</p>
          </div>
        </CardContent>
      </Card>

      {/* Agent runner */}
      <AgentRunner />

      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        View all registered agents <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
