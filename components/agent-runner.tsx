"use client";

import { useState } from "react";
import { Loader2, PlayCircle, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentRunResult } from "@/lib/agents";

type RunResult = AgentRunResult & { blockedReason?: string; error?: string };

const agentOptions = [
  { value: "payment-link", label: "Payment Link Agent" },
  { value: "payment-status", label: "Payment Status Agent" },
  { value: "refund", label: "Refund Agent" },
] as const;

export function AgentRunner() {
  const [agentType, setAgentType] = useState<string>("payment-link");
  const [amount, setAmount] = useState("500");
  const [description, setDescription] = useState("Agent-created payment link");
  const [customerName, setCustomerName] = useState("Test Customer");
  const [customerEmail, setCustomerEmail] = useState("customer@example.com");
  const [customerContact, setCustomerContact] = useState("+919000000000");
  const [paymentId, setPaymentId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const isMoneyMoving = agentType === "payment-link" || agentType === "refund";

  async function handleRun() {
    setRunning(true);
    setResult(null);

    let input: Record<string, unknown>;
    if (agentType === "payment-link") {
      input = {
        amountInPaise: Math.round(Number(amount) * 100),
        currency: "INR",
        description,
        customer: { name: customerName, email: customerEmail, contact: customerContact },
      };
    } else {
      input = {
        paymentId,
        ...(agentType === "refund" && amount
          ? { amountInPaise: Math.round(Number(amount) * 100), reason: "Agent-initiated refund" }
          : {}),
      };
    }

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: agentType, input }),
      });
      setResult((await res.json()) as RunResult);
    } catch (error) {
      setResult({
        requestId: "n/a",
        agentType: agentType as RunResult["agentType"],
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <AgentRunnerView
      agentType={agentType}
      setAgentType={setAgentType}
      amount={amount}
      setAmount={setAmount}
      description={description}
      setDescription={setDescription}
      customerName={customerName}
      setCustomerName={setCustomerName}
      customerEmail={customerEmail}
      setCustomerEmail={setCustomerEmail}
      customerContact={customerContact}
      setCustomerContact={setCustomerContact}
      paymentId={paymentId}
      setPaymentId={setPaymentId}
      running={running}
      result={result}
      isMoneyMoving={isMoneyMoving}
      onRun={handleRun}
    />
  );
}

type ViewProps = {
  agentType: string;
  setAgentType: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  customerContact: string;
  setCustomerContact: (v: string) => void;
  paymentId: string;
  setPaymentId: (v: string) => void;
  running: boolean;
  result: RunResult | null;
  isMoneyMoving: boolean;
  onRun: () => void;
};

function AgentRunnerView(props: ViewProps) {
  const {
    agentType, setAgentType, amount, setAmount, description, setDescription,
    customerName, setCustomerName, customerEmail, setCustomerEmail,
    customerContact, setCustomerContact, paymentId, setPaymentId,
    running, result, isMoneyMoving, onRun,
  } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" /> Run an Agent
        </CardTitle>
        <CardDescription>
          Every run passes guardrails (spend caps, allowlists) before touching Razorpay, and is
          written to the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-type">Agent</label>
            <select
              id="agent-type"
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {agentOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-zinc-900">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {agentType === "payment-link" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="amount">Amount (₹)</label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="payment-id">Razorpay Payment ID</label>
              <Input
                id="payment-id"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="pay_test_XXXXXXXX"
              />
            </div>
          )}

          {agentType === "payment-link" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="description">Description</label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cust-name">Customer Name</label>
                <Input id="cust-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cust-email">Customer Email</label>
                <Input
                  id="cust-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cust-contact">Customer Contact</label>
                <Input
                  id="cust-contact"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {isMoneyMoving && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Guardrails active: ₹1,000 per action, ₹5,000
            daily, INR-only, refunds allowlisted.
          </p>
        )}

        <Button onClick={onRun} disabled={running || (agentType !== "payment-link" && !paymentId)}>
          {running ? (
            <>
              <Loader2 className="animate-spin" /> Running…
            </>
          ) : (
            "Run Agent"
          )}
        </Button>

        {result && (
          <div
            className={cn(
              "rounded-lg border p-4 text-sm",
              result.status === "SUCCESS" && "border-success/40 bg-success/10",
              result.status === "BLOCKED" && "border-warning/40 bg-warning/10",
              result.status === "FAILED" && "border-destructive/40 bg-destructive/10"
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant={
                  result.status === "SUCCESS"
                    ? "success"
                    : result.status === "BLOCKED"
                      ? "warning"
                      : "destructive"
                }
              >
                {result.status}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                request: {result.requestId}
              </span>
            </div>
            {result.blockedReason && <p className="text-warning-foreground">{result.blockedReason}</p>}
            {result.error && <p className="text-destructive">{result.error}</p>}
            {result.output != null && (
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs scrollbar-thin">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

