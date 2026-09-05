/**
 * Agent executor: the single choke point every agent run passes through.
 *
 * Pipeline for each run:
 *   1. Pre-flight guardrails (spend caps, allowlists)        -> BLOCKED + audited
 *   2. Agent-specific business logic against Razorpay        -> audited
 *   3. Outcome persisted to the AuditLog table               -> always
 */

import { prisma } from "@/lib/db";
import { assertAllowedToAct, GuardrailViolation } from "@/lib/guardrails";
import type { AgentStatus, AgentType } from "@/lib/agents/types";

export interface AgentMetadata {
  type: AgentType;
  name: string;
  description: string;
  movesMoney: boolean;
}

export interface AgentRunInput<TInput, TOutput = unknown> {
  agent: AgentMetadata;
  action: string;
  input: TInput;
  /** Extract guardrail-relevant facts from the typed input. */
  guardrails: {
    amountInPaise?: number;
    currency?: string;
    paymentId?: string;
  };
  /** The actual Razorpay work. Only called if guardrails pass. */
  execute: () => Promise<{
    output: TOutput;
    amountInPaise?: number;
    currency?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpayRefundId?: string;
  }>;
}

export interface AgentRunResult<TOutput = unknown> {
  requestId: string;
  agentType: AgentType;
  status: AgentStatus;
  output?: TOutput;
  error?: string;
  blockedReason?: string;
}

function validateInput(input: unknown): void {
  if (input == null || typeof input !== "object") {
    throw new GuardrailViolation("input_validation", "Agent input must be a JSON object");
  }
}

export async function executeAgent<TInput, TOutput = unknown>(
  run: AgentRunInput<TInput, TOutput>
): Promise<AgentRunResult<TOutput>> {
  const requestId = crypto.randomUUID();
  const inputJson = JSON.stringify(run.input ?? {});

  const auditBase = {
    agentType: run.agent.type,
    action: run.action,
    input: inputJson,
    requestId,
  };

  try {
    validateInput(run.input);

    // 1. Guardrails --------------------------------------------------------
    try {
      await assertAllowedToAct({
        action: run.action,
        amountInPaise: run.guardrails.amountInPaise,
        currency: run.guardrails.currency,
        paymentId: run.guardrails.paymentId,
      });
    } catch (error) {
      const reason =
        error instanceof GuardrailViolation
          ? `[${error.rule}] ${error.message}`
          : String(error);
      await prisma.auditLog.create({
        data: {
          ...auditBase,
          status: "BLOCKED",
          blockedReason: reason,
          amountInPaise: run.guardrails.amountInPaise ?? null,
          currency: run.guardrails.currency ?? null,
        },
      });
      return { requestId, agentType: run.agent.type, status: "BLOCKED", blockedReason: reason };
    }

    // 2. Execute the Razorpay work ----------------------------------------
    try {
      const result = await run.execute();

      await prisma.auditLog.create({
        data: {
          ...auditBase,
          status: "SUCCESS",
          output: JSON.stringify(result.output),
          amountInPaise: result.amountInPaise ?? run.guardrails.amountInPaise ?? null,
          currency: result.currency ?? run.guardrails.currency ?? null,
          razorpayOrderId: result.razorpayOrderId ?? null,
          razorpayPaymentId: result.razorpayPaymentId ?? null,
          razorpayRefundId: result.razorpayRefundId ?? null,
        },
      });

      return {
        requestId,
        agentType: run.agent.type,
        status: "SUCCESS",
        output: result.output,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.auditLog.create({
        data: {
          ...auditBase,
          status: "FAILED",
          error: message,
          amountInPaise: run.guardrails.amountInPaise ?? null,
          currency: run.guardrails.currency ?? null,
        },
      });
      return { requestId, agentType: run.agent.type, status: "FAILED", error: message };
    }
  } catch (error) {
    // Safety net: never let the executor itself throw without an audit record.
    const message = error instanceof Error ? error.message : String(error);
    await prisma.auditLog
      .create({
        data: { ...auditBase, status: "FAILED", error: `executor: ${message}` },
      })
      .catch(() => undefined);
    return { requestId, agentType: run.agent.type, status: "FAILED", error: message };
  }
}
