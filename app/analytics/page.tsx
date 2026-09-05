import { RevenueDashboard } from "@/components/analytics/revenue-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — CommerceAgent" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Revenue impact of the agent fleet vs a simulated no-agent baseline.
        </p>
      </div>
      <RevenueDashboard />
    </div>
  );
}
