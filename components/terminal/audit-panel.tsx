"use client";

import { Fragment, useState } from "react";
import { motion } from "framer-motion";

import { AGENT_STYLES, statusChip, type AuditLogRow, type FeedAgent } from "./types";
import { formatINR, formatDateTime } from "@/lib/utils";

/** Right panel: every money action with expandable reasoning rows. */
export function AuditPanel({ logs }: { logs: AuditLogRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="text-xs tracking-widest text-zinc-400">AUDIT TRAIL — MONEY ACTIONS</div>
        <div className="text-[10px] text-zinc-600">{logs.length} records</div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {logs.length === 0 ? (
          <p className="mt-8 text-center text-xs text-zinc-600">No money actions yet.</p>
        ) : (
          <table className="w-full text-left text-[11px]">
            <tbody>
              {logs.map((log) => {
                const chip = statusChip(log.status);
                const expanded = expandedId === log.id;
                const agentStyle = AGENT_STYLES[log.agentType as FeedAgent] ?? AGENT_STYLES.SYSTEM;
                return (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                      className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/50"
                    >
                      <td className="whitespace-nowrap py-1.5 pl-3 pr-2 font-mono text-[10px] text-zinc-500">
                        {formatDateTime(log.createdAt).split(", ")[1]}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className={`rounded border px-1 py-0.5 text-[9px] font-bold ${agentStyle.badge}`}>
                          {log.agentType}
                        </span>
                      </td>
                      <td className="max-w-24 truncate py-1.5 pr-2 font-mono text-zinc-300" title={log.action}>
                        {log.action}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-right font-mono text-zinc-400">
                        {log.amountInPaise != null ? formatINR(log.amountInPaise) : "—"}
                      </td>
                      <td className={`whitespace-nowrap py-1.5 pr-3 font-semibold ${chip.cls}`}>
                        {chip.icon} {log.status}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-zinc-900 bg-zinc-950">
                        <td colSpan={5} className="px-3 py-2">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-1 font-mono text-[10px] leading-relaxed"
                          >
                            <p className="text-zinc-400">
                              <span className="text-zinc-600">REASONING: </span>
                              {log.reasoning ?? log.blockedReason ?? "—"}
                            </p>
                            {log.error && (
                              <p className="text-red-400">
                                <span className="text-zinc-600">ERROR: </span>
                                {log.error}
                              </p>
                            )}
                            {log.output && (
                              <p className="break-all text-sky-400">
                                <span className="text-zinc-600">OUTPUT: </span>
                                {log.output}
                              </p>
                            )}
                            <p className="text-zinc-600">
                              id: {log.id} · session: {log.requestId ?? "—"}
                            </p>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
