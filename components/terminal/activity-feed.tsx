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
    <section className="flex h-full flex-col bg-[#050507]">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2 text-xs tracking-widest text-zinc-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          LIVE AGENT ACTIVITY
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-zinc-500">PHASE</span>
          <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300">
            {phase}
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {feed.length === 0 && (
          <p className="mt-10 text-center text-xs text-zinc-600">
            Waiting for activity… talk to the shop on the left.
          </p>
        )}
        <AnimatePresence initial={false}>
          {feed.map((entry) => {
            const style = AGENT_STYLES[entry.agent] ?? AGENT_STYLES.SYSTEM;
            const chip = entry.status ? statusChip(entry.status) : null;
            return (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="rounded-md border border-zinc-800/80 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${style.avatar}`}
                  >
                    {style.initials}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                    {style.label}
                  </span>
                  {chip && (
                    <span className={`text-[10px] font-semibold ${chip.cls}`}>
                      {chip.icon} {entry.status}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-zinc-600">
                    {timeOf(entry.at)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words pl-8 text-xs leading-relaxed text-zinc-300">
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
