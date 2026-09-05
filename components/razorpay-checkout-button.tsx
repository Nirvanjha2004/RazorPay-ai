"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface Props {
  orderId: string;
  amountPaise?: number | null;
  sessionId?: string;
}

export function RazorpayCheckoutButton({ orderId, amountPaise, sessionId }: Props) {
  const [keyId, setKeyId] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    fetch("/api/razorpay/key")
      .then((r) => r.json())
      .then((j: { keyId: string | null }) => setKeyId(j.keyId))
      .catch(() => setKeyId(null))
      .finally(() => setLoadingKey(false));
  }, []);

  useEffect(() => {
    // Load checkout.js once
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const pay = async () => {
    if (!keyId || !orderId) {
      toast.error("Razorpay not configured — check RAZORPAY_KEY_ID");
      return;
    }
    if (!window.Razorpay) {
      toast.error("Checkout.js not loaded yet — try again in 1s");
      return;
    }
    setOpening(true);
    try {
      const options = {
        key: keyId,
        amount: amountPaise ?? undefined, // Razorpay uses order amount, but keep for display
        currency: "INR",
        name: "CommerceAgent",
        description: `Order ${orderId}`,
        order_id: orderId,
        handler: function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
          toast.success(`Payment captured: ${response.razorpay_payment_id}`, {
            description: "Webhook will mark order as PAID — check Audit trail in ~2s",
          });
          // Optimistically nudge user to check status
          if (sessionId) {
            fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, message: "what is my order status?" }),
            }).catch(() => undefined);
          }
        },
        prefill: {
          name: "Test User",
          email: "test@razorpay.test",
          contact: "9999999999",
        },
        theme: { color: "#204CF5" },
        modal: {
          ondismiss: () => setOpening(false),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } finally {
      setTimeout(() => setOpening(false), 2000);
    }
  };

  if (loadingKey) {
    return (
      <button disabled className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading checkout…
      </button>
    );
  }

  if (!keyId) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Razorpay key not configured — set RAZORPAY_KEY_ID in .env to enable Checkout
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={pay}
        disabled={opening}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#204CF5] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1a3fd6] disabled:opacity-50"
      >
        {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {opening ? "Opening Razorpay…" : `Pay ${amountPaise ? `₹${(amountPaise / 100).toFixed(2)}` : ""} with Razorpay`}
      </button>
      <p className="flex items-center gap-1 text-xs text-slate-500">
        Test card: 4111 1111 1111 1111 · Exp any future · CVV any · OTP 1234 <ExternalLink className="h-3 w-3" />
      </p>
    </div>
  );
}
