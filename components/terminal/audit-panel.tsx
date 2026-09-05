"use client";

import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { AGENT_STYLES, statusChip, type AuditLogRow, type FeedAgent } from "./types";
import { formatINR, formatDateTime } from "@/lib/utils";

function AuditTable({ logs, expandedId, setExpandedId }: { logs: AuditLogRow[]; expandedId: string | null; setExpandedId: (id: string | null) => void }) {
  return (
    <table className="w-full text-left">
      <thead className="sticky top-0 bg-slate-50">
        <tr className="border-b border-slate-200 text-xs text-slate-500">
          <th className="px-3 py-2 font-medium">Time</th>
          <th className="px-2 py-2 font-medium">Agent</th>
          <th className="px-2 py-2 font-medium">Action</th>
          <th className="px-2 py-2 text-right font-medium">Amount</th>
          <th className="px-3 py-2 font-medium">Status</th>
        </tr>
      </thead>
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
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500" title={formatDateTime(log.createdAt)}>
                  {formatDateTime(log.createdAt).split(", ")[1]}
                </td>
                <td className="px-2 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${agentStyle.badge}`}>{log.agentType}</span>
                </td>
                <td className="px-2 py-2.5 font-mono text-xs text-slate-700" title={log.action}>
                  <span className="block max-w-[140px] truncate" title={log.action}>
                    {log.action}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs font-medium text-slate-700">
                  {log.amountInPaise != null ? formatINR(log.amountInPaise) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full bg-white px-2 py-1 text-xs font-bold ring-1 ${chip.cls === "text-emerald-600" ? "text-emerald-700 ring-emerald-200 bg-emerald-50" : chip.cls === "text-red-600" ? "text-red-700 ring-red-200 bg-red-50" : chip.cls === "text-amber-600" ? "text-amber-700 ring-amber-200 bg-amber-50" : "text-slate-600 ring-slate-200 bg-slate-50"}`}>
                    {log.status}
                  </span>
                </td>
              </tr>
              {expanded && (
                <tr className="border-b border-slate-200 bg-slate-50">
                  <td colSpan={5} className="px-4 py-3">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-xs leading-relaxed">
                      <p className="text-slate-600">
                        <span className="font-semibold text-slate-900">Reasoning:</span> {log.reasoning ?? log.blockedReason ?? "—"}
                      </p>
                      {log.error && <p className="text-red-600">Error: {log.error}</p>}
                      {log.output && <p className="break-all font-mono text-slate-700">Output: {log.output}</p>}
                      <p className="font-mono text-xs text-slate-400">
                        id: <span title={log.id}>{log.id.slice(0, 8)}…</span> · session: <span title={log.requestId ?? ""}>{log.requestId ? `•••${log.requestId.slice(-4)}` : "—"}</span>
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
  );
}

export function AuditPanel({ logs }: { logs: AuditLogRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Audit trail</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{logs.length}</span>
          {logs.length > 0 && (
            <button onClick={() => setOpen(true)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800">
              View all
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No money actions yet</p>
        ) : (
          <AuditTable logs={logs.slice(0, 8)} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}
        {logs.length > 8 && <p className="px-4 py-2 text-center text-xs text-slate-400">Showing 8 of {logs.length} — View all for full history</p>}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Audit trail — all records</h3>
                <button onClick={() => setOpen(false)} className="rounded-lg bg-slate-50 p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <AuditTable logs={logs} expandedId={expandedId} setExpandedId={setExpandedId} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
