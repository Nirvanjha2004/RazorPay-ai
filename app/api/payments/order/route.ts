import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/razorpay/client";
import { assertAllowedToAct, GuardrailViolation } from "@/lib/guardrails";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/order — create a Razorpay order (guardrail-protected).
 * Body: { amountInPaise: number, receipt?: string, notes?: Record<string,string> }
 */
export async function POST(request: NextRequest) {
  let body: { amountInPaise?: number; currency?: string; receipt?: string; notes?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { currency = "INR", receipt, notes } = body ?? {};
  const amountInPaise = body?.amountInPaise;
  if (typeof amountInPaise !== "number" || !Number.isInteger(amountInPaise) || amountInPaise <= 0) {
    return NextResponse.json(
      { error: "`amountInPaise` must be a positive integer (smallest currency unit)" },
      { status: 400 }
    );
  }

  const requestId = crypto.randomUUID();
  try {
    await assertAllowedToAct({ action: "create_order", amountInPaise, currency });

    const order = await createOrder({ amountInPaise, currency, receipt, notes });

    await prisma.auditLog.create({
      data: {
        agentType: "manual",
        action: "create_order",
        status: "SUCCESS",
        input: JSON.stringify(body),
        output: JSON.stringify({ orderId: order.id }),
        amountInPaise: order.amount,
        currency: order.currency,
        razorpayOrderId: order.id,
        requestId,
      },
    });

    return NextResponse.json({ requestId, order }, { status: 201 });
  } catch (error) {
    if (error instanceof GuardrailViolation) {
      await prisma.auditLog
        .create({
          data: {
            agentType: "manual",
            action: "create_order",
            status: "BLOCKED",
            blockedReason: `[${error.rule}] ${error.message}`,
            input: JSON.stringify(body),
            amountInPaise,
            currency,
            requestId,
          },
        })
        .catch(() => undefined);
      return NextResponse.json(
        { requestId, status: "BLOCKED", blockedReason: `[${error.rule}] ${error.message}` },
        { status: 403 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    await prisma.auditLog
      .create({
        data: {
          agentType: "manual",
          action: "create_order",
          status: "FAILED",
          error: message,
          input: JSON.stringify(body),
          amountInPaise,
          currency,
          requestId,
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ requestId, status: "FAILED", error: message }, { status: 502 });
  }
}
