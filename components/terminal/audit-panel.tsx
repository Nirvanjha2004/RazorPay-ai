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
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-slate-700">Audit trail · Money actions</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{logs.length} records</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No money actions yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <tbody>
              {logs.map((log) => {
                const chip = statusChip(log.status);
                const expanded = expandedId === log.id;
                const agentStyle = AGENT_STYLES[log.agentType as FeedAgent] ?? AGENT_STYLES.SYSTEM;
                return (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap py-2.5 pl-4 pr-2 font-mono text-xs text-slate-500">
                        {formatDateTime(log.createdAt).split(", ")[1]}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${agentStyle.badge.replace("border","ring")}`}>
                          {log.agentType}
                        </span>
                      </td>
                      <td className="max-w-24 truncate py-2.5 pr-2 font-mono text-xs text-slate-700" title={log.action}>
                        {log.action}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-2 text-right font-mono text-xs font-medium text-slate-700">
                        {log.amountInPaise != null ? formatINR(log.amountInPaise) : "—"}
                      </td>
                      <td className={`whitespace-nowrap py-2.5 pr-4 text-xs font-semibold ${chip.cls}`}>
                        {log.status}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={5} className="px-4 py-3">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-1 font-mono text-xs leading-relaxed"
                          >
                            <p className="text-slate-700">
                              <span className="font-semibold text-slate-900">Reasoning: </span>
                              {log.reasoning ?? log.blockedReason ?? "—"}
                            </p>
                            {log.error && (
                              <p className="text-red-600">
                                <span className="font-semibold">Error: </span>
                                {log.error}
                              </p>
                            )}
                            {log.output && (
                              <p className="break-all text-[#204CF5]">
                                <span className="font-semibold text-slate-700">Output: </span>
                                {log.output}
                              </p>
                            )}
                            <p className="text-slate-400">
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
