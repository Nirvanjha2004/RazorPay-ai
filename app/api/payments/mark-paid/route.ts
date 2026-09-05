import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/mark-paid
 * Demo fallback — marks an order as PAID directly (when webhook via ngrok is flaky).
 * Body: { orderId: string, paymentId?: string }
 */
export async function POST(request: Request) {
  let body: { orderId?: string; paymentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orderId = body.orderId?.trim();
  if (!orderId || !orderId.startsWith("order_")) {
    return NextResponse.json({ error: "orderId (order_...) required" }, { status: 400 });
  }

  try {
    const order = await prisma.order.update({
      where: { razorpayOrderId: orderId },
      data: {
        status: "PAID",
        razorpayPaymentId: body.paymentId ?? undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        agentType: "webhook",
        action: "payment.captured",
        status: "SUCCESS",
        input: JSON.stringify({ source: "mark-paid fallback", orderId, paymentId: body.paymentId }),
        output: JSON.stringify({ new_status: "PAID", fallback: true }),
        amountInPaise: order.amountInPaise,
        currency: order.currency,
        razorpayOrderId: orderId,
        razorpayPaymentId: body.paymentId ?? null,
      },
    });

    return NextResponse.json({ ok: true, orderId, status: "PAID" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
