'use client';

import React, { useState } from 'react';
import {
  ClipboardList,
  Shield,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
} from 'lucide-react';
import type { AuditLogEntry } from '@/lib/db/queries/audit';

interface AuditLogClientProps {
  initialLogs: AuditLogEntry[];
  total: number;
}

export function AuditLogClient({ initialLogs, total }: AuditLogClientProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');

  const filteredLogs = logs.filter((log) => {
    if (filterEntity !== 'all' && log.entity_type !== filterEntity) return false;
    if (filterAction && !log.action.toLowerCase().includes(filterAction.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Authoritative Operational Audit Trail
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Immutable PostgreSQL ledger recording who, what, when, object, before, after, and result for all system mutations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Shield className="h-3 w-3" />
            PostgreSQL Authoritative Ledger ({total} events)
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          placeholder="Filter by action (e.g. campaign_created, send_mode)..."
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:w-80"
        />

        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="all">All Entity Types</option>
          <option value="campaign">Campaigns</option>
          <option value="audience">Audiences</option>
          <option value="template">Templates</option>
          <option value="sending_limits">Sending Limits</option>
          <option value="system_setting">System Settings</option>
          <option value="campaign_recipient">Campaign Recipients</option>
          <option value="security_event">Security Events</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / Operator</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Object</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3 text-right">State Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const isSuccess = log.result === 'success';

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                            <User className="h-3 w-3 text-zinc-400" />
                            <span>{log.actor_reference}</span>
                            <span className="text-[10px] text-zinc-400">({log.actor_type})</span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                            {log.action}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                            <span className="text-zinc-400">{log.entity_type}:</span> {log.entity_id}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {log.result.toUpperCase()}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {isExpanded ? (
                              <>
                                Hide Diff <ChevronDown className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                Inspect Diff <ChevronRight className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Before/After Comparison */}
                      {isExpanded && (
                        <tr className="bg-zinc-50/80 dark:bg-zinc-950/60">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                              <div className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                                <span className="font-bold text-zinc-600 dark:text-zinc-400">
                                  State Before Mutation
                                </span>
                                <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-50 p-2 font-mono text-[11px] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 whitespace-pre-wrap">
                                  {log.before_state
                                    ? JSON.stringify(log.before_state, null, 2)
                                    : '(No prior state recorded / New entity created)'}
                                </pre>
                              </div>

                              <div className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                  State After Mutation
                                </span>
                                <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-50 p-2 font-mono text-[11px] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 whitespace-pre-wrap">
                                  {log.after_state
                                    ? JSON.stringify(log.after_state, null, 2)
                                    : '(Entity deleted / No post state)'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
