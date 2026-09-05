import { KeyRound, ShieldCheck } from "lucide-react";

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
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Environment configuration and guardrail policy. Edit <code className="font-mono text-xs">.env</code>{" "}
          to change values.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Razorpay Credentials
          </CardTitle>
          <CardDescription>
            Read from <code className="font-mono text-xs">RAZORPAY_KEY_ID</code> /{" "}
            <code className="font-mono text-xs">RAZORPAY_KEY_SECRET</code>. Secrets are never rendered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Status</p>
              <p className="text-xs text-muted-foreground">
                {configured ? "Credentials present" : "Missing — set both env vars in .env"}
              </p>
            </div>
            <Badge variant={configured ? "success" : "destructive"}>
              {configured ? "Configured" : "Not configured"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Key ID</p>
              <p className="font-mono text-xs text-muted-foreground">{maskKey(keyId)}</p>
            </div>
            <Badge variant={isTestMode ? "success" : "warning"}>
              {isTestMode ? "Test mode" : keyId ? "LIVE MODE — check!" : "unknown"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Key Secret</p>
              <p className="font-mono text-xs text-muted-foreground">••••••••••••••••</p>
            </div>
            <Badge variant="secondary">hidden</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Guardrail Policy
          </CardTitle>
          <CardDescription>
            Defined in <code className="font-mono text-xs">lib/guardrails/index.ts</code>; override via
            <code className="font-mono text-xs"> GUARDRAIL_*</code> env vars.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="font-medium">Per-action spend cap</p>
            <p className="text-muted-foreground">{formatINR(PER_ACTION_SPEND_CAP_PAISE)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Daily spend cap</p>
            <p className="text-muted-foreground">{formatINR(DAILY_SPEND_CAP_PAISE)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Daily refund cap</p>
            <p className="text-muted-foreground">{DAILY_REFUND_COUNT_CAP} refunds/day</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Currency allowlist</p>
            <p className="text-muted-foreground">{ALLOWED_CURRENCIES.join(", ")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Allowed actions</p>
            <p className="font-mono text-xs text-muted-foreground">{ALLOWED_ACTIONS.join(", ")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-medium">Refund allowlist</p>
            <p className="text-muted-foreground">
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
  );
}
