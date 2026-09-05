/**
 * Razorpay client wrapper.
 *
 * A thin, typed facade over the official `razorpay` Node SDK. Everything the
 * agents do goes through this module so credentials are read in exactly one
 * place and test-mode usage is explicit.
 *
 * Docs: https://razorpay.com/docs/api/
 */

import crypto from "crypto";
import Razorpay from "razorpay";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
};

export type RazorpayPaymentLink = {
  id: string;
  short_url: string;
  amount: number;
  currency: string;
  status: string;
  reference_id?: string;
};

export type RazorpayPayment = {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string | null;
  email?: string;
  contact?: string;
  captured?: boolean;
};

export type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
};

let client: Razorpay | null = null;

/**
 * Extract a human-readable message from a Razorpay SDK error, which is
 * typically `{ error: { description, code } }` rather than a real Error.
 */
function extractRazorpayError(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { error?: { description?: string }; description?: string; message?: string };
    if (e.error?.description) return e.error.description;
    if (e.description) return e.description;
    if (e.message) return e.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function getRazorpayClient(): Razorpay {
  if (client) return client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env (test mode keys look like rzp_test_...)."
    );
  }

  client = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
    headers: {
      // Useful for tracing agent activity inside the Razorpay dashboard.
      "X-Razorpay-Account": "commerceagent",
    },
  });

  return client;
}

export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return false;
  // Placeholder test values in .env are "present" but not usable — treat the
  // integration as unconfigured so demos fall back to demo orders cleanly.
  const placeholderId = /x{2,}|your_|xxxx/i.test(keyId);
  const placeholderSecret = /your_|xxxx/i.test(keySecret);
  const looksReal = /^rzp_(test|live)_[0-9A-Za-z]{12,}$/.test(keyId);
  return looksReal && !placeholderId && !placeholderSecret;
}

export function getPublicKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

/**
 * Create a Razorpay order via the Orders API (test mode).
 *
 * @param amountInPaise positive integer in the smallest currency unit (paise)
 * @param notes         optional key-value metadata (propagated to Razorpay dashboard)
 * @param receipt       optional internal receipt reference
 */
export async function createOrder(
  amountInPaise: number,
  notes?: Record<string, string>,
  receipt?: string
): Promise<RazorpayOrder> {
  if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
    throw new Error(`createOrder: amount must be a positive integer in paise, got ${amountInPaise}`);
  }
  try {
    const order = await getRazorpayClient().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes,
    });
    return order as unknown as RazorpayOrder;
  } catch (error) {
    throw new Error(`Razorpay Orders API failed: ${extractRazorpayError(error)}`);
  }
}

/**
 * Create a standalone payment link that can be sent to a customer
 * (used by the Payment Link agent).
 */
export async function createStandalonePaymentLink(params: {
  amountInPaise: number;
  currency?: string;
  description: string;
  customer: { name: string; email: string; contact: string };
  referenceId?: string;
}): Promise<RazorpayPaymentLink> {
  const link = await getRazorpayClient().paymentLink.create({
    amount: params.amountInPaise,
    currency: params.currency ?? "INR",
    accept_partial: false,
    description: params.description,
    reference_id: params.referenceId,
    customer: params.customer,
    notify: { sms: true, email: true },
    reminder_enable: true,
  });
  return link as unknown as RazorpayPaymentLink;
}

/** Fetch a payment's current status. */
export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const payment = await getRazorpayClient().payments.fetch(paymentId);
  return payment as unknown as RazorpayPayment;
}

/** Refund a captured payment (full or partial). */
export async function refundPayment(params: {
  paymentId: string;
  amountInPaise?: number;
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
}): Promise<RazorpayRefund> {
  const refund = await getRazorpayClient().payments.refund(params.paymentId, {
    amount: params.amountInPaise,
    speed: params.speed ?? "normal",
    notes: params.notes,
  });
  return refund as unknown as RazorpayRefund;
}

/**
 * Create a payment link as a FALLBACK for an existing Razorpay order —
 * used when the standard checkout flow cannot complete (e.g. the customer
 * cannot use the checkout, or a link needs to be re-sent).
 *
 * Fetches the order from Razorpay to get the exact amount, so no amount
 * can be tampered with by the caller.
 *
 * @param orderId a Razorpay order id (`order_...`)
 */
export async function createPaymentLink(orderId: string): Promise<RazorpayPaymentLink> {
  if (!orderId.startsWith("order_")) {
    throw new Error(`createPaymentLink: expected a Razorpay order id (order_...), got "${orderId}"`);
  }
  try {
    const client = getRazorpayClient();
    const order = (await client.orders.fetch(orderId)) as unknown as RazorpayOrder;
    if (!order?.amount) {
      throw new Error(`Order ${orderId} not found on Razorpay`);
    }
    // The Razorpay API accepts links without a customer, but the SDK's TS
    // types require it — the payload is cast since no customer is known here.
    const payload = {
      amount: order.amount,
      currency: order.currency ?? "INR",
      accept_partial: false,
      reference_id: orderId,
      description: `Complete payment for order ${orderId}`,
      notify: { sms: false, email: true },
      reminder_enable: true,
    };
    const link = await client.paymentLink.create(
      payload as unknown as Parameters<typeof client.paymentLink.create>[0]
    );
    return link as unknown as RazorpayPaymentLink;
  } catch (error) {
    throw new Error(`Razorpay payment-link fallback for ${orderId} failed: ${extractRazorpayError(error)}`);
  }
}

/**
 * Create a payment link for a raw amount — used by the conversational
 * checkout as a last-resort fallback when no Razorpay order exists
 * (e.g. the Orders API itself is failing).
 */
export async function createPaymentLinkForAmount(
  amountInPaise: number,
  description: string
): Promise<RazorpayPaymentLink> {
  if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
    throw new Error(`createPaymentLinkForAmount: invalid amount ${amountInPaise}`);
  }
  try {
    const client = getRazorpayClient();
    const payload = {
      amount: amountInPaise,
      currency: "INR",
      accept_partial: false,
      description,
      notify: { sms: false, email: true },
      reminder_enable: true,
    };
    // Razorpay API accepts links without a customer; SDK types require one.
    const link = await client.paymentLink.create(
      payload as unknown as Parameters<typeof client.paymentLink.create>[0]
    );
    return link as unknown as RazorpayPaymentLink;
  } catch (error) {
    throw new Error(`Razorpay payment link creation failed: ${extractRazorpayError(error)}`);
  }
}

/**
 * Verify a Razorpay webhook signature.
 *
 * Razorpay signs every webhook payload with HMAC-SHA256 using your webhook
 * secret; the signature arrives in the `x-razorpay-signature` header.
 * Comparison is timing-safe and requires the RAW request body.
 *
 * @param rawBody   the exact, unparsed request body string
 * @param signature the value of the x-razorpay-signature header
 * @throws if RAZORPAY_WEBHOOK_SECRET is not configured
 */
export function verifyPaymentSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured — cannot verify webhooks");
  }
  if (!signature || !rawBody) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signature, "utf8");
  return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
