import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/razorpay — receive and verify Razorpay webhooks.
 *
 * The signature is an HMAC-SHA256 of the raw request body using
 * RAZORPAY_WEBHOOK_SECRET. We must read the *raw* body to verify it, so no
 * `request.json()` before verification.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const valid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!valid) {
    await prisma.auditLog.create({
      data: {
        agentType: "webhook",
        action: "razorpay_webhook",
        status: "FAILED",
        error: "Invalid webhook signature",
        input: rawBody.slice(0, 2000),
      },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number; currency?: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;

  await prisma.auditLog.create({
    data: {
      agentType: "webhook",
      action: event.event ?? "unknown_event",
      status: "SUCCESS",
      input: rawBody.slice(0, 2000),
      output: JSON.stringify({ handled: event.event }),
      amountInPaise: payment?.amount ?? refund?.amount ?? null,
      currency: payment?.currency ?? refund?.currency ?? null,
      razorpayOrderId: payment?.order_id ?? null,
      razorpayPaymentId: payment?.id ?? refund?.payment_id ?? null,
      razorpayRefundId: refund?.id ?? null,
    },
  });

  return NextResponse.json({ received: true });
}
