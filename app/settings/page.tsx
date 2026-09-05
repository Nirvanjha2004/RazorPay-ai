import { KeyRound, ShieldCheck, Settings2, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ALLOWED_ACTIONS,
  ALLOWED_CURRENCIES,
  DAILY_REFUND_COUNT_CAP,
  DAILY_SPEND_CAP_PAISE,
  PER_ACTION_SPEND_CAP_PAISE,
  REFUND_ALLOWLIST,
  REFUND_ALLOWLIST_ENABLED,
} from "@/lib/guardrails";
import { getPublicKeyId, isRazorpayConfigured } from "@/lib/razorpay/client";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — CommerceAgent" };

function maskKey(keyId: string | null): string {
  if (!keyId) return "not set";
  if (keyId.length <= 12) return keyId;
  return `${keyId.slice(0, 12)}${"•".repeat(8)}`;
}

export default function SettingsPage() {
  const configured = isRazorpayConfigured();
  const keyId = getPublicKeyId();
  const isTestMode = keyId?.startsWith("rzp_test_") ?? false;

  return (
    <div className="mx-auto max-w-[1160px] space-y-6 px-6 py-8">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Environment configuration and guardrail policy. Edit <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">.env</code> to change values.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
                <KeyRound className="h-4 w-4 text-slate-700" />
              </span>
              Razorpay credentials
            </CardTitle>
            <CardDescription>
              Read from <code className="font-mono text-xs">RAZORPAY_KEY_ID</code> /{" "}
              <code className="font-mono text-xs">RAZORPAY_KEY_SECRET</code>. Secrets are never rendered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-slate-900">Status</p>
                <p className="text-xs text-slate-500">
                  {configured ? "Credentials present" : "Missing — set both env vars in .env"}
                </p>
              </div>
              <Badge variant={configured ? "success" : "destructive"}>
                {configured ? "Configured" : "Not configured"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Key ID</p>
                <p className="truncate font-mono text-xs text-slate-600">{maskKey(keyId)}</p>
              </div>
              <Badge variant={isTestMode ? "success" : "warning"}>
                {isTestMode ? "Test mode" : keyId ? "Live mode — check!" : "unknown"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-slate-900">Key Secret</p>
                <p className="font-mono text-xs text-slate-500">••••••••••••••••</p>
              </div>
              <Badge variant="secondary">hidden</Badge>
            </div>
            <p className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
              <ExternalLink className="h-3 w-3" /> Use Razorpay test keys only in this demo environment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </span>
              Guardrail policy
            </CardTitle>
            <CardDescription>
              Defined in <code className="font-mono text-xs">lib/guardrails/index.ts</code>; override via
              <code className="font-mono text-xs"> GUARDRAIL_*</code> env vars.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500">PER-ACTION CAP</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{formatINR(PER_ACTION_SPEND_CAP_PAISE)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500">DAILY SPEND CAP</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{formatINR(DAILY_SPEND_CAP_PAISE)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500">DAILY REFUND CAP</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{DAILY_REFUND_COUNT_CAP} refunds / day</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500">CURRENCIES</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{ALLOWED_CURRENCIES.join(", ")}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <p className="text-xs font-semibold tracking-wide text-slate-500">ALLOWED ACTIONS</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-slate-700">{ALLOWED_ACTIONS.join(" · ")}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <p className="text-xs font-semibold tracking-wide text-slate-500">REFUND ALLOWLIST</p>
              <p className="mt-1 text-sm text-slate-700">
                {REFUND_ALLOWLIST_ENABLED
                  ? REFUND_ALLOWLIST.length > 0
                    ? `${REFUND_ALLOWLIST.length} payment ID(s) + all pay_test_*`
                    : "enabled — no IDs listed (only pay_test_* allowed)"
                  : "disabled"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Settings2 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>How to change guardrails</CardTitle>
            <CardDescription>Update .env and restart the server — values are read at boot.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
{`# .env
GUARDRAIL_PER_ACTION_CAP_PAISE=200000
GUARDRAIL_DAILY_CAP_PAISE=500000
GUARDRAIL_DAILY_REFUND_CAP=5
# RAZORPAY_KEY_ID=rzp_test_xxx
# RAZORPAY_KEY_SECRET=xxx`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
