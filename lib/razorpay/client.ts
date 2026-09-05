/**
 * Razorpay client wrapper.
 *
 * A thin, typed facade over the official `razorpay` Node SDK. Everything the
 * agents do goes through this module so credentials are read in exactly one
 * place and test-mode usage is explicit.
 *
 * Docs: https://razorpay.com/docs/api/
 */

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
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getPublicKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

/** Create a standard Razorpay order. */
export async function createOrder(params: {
  amountInPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const order = await getRazorpayClient().orders.create({
    amount: params.amountInPaise,
    currency: params.currency ?? "INR",
    receipt: params.receipt,
    notes: params.notes,
  });
  return order as unknown as RazorpayOrder;
}

/** Create a payment link that can be sent to a customer. */
export async function createPaymentLink(params: {
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
