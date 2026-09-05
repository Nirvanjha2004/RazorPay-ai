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
  Bug,
} from "lucide-react";

import type { FeedEntry } from "./types";
import { formatINR } from "@/lib/utils";

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

function truncateOrderIds(text: string): string {
  return text.replace(/order_[A-Za-z0-9]+/g, (m) => `•••${m.slice(-4)}`);
}

function shortId(id: string): string {
  return `•••${id.slice(-4)}`;
}

interface Props {
  feed: FeedEntry[];
  busy: boolean;
  onSend: (text: string) => void;
  recoveryMessage?: string | null;
  orderId?: string | null;
  orderStatus?: string | null;
  cart?: { productId: string; name: string; priceInPaise: number; quantity: number }[];
  amountPaise?: number | null;
  onInjectFailure?: () => void;
  recoveryActive?: boolean;
  sessionPhase?: string;
}

/** Left panel: the dashboard user plays the customer. */
export function CustomerChat({
  feed,
  busy,
  onSend,
  recoveryMessage,
  orderId,
  orderStatus,
  cart,
  amountPaise,
  onInjectFailure,
  recoveryActive,
  sessionPhase,
}: Props) {
  const [draft, setDraft] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const conversation = feed.filter((entry) => entry.agent === "CUSTOMER" || entry.agent === "SYSTEM");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = conversation.length === 0 && !recoveryMessage;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.length, recoveryMessage, products.length, orderId, orderStatus]);

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

  const showOrderCard = !!orderId;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="text-[13px] font-semibold text-slate-900">Customer</p>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">You</span>
          {onInjectFailure && (
            <button
              onClick={onInjectFailure}
              disabled={busy || recoveryActive}
              title="Inject payment failure — cinematic recovery demo"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-red-600 disabled:opacity-40"
            >
              <Bug className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Compact order summary — lives here only per spec */}
      {showOrderCard && (
        <div className="mx-3 mb-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Order {orderId ? shortId(orderId) : "—"}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${
                orderStatus === "PAID"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : orderStatus === "FAILED"
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-white text-slate-600 ring-slate-200"
              }`}
            >
              {orderStatus ?? sessionPhase ?? "CREATED"}
            </span>
          </div>
          {cart && cart.length > 0 && (
            <ul className="mt-2 space-y-1">
              {cart.map((it) => (
                <li key={it.productId} className="flex items-center justify-between text-xs">
                  <span className="truncate text-slate-600">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="font-mono font-medium text-slate-900">{formatINR(it.priceInPaise)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-xs text-slate-500">Total</span>
            <span className="font-mono text-sm font-bold text-slate-900">{amountPaise != null ? formatINR(amountPaise) : "—"}</span>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 scrollbar-thin">
        {isEmpty ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShoppingBag className="h-4 w-4 text-slate-600" /> Pick a product
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">Click to send</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Tap any card — we’ll send “I want the …” for you.</p>
            </div>

            {products.length === 0 ? (
              <div className="grid animate-pulse grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[96px] rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {products.map((p, idx) => {
                  const Icon = iconFor(p.id);
                  const out = p.availability === "out_of_stock";
                  const low = p.availability === "low_stock";
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.22 }}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => send(`I want the ${p.name}`)}
                      disabled={busy || out}
                      className="flex flex-col gap-2 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 disabled:opacity-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-900">{p.name}</p>
                        <p className="mt-1 font-mono text-xs font-semibold text-slate-700">{p.price_display}</p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${out ? "bg-slate-100 text-slate-500" : low ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
                        {out ? "Out" : low ? "Low" : "In stock"}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
            <p className="text-center text-xs text-slate-400">or type a custom request below</p>
          </div>
        ) : (
          conversation.map((entry) => {
            const isCustomer = entry.agent === "CUSTOMER";
            const text = truncateOrderIds(entry.text);
            return (
              <div key={entry.id} className={isCustomer ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    isCustomer ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {text}
                </div>
              </div>
            );
          })
        )}

        <AnimatePresence>
          {recoveryMessage && (
            <motion.div
              key="recovery-msg"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex justify-start"
            >
              <div className="max-w-[92%] rounded-2xl bg-slate-900 px-3 py-2.5 text-[13px] leading-relaxed text-white">
                <p className="text-xs font-medium text-slate-300">Secure fallback</p>
                <p className="mt-1">{recoveryMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => send(action.text)}
            disabled={busy}
            className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-white disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        className="flex gap-2 border-t border-slate-100 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask for a product…"
          disabled={busy}
          className="h-9 flex-1 rounded-xl bg-slate-50 px-3 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="h-9 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
