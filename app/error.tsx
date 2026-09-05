"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * App-router error boundary (catches render/load errors in any page segment).
 * Every failure also surfaces as a sonner toast.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app.error]", error);
    toast.error("Something went wrong", {
      description: error.message || "Unknown error",
    });
  }, [error]);

  return (
    <div className="grid h-full place-items-center bg-[#050507] p-8 font-mono text-center">
      <div>
        <p className="text-lg font-bold text-red-400">SYSTEM FAULT</p>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25"
        >
          ↻ RETRY
        </button>
      </div>
    </div>
  );
}