import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDateTime, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Trail — CommerceAgent" };

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") return <Badge variant="success">Success</Badge>;
  if (status === "BLOCKED") return <Badge variant="warning">Blocked</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-[1160px] space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Audit trail</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Every agent run — successful, failed or blocked — is recorded here. Last 100 entries · also available as
            JSON via <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">GET /api/audit</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            {logs.length} records
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Immutable log
          </span>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Click a row to inspect reasoning and Razorpay references.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <div className="max-w-sm">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  ◈
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">No activity yet</p>
                <p className="mt-1 text-sm text-slate-500">Run an agent from the terminal to populate the trail.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b border-slate-200">
                    <th className="h-10 px-4 text-left text-xs font-semibold tracking-wide text-slate-500">Time</th>
                    <th className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-slate-500">Agent</th>
                    <th className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-slate-500">Action</th>
                    <th className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-slate-500">Status</th>
                    <th className="h-10 px-3 text-right text-xs font-semibold tracking-wide text-slate-500">Amount</th>
                    <th className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-slate-500">Refs</th>
                    <th className="h-10 px-4 text-left text-xs font-semibold tracking-wide text-slate-500">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-slate-700">{log.agentType}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{log.action}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs text-slate-700">
                        {log.amountInPaise != null ? formatINR(log.amountInPaise) : "—"}
                      </td>
                      <td className="max-w-40 truncate px-3 py-3 font-mono text-xs text-slate-500">
                        {log.razorpayOrderId ?? log.razorpayPaymentId ?? log.razorpayRefundId ?? "—"}
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <span
                          className="block truncate text-xs text-slate-600"
                          title={log.blockedReason ?? log.error ?? log.output ?? undefined}
                        >
                          {log.blockedReason ?? log.error ?? log.output ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
