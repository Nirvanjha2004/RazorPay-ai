"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AGENT_STYLES, statusChip, type FeedEntry } from "./types";

function timeOf(at: string): string {
  const d = new Date(at);
  return isNaN(d.getTime()) ? "--:--:--" : d.toLocaleTimeString("en-GB");
}

/** Center panel: animated agent/customer flow. */
export function ActivityFeed({ feed, phase }: { feed: FeedEntry[]; phase: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [feed.length]);

  return (
    <section className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold tracking-wide text-slate-700">Live agent activity</span>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          Phase · <span className="text-[#204CF5]">{phase}</span>
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-white p-4 scrollbar-thin">
        {feed.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <p className="text-sm font-medium text-slate-700">Waiting for activity</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Talk to the shop on the left — the agents will respond in real time.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {feed.map((entry) => {
            const style = AGENT_STYLES[entry.agent] ?? AGENT_STYLES.SYSTEM;
            const chip = entry.status ? statusChip(entry.status) : null;
            return (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${style.avatar.replace("border","").replace("bg-","bg-")}`}
                    style={{ background: style.avatar.includes("violet") ? "#7C3AED" : style.avatar.includes("emerald") ? "#059669" : style.avatar.includes("sky") ? "#0284C7" : "#334155" }}
                  >
                    {style.initials}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${style.badge.replace("border","ring").replace("bg-","bg-")}`}>
                    {style.label}
                  </span>
                  {chip && (
                    <span className={`rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold ring-1 ring-slate-200 ${chip.cls}`}>
                      {entry.status}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-slate-400">
                    {timeOf(entry.at)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words pl-9 text-sm leading-relaxed text-slate-700">
                  {entry.text}
                </p>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
