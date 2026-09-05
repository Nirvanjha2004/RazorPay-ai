"use client";

import { useState } from "react";

import type { FeedEntry } from "./types";

const QUICK_ACTIONS = [
  { label: "Buy coffee machine", text: "I want a coffee machine" },
  { label: "Accept upsell", text: "yes" },
  { label: "Reject upsell", text: "no" },
  { label: "Check status", text: "what is my order status?" },
];

interface Props {
  feed: FeedEntry[];
  busy: boolean;
  onSend: (text: string) => void;
}

/** Left panel: the dashboard user plays the customer. */
export function CustomerChat({ feed, busy, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const conversation = feed.filter((entry) => entry.agent === "CUSTOMER" || entry.agent === "SYSTEM");

  function send(text: string) {
    if (!text.trim() || busy) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="text-xs tracking-widest text-zinc-400">CUSTOMER SIMULATOR</div>
        <span className="text-[10px] text-zinc-600">you are the buyer</span>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {conversation.length === 0 && (
          <p className="mt-6 text-center text-xs text-zinc-600">
            Say something like &quot;I want a coffee machine&quot;.
          </p>
        )}
        {conversation.map((entry) => {
          const isCustomer = entry.agent === "CUSTOMER";
          return (
            <div key={entry.id} className={isCustomer ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[95%] rounded-md px-2.5 py-1.5 text-left text-[11px] leading-relaxed ${
                  isCustomer
                    ? "bg-violet-500/15 text-violet-200"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-300"
                }`}
              >
                {entry.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 px-3 py-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => send(action.text)}
            disabled={busy}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        className="flex gap-2 border-t border-zinc-800 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type as the customer…"
          disabled={busy}
          className="h-8 flex-1 rounded border border-input bg-transparent px-2 font-mono text-[11px] placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="h-8 rounded border border-emerald-500/50 bg-emerald-500/15 px-3 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          SEND
        </button>
      </form>
    </section>
  );
}
