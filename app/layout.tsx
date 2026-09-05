import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen">
        <Sidebar />
        {/* Pages manage their own layout — the terminal needs full bleed. */}
        <main className="h-screen overflow-hidden pl-60">{children}</main>
      </body>
    </html>
  );
}
