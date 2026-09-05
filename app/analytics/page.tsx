import { RevenueDashboard } from "@/components/analytics/revenue-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — CommerceAgent" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-[1160px] space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Revenue analytics</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Revenue impact of the agent fleet vs a simulated no-agent baseline. All figures are simulated test-mode data.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
          Last 14 days · 50 vs 50 orders
        </span>
      </div>
      <RevenueDashboard />
    </div>
  );
}
