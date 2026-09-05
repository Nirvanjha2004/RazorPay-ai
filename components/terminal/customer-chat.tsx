"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee,
  Scale,
  Droplets,
  FlaskConical,
  Cog,
  Settings2,
  ShoppingBag,
  Package,
  Sparkles,
} from "lucide-react";

import type { FeedEntry } from "./types";

const QUICK_ACTIONS = [
  { label: "Buy coffee machine", text: "I want a coffee machine" },
  { label: "Accept upsell", text: "yes" },
  { label: "Reject upsell", text: "no" },
  { label: "Check status", text: "what is my order status?" },
];

interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  price_display: string;
  price_in_paise: number;
  availability: string;
  stock: number;
}

function iconFor(id: string) {
  if (id.includes("pitcher")) return Droplets;
  if (id.includes("scale")) return Scale;
  if (id.includes("french_press")) return Coffee;
  if (id.includes("aeropress")) return FlaskConical;
  if (id.includes("espresso")) return Cog;
  if (id.includes("grinder")) return Settings2;
  return Package;
}

interface Props {
  feed: FeedEntry[];
  busy: boolean;
  onSend: (text: string) => void;
  recoveryMessage?: string | null;
}

/** Left panel: the dashboard user plays the customer. */
export function CustomerChat({ feed, busy, onSend, recoveryMessage }: Props) {
  const [draft, setDraft] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const conversation = feed.filter((entry) => entry.agent === "CUSTOMER" || entry.agent === "SYSTEM");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = conversation.length === 0 && !recoveryMessage;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.length, recoveryMessage, products.length]);

  useEffect(() => {
    if (!isEmpty) return;
    fetch("/api/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { products?: CatalogProduct[] }) => setProducts(j.products ?? []))
      .catch(() => setProducts([]));
  }, [isEmpty]);

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

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-3 scrollbar-thin">
        {isEmpty ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pick a product to start</p>
                  <p className="text-xs text-slate-500">Click any card — it sends “I want the …” for you</p>
                </div>
                <span className="ml-auto hidden items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 md:inline-flex">
                  <Sparkles className="h-3 w-3 text-violet-500" /> Interactive
                </span>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="grid animate-pulse grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-xl border border-slate-200 bg-slate-50" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {products.map((p, idx) => {
                  const Icon = iconFor(p.id);
                  const low = p.availability === "low_stock";
                  const out = p.availability === "out_of_stock";
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.25 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => send(`I want the ${p.name}`)}
                      disabled={busy || out}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-md disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white group-hover:bg-violet-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-900">{p.name}</p>
                        <p className="mt-1 font-mono text-xs font-bold text-slate-700">{p.price_display}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${out ? "bg-red-50 text-red-700 ring-red-200" : low ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${out ? "bg-red-500" : low ? "bg-amber-500" : "bg-emerald-500"}`} />
                        {out ? "Out" : low ? `Low · ${p.stock}` : "In stock"}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            <p className="text-center text-xs text-slate-400">…or type a custom request below (e.g. “under ₹2,000”)</p>
          </div>
        ) : (
          conversation.map((entry) => {
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
          })
        )}

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
