"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  recoveryMessage?: string | null;
}

/** Left panel: the dashboard user plays the customer. */
export function CustomerChat({ feed, busy, onSend, recoveryMessage }: Props) {
  const [draft, setDraft] = useState("");
  const conversation = feed.filter((entry) => entry.agent === "CUSTOMER" || entry.agent === "SYSTEM");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.length, recoveryMessage]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-slate-700">Customer simulator</p>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          You are the buyer
        </span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-white p-3 scrollbar-thin">
        {conversation.length === 0 && !recoveryMessage && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">Start a conversation</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Try &ldquo;I want a coffee machine&rdquo; to trigger the agent flow.
            </p>
          </div>
        )}
        {conversation.map((entry) => {
          const isCustomer = entry.agent === "CUSTOMER";
          return (
            <div key={entry.id} className={isCustomer ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isCustomer
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {entry.text}
              </div>
            </div>
          );
        })}

        <AnimatePresence>
          {recoveryMessage && (
            <motion.div
              key="recovery-msg"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex justify-start"
            >
              <div className="max-w-[90%] rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm leading-relaxed text-emerald-900 shadow-sm">
                <p className="text-xs font-semibold text-emerald-700">Agent → Customer (graceful fallback)</p>
                <p className="mt-1">{recoveryMessage}</p>
                <p className="mt-1 text-xs text-emerald-700/70">via secure payment link · no retry prompt fatigue</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-3 py-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => send(action.text)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        className="flex gap-2 border-t border-slate-100 bg-slate-50/50 p-3"
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
          className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-[#204CF5]/30 focus:outline-none focus:ring-2 focus:ring-[#204CF5]/15"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="h-9 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}
