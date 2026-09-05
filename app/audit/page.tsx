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
  if (status === "SUCCESS") return <Badge variant="success">{status}</Badge>;
  if (status === "BLOCKED") return <Badge variant="warning">{status}</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          Every agent run — successful, failed, or blocked — is recorded here (last 100 entries).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>
            Also available as JSON via <code className="font-mono text-xs">GET /api/audit</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity yet. Run an agent from the Dashboard to populate the trail.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Razorpay Refs</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.agentType}</TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {log.amountInPaise != null ? formatINR(log.amountInPaise) : "—"}
                    </TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground">
                      {log.razorpayOrderId ?? log.razorpayPaymentId ?? log.razorpayRefundId ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span
                        className="block truncate text-xs text-muted-foreground"
                        title={log.blockedReason ?? log.error ?? log.output ?? undefined}
                      >
                        {log.blockedReason ?? log.error ?? log.output ?? "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
