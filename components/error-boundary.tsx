"use client";

import { Component, type ReactNode } from "react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Client-side error boundary for dashboard panels / modals. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
    toast.error("A panel crashed", {
      description: error instanceof Error ? error.message : String(error),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-full place-items-center bg-[#050507] p-8 text-center font-mono">
          <div>
            <p className="text-lg font-bold text-red-400">PANEL FAULT</p>
            <p className="mt-2 text-sm text-zinc-400">
              A section failed to render. The error was recorded — reload to recover.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 rounded border border-zinc-700 px-4 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}