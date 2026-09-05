import type { Metadata } from "next";
import { Toaster } from "sonner";
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#F9F8F6] text-slate-900 antialiased">
        <Sidebar />
        <div className="pl-[268px]">
          {/* Top bar — breadcrumbs + actions */}
          <div className="sticky top-0 z-20 flex h-[56px] items-center justify-between border-b border-slate-200/70 bg-white/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden items-center gap-1.5 text-slate-400 md:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Test mode
              </span>
              <span className="hidden h-4 w-px bg-slate-200 md:block" />
              <span className="text-slate-500">
                Operations / <span className="font-medium text-slate-900">Overview</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 md:inline-flex">
                No real money moves
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                AK
              </div>
            </div>
          </div>
          <main className="min-h-[calc(100vh-56px)] bg-[#F9F8F6]">{children}</main>
        </div>
        <Toaster theme="light" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
