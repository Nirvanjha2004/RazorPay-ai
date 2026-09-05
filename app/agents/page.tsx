import { Bot, Coins, Eye, ShieldCheck, ArrowRight, Plug } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agents } from "@/lib/agents";

export const metadata = { title: "Agents — CommerceAgent" };

const icons = [Coins, ShieldCheck, Eye];
const accent: Record<string, string> = {
  growth: "bg-violet-600",
  checkout: "bg-[#204CF5]",
  guardian: "bg-amber-500",
};

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-[1160px] space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Agents</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Three specialized agents orchestrate every transaction. Only the Checkout agent moves money — and every
            run is guardrail-checked and audited.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> All systems operational
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {agents.map((agent, i) => {
          const Icon = icons[i % icons.length] ?? Bot;
          const isMoney = agent.movesMoney;
          return (
            <Card key={agent.type} className="flex flex-col overflow-hidden">
              <div className={`h-1 w-full ${accent[agent.type] ?? "bg-slate-900"}`} />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant={isMoney ? "warning" : "success"} className="capitalize">
                    {isMoney ? "Moves money" : "Read-only"}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-[15px] font-semibold">{agent.name}</CardTitle>
                <CardDescription className="line-clamp-3 text-[13px]">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
                <span className="font-mono text-xs font-medium text-slate-600">{agent.type}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <Plug className="h-3 w-3" /> Tool-gated
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <CardHeader>
              <CardTitle className="text-sm">Run agents from the API</CardTitle>
              <CardDescription>
                POST to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">/api/agents</code>{" "}
                with a <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{`{ type, input }`}</code> body.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
{`curl -X POST http://localhost:3000/api/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "payment-link",
    "input": {
      "amountInPaise": 50000,
      "currency": "INR",
      "description": "Invoice #1042",
      "customer": { "name": "Ada", "email": "ada@example.com", "contact": "+919000000000" }
    }
  }'`}
              </pre>
              <Link href="/terminal" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#204CF5] hover:text-[#1a3fd6]">
                Open live terminal <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 p-6 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold tracking-wide text-slate-700">WHAT HAPPENS ON EACH RUN</p>
            <ol className="mt-3 space-y-3 text-sm">
              {[
                "Guardian checks spend cap, currency and action allowlist.",
                "Agent executes within bounded tools.",
                "Result is audited with reasoning and Razorpay refs.",
                "Replay from audit trail or terminal.",
              ].map((t, idx) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed text-slate-600">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
