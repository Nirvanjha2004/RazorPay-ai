import { NextResponse } from "next/server";
import { getPublicKeyId, isRazorpayConfigured } from "@/lib/razorpay/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    keyId: getPublicKeyId(),
    configured: isRazorpayConfigured(),
  });
}
