import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CommerceAgent — Razorpay Operations",
  description:
    "Autonomous commerce agents for Razorpay with guardrails and a full audit trail.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#F9F8F6] text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
        <Toaster theme="light" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
