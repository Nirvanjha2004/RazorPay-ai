import { Bot, Coins, Eye, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agents } from "@/lib/agents";

export const metadata = { title: "Agents — CommerceAgent" };

const icons = [Coins, ShieldCheck, Eye];

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Registered autonomous agents. All money-moving runs are guardrail-checked and audited.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {agents.map((agent, i) => {
          const Icon = icons[i % icons.length] ?? Bot;
          return (
            <Card key={agent.type} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" /> {agent.name}
                </CardTitle>
                <CardDescription>{agent.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {agent.type}
                </Badge>
                <Badge variant={agent.movesMoney ? "warning" : "success"}>
                  {agent.movesMoney ? "moves money" : "read-only"}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run agents from the API</CardTitle>
          <CardDescription>
            POST to <code className="font-mono text-xs">/api/agents</code> with a{" "}
            <code className="font-mono text-xs">{`{ type, input }`}</code> body, or use the runner on
            the Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-zinc-950 p-4 font-mono text-xs scrollbar-thin">
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
        </CardContent>
      </Card>
    </div>
  );
}
