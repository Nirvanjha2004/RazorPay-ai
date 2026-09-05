import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPaymentSignature } from "@/lib/razorpay/client";

export const dynamic = "force-dynamic";

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        method?: string;
        error_description?: string;
      };
    };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
  };
};

/** Map Razorpay events to local Order statuses. */
const ORDER_STATUS_BY_EVENT: Record<string, string> = {
  "payment.captured": "PAID",
  "order.paid": "PAID",
  "payment.failed": "FAILED",
};

/**
 * POST /api/webhooks/razorpay
 *
 * 1. Verifies the HMAC-SHA256 signature against the RAW body (rejects fakes).
 * 2. Updates the local Order status (CREATED -> PAID | FAILED).
 * 3. Writes every event to the audit trail.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  // 1. Signature verification ------------------------------------------------
  let verified: boolean;
  try {
    verified = verifyPaymentSignature(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhook] verification config error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!verified) {
    await prisma.auditLog
      .create({
        data: {
          agentType: "webhook",
          action: "razorpay_webhook",
          status: "FAILED",
          error: "Invalid webhook signature — payload rejected",
          input: rawBody.slice(0, 2000),
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 2. Parse the (now trusted) payload ---------------------------------------
  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    // Signature was valid but body is malformed — nothing sane to persist.
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventName = event.event ?? "unknown_event";
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;

  try {
    // 3. Update the order status when the event maps to one ------------------
    let orderUpdated = false;
    const nextStatus = ORDER_STATUS_BY_EVENT[eventName];
    const razorpayOrderId = payment?.order_id ?? null;

    if (nextStatus && razorpayOrderId) {
      const result = await prisma.order.updateMany({
        where: { razorpayOrderId },
        data: {
          status: nextStatus,
          razorpayPaymentId: payment?.id ?? undefined,
        },
      });
      orderUpdated = result.count > 0;
      if (!orderUpdated) {
        console.warn(`[webhook] ${eventName}: no local order for ${razorpayOrderId}`);
      }
    }

    // 4. Audit trail ----------------------------------------------------------
    await prisma.auditLog.create({
      data: {
        agentType: "webhook",
        action: eventName,
        status: "SUCCESS",
        input: rawBody.slice(0, 2000),
        output: JSON.stringify({
          verified: true,
          order_status_updated: orderUpdated,
          ...(razorpayOrderId && nextStatus ? { new_status: nextStatus } : {}),
        }),
        amountInPaise: payment?.amount ?? refund?.amount ?? null,
        currency: payment?.currency ?? null,
        razorpayOrderId,
        razorpayPaymentId: payment?.id ?? refund?.payment_id ?? null,
        razorpayRefundId: refund?.id ?? null,
      },
    });

    // Always 200 for verified events so Razorpay stops retrying.
    return NextResponse.json({ received: true, verified: true, order_updated: orderUpdated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhook] handler error:", message);
    // Non-200 makes Razorpay retry the delivery later.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

