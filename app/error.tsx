"use client";

import { useEffect } from "react";
import { toast } from "sonner";

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
    <div className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">!</div>
        <p className="mt-3 text-sm font-semibold text-slate-900">Something went wrong</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
