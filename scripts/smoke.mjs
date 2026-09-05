/**
 * Smoke-test helper for the order/webhook flow.
 *   node scripts/smoke.mjs seed   -> creates a local order row for webhook testing
 *   node scripts/smoke.mjs check  -> prints the order's current status
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const mode = process.argv[2] ?? "check";
const RZP_ORDER_ID = "order_test_smoke123";

if (mode === "seed") {
  const order = await prisma.order.upsert({
    where: { razorpayOrderId: RZP_ORDER_ID },
    update: { status: "CREATED", razorpayPaymentId: null },
    create: {
      razorpayOrderId: RZP_ORDER_ID,
      amountInPaise: 2499900,
      currency: "INR",
      receipt: "smoke-test",
      status: "CREATED",
    },
  });
  console.log("ORDER SEEDED:", order.razorpayOrderId, order.status);
} else {
  const order = await prisma.order.findUnique({ where: { razorpayOrderId: RZP_ORDER_ID } });
  if (!order) {
    console.log("ORDER NOT FOUND");
  } else {
    console.log(
      "ORDER STATUS AFTER WEBHOOK:",
      order.status,
      "| paymentId:",
      order.razorpayPaymentId ?? "-"
    );
  }
}

await prisma.$disconnect();
