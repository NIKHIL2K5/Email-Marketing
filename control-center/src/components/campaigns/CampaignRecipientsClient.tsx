'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DbRecipient } from '@/lib/db';
import { CampaignStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Info,
  UserX,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  X,
  Mail,
  Building,
  RefreshCw,
} from 'lucide-react';

interface CampaignRecipientsClientProps {
  campaignId: string;
  campaignName: string;
  campaignKey: string;
  initialRecipients: DbRecipient[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialTotalPages: number;
  initialSearch?: string;
}

export function CampaignRecipientsClient({
  campaignId,
  campaignName,
  campaignKey,
  initialRecipients,
  initialTotal,
  initialPage,
  initialPageSize,
  initialTotalPages,
  initialSearch = '',
}: CampaignRecipientsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedRecipient, setSelectedRecipient] = useState<DbRecipient | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/campaigns/${campaignId}/recipients?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/campaigns/${campaignId}/recipients?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(newPageSize));
    params.set('page', '1');
    router.push(`/campaigns/${campaignId}/recipients?${params.toString()}`);
  };

  const handleExclude = async (recipientId: string) => {
    if (!confirm('Exclude this contact from THIS campaign? (This does not globally suppress the contact)')) return;

    setActionLoadingId(recipientId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exclude', recipientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to exclude recipient');
      }
      router.refresh();
      if (selectedRecipient?.id === recipientId) {
        setSelectedRecipient((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      }
    } catch (err: any) {
      alert(`Exclusion failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReinclude = async (recipientId: string) => {
    setActionLoadingId(recipientId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reinclude', recipientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-include recipient');
      }
      router.refresh();
      if (selectedRecipient?.id === recipientId) {
        setSelectedRecipient((prev) => (prev ? { ...prev, status: 'queued' } : null));
      }
    } catch (err: any) {
      alert(`Re-inclusion failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/campaigns/${campaignId}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
                Campaign Recipient Control Center
              </h1>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {initialTotal.toLocaleString()} total
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Authoritative recipient tracking and manual exclusion for{' '}
              <strong className="text-zinc-700 dark:text-zinc-300">{campaignName}</strong> (
              <span className="font-mono">{campaignKey}</span>)
            </p>
          </div>
        </div>

        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <span>Return to Campaign</span>
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by recipient email..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </form>

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Rows per page:</span>
          <select
            value={initialPageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400">
                <th scope="col" className="px-6 py-3 font-semibold">Recipient Contact</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Attempts</th>
                <th scope="col" className="px-4 py-3 font-semibold">Gate Reason</th>
                <th scope="col" className="px-4 py-3 font-semibold">Sending Time</th>
                <th scope="col" className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {initialRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        No recipients found
                      </p>
                      <p className="text-xs text-zinc-400">
                        {initialSearch
                          ? `No recipients matching "${initialSearch}".`
                          : 'No recipients have been assigned to this campaign yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                initialRecipients.map((r) => {
                  const isExcluded = r.status === 'cancelled';
                  const isQueued = ['queued', 'pending'].includes(r.status);

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-850/60 transition-colors"
                    >
                      {/* Email and Name */}
                      <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span>{r.email}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}{' '}
                          {r.company ? `· ${r.company}` : ''}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={r.status as CampaignStatus} size="sm" />
                      </td>

                      {/* Attempts */}
                      <td className="px-4 py-3 text-right font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {r.attempt_count}
                      </td>

                      {/* Gate Reason */}
                      <td
                        className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-xs truncate"
                        title={r.eligibility_reason || ''}
                      >
                        {r.eligibility_reason || 'Eligible'}
                      </td>

                      {/* Sending Time */}
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        {r.sent_at
                          ? `Sent: ${new Date(r.sent_at).toLocaleTimeString()}`
                          : r.sending_at
                          ? `Sending: ${new Date(r.sending_at).toLocaleTimeString()}`
                          : r.queued_at
                          ? `Queued: ${new Date(r.queued_at).toLocaleTimeString()}`
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRecipient(r)}
                            className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            title="Inspect Why Will/Will Not Receive"
                          >
                            <Info className="h-3 w-3" />
                            Why?
                          </button>

                          {isQueued && (
                            <button
                              type="button"
                              disabled={actionLoadingId === r.id}
                              onClick={() => handleExclude(r.id)}
                              className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
                              title="Exclude from this campaign only"
                            >
                              <UserX className="h-3 w-3" />
                              Exclude
                            </button>
                          )}

                          {isExcluded && (
                            <button
                              type="button"
                              disabled={actionLoadingId === r.id}
                              onClick={() => handleReinclude(r.id)}
                              className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                              title="Re-include in campaign"
                            >
                              <UserCheck className="h-3 w-3" />
                              Re-include
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-side Pagination Footer */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-200 px-6 py-3 dark:border-zinc-800 text-xs text-zinc-500">
          <div>
            Showing Page <span className="font-semibold text-zinc-800 dark:text-zinc-200">{initialPage}</span> of{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{Math.max(1, initialTotalPages)}</span> (
            {initialTotal.toLocaleString()} total recipients)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={initialPage <= 1}
              onClick={() => handlePageChange(initialPage - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              disabled={initialPage >= initialTotalPages}
              onClick={() => handlePageChange(initialPage + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recipient Detail Panel ("Why Will / Will Not Receive?") */}
      {selectedRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Authoritative Recipient Diagnostics
                </span>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {selectedRecipient.email}
                </h3>
                <p className="text-xs text-zinc-500">
                  {[selectedRecipient.first_name, selectedRecipient.last_name].filter(Boolean).join(' ') || 'Unknown name'}{' '}
                  {selectedRecipient.company ? `(${selectedRecipient.company})` : ''}
                </p>
              </div>

              <button
                onClick={() => setSelectedRecipient(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Decision Box: Why will / will not receive? */}
              <div
                className={`rounded-lg border p-4 ${
                  selectedRecipient.status === 'sent' || selectedRecipient.status === 'delivered'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : selectedRecipient.status === 'queued' || selectedRecipient.status === 'sending'
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedRecipient.status === 'sent' || selectedRecipient.status === 'delivered' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : selectedRecipient.status === 'queued' || selectedRecipient.status === 'sending' ? (
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>
                    {selectedRecipient.status === 'sent' || selectedRecipient.status === 'delivered'
                      ? 'PERSON HAS RECEIVED'
                      : selectedRecipient.status === 'queued'
                      ? 'PERSON WILL RECEIVE'
                      : selectedRecipient.status === 'sending'
                      ? 'CURRENTLY SENDING'
                      : 'PERSON WILL NOT RECEIVE'}
                  </span>
                </div>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  <strong>Authoritative Reason:</strong>{' '}
                  {selectedRecipient.eligibility_reason || 'Eligible under audience rules'}
                </p>
              </div>

              {/* Compliance & Safety Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-300">
                <div className="rounded border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="text-[10px] text-zinc-400">Consent Status</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedRecipient.consent_status || 'Granted / Explicit'}
                  </div>
                </div>

                <div className="rounded border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="text-[10px] text-zinc-400">Suppression Status</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedRecipient.suppression_status || 'Active (Unsuppressed)'}
                  </div>
                </div>

                <div className="rounded border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="text-[10px] text-zinc-400">Bounce Status</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedRecipient.bounce_status || 'Clean (No bounces)'}
                  </div>
                </div>

                <div className="rounded border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="text-[10px] text-zinc-400">Complaint Status</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedRecipient.complaint_status || 'Clean (No complaints)'}
                  </div>
                </div>
              </div>

              {/* Technical Telemetry */}
              <div className="space-y-1 rounded border border-zinc-200 bg-zinc-50/50 p-3 font-mono text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <div>Recipient Record ID: {selectedRecipient.id}</div>
                <div>Contact ID: #{selectedRecipient.contact_id}</div>
                <div>Attempt Count: {selectedRecipient.attempt_count}</div>
                {selectedRecipient.provider_message_id && (
                  <div>Provider Message ID: {selectedRecipient.provider_message_id}</div>
                )}
                {selectedRecipient.last_error && (
                  <div className="text-rose-600 dark:text-rose-400">
                    Last Error: {selectedRecipient.last_error}
                  </div>
                )}
              </div>

              {/* Exclusion Distinction Note */}
              <div className="rounded bg-zinc-50 p-3 text-[11px] text-zinc-500 dark:bg-zinc-800/50">
                💡 <em>Campaign Exclusion vs Global Suppression:</em> Excluding this recipient cancels
                delivery for this campaign without affecting the contact's global consent or eligibility
                for future campaigns.
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {['queued', 'pending'].includes(selectedRecipient.status) && (
                  <button
                    type="button"
                    onClick={() => handleExclude(selectedRecipient.id)}
                    className="inline-flex items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Exclude from this Campaign
                  </button>
                )}
                {selectedRecipient.status === 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => handleReinclude(selectedRecipient.id)}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Re-include in Campaign
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
