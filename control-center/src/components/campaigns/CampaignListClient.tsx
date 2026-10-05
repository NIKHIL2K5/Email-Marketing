'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DbCampaignSummary } from '@/lib/db';
import { CampaignStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import {
  Search,
  Plus,
  Play,
  Pause,
  XCircle,
  ExternalLink,
  Layers,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Trash2,
} from 'lucide-react';

interface CampaignListClientProps {
  initialCampaigns: DbCampaignSummary[];
}

const STATUS_TABS = [
  'ALL',
  'DRAFT',
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
] as const;

export function CampaignListClient({ initialCampaigns }: CampaignListClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [campaigns, setCampaigns] = useState<DbCampaignSummary[]>(initialCampaigns);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [cancelModalCampaign, setCancelModalCampaign] = useState<DbCampaignSummary | null>(null);
  const [deleteModalCampaign, setDeleteModalCampaign] = useState<DbCampaignSummary | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);


  // Filtering
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      search.trim() === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.campaign_key.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      selectedStatus === 'ALL' ||
      c.status.toUpperCase() === selectedStatus.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  // Calculate status counts
  const statusCounts = campaigns.reduce<Record<string, number>>((acc, c) => {
    const s = c.status.toUpperCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const refreshCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : data.campaigns || []);
      }
    } catch {
      // Fallback
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handlePause = async (campaign: DbCampaignSummary) => {
    setActionLoadingId(campaign.campaign_id);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.campaign_id}/pause`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to pause campaign');
      }
      setBanner({ type: 'success', message: `Campaign "${campaign.name}" paused.` });
      await refreshCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error pausing campaign';
      setBanner({ type: 'error', message: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResume = async (campaign: DbCampaignSummary) => {
    setActionLoadingId(campaign.campaign_id);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.campaign_id}/resume`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resume campaign');
      }
      setBanner({ type: 'success', message: `Campaign "${campaign.name}" resumed to running.` });
      await refreshCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error resuming campaign';
      setBanner({ type: 'error', message: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalCampaign) return;
    const campaign = cancelModalCampaign;
    setActionLoadingId(campaign.campaign_id);
    setBanner(null);

    try {
      const res = await fetch(`/api/campaigns/${campaign.campaign_id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel campaign');
      }
      setBanner({
        type: 'success',
        message: `Campaign "${campaign.name}" has been cancelled. Queued recipients have been stopped.`,
      });
      setCancelModalCampaign(null);
      await refreshCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cancelling campaign';
      setBanner({ type: 'error', message: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalCampaign) return;
    const campaign = deleteModalCampaign;
    setActionLoadingId(campaign.campaign_id);
    setBanner(null);

    try {
      const res = await fetch(`/api/campaigns/${campaign.campaign_id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete campaign');
      }
      setBanner({
        type: 'success',
        message: `Campaign "${campaign.name}" (#${campaign.campaign_id}) has been permanently deleted.`,
      });
      setDeleteModalCampaign(null);
      await refreshCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting campaign';
      setBanner({ type: 'error', message: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
              Campaigns
            </h1>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {campaigns.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Outreach campaigns, scheduling, sending envelopes, and lifecycle controls. Orchestration executes via n8n.
          </p>
        </div>

        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Campaign</span>
        </Link>
      </div>

      {/* Banner Feedback */}
      {banner && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-xs transition ${
            banner.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters: Search & Status Tabs */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or key..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          {/* Quick Stats count */}
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
            Showing {filteredCampaigns.length} of {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          {STATUS_TABS.map((tab) => {
            const isSelected = selectedStatus === tab;
            const count = tab === 'ALL' ? campaigns.length : statusCounts[tab] || 0;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedStatus(tab)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    isSelected
                      ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400">
                <th scope="col" className="px-6 py-3 font-semibold">Campaign</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Recipients</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Sent</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Queued</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Failed</th>
                <th scope="col" className="px-4 py-3 font-semibold">Schedule</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Daily Limit</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last Activity</th>
                <th scope="col" className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        No campaigns found
                      </p>
                      <p className="text-xs text-zinc-400">
                        {search || selectedStatus !== 'ALL'
                          ? 'Try changing your search query or status filter.'
                          : 'Create your first campaign to begin.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => {
                  const statusUpper = c.status.toUpperCase();
                  const isRunning = statusUpper === 'RUNNING';
                  const isPaused = statusUpper === 'PAUSED';
                  const isCancellable = ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(statusUpper);
                  const isActionLoading = actionLoadingId === c.campaign_id;

                  const scheduledFormatted = c.scheduled_at
                    ? new Date(c.scheduled_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr
                      key={c.campaign_id}
                      className="group hover:bg-zinc-50/80 dark:hover:bg-zinc-850/60 transition-colors"
                    >
                      {/* Campaign Name & Key */}
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col">
                          <Link
                            href={`/campaigns/${c.campaign_id}`}
                            className="font-semibold text-zinc-900 group-hover:text-zinc-950 hover:underline dark:text-zinc-100 dark:group-hover:text-white transition-colors"
                          >
                            {c.name}
                          </Link>
                          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                            {c.campaign_key}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={c.status as CampaignStatus} size="sm" />
                      </td>

                      {/* Total Recipients */}
                      <td className="px-4 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {Number(c.total_recipients).toLocaleString()}
                      </td>

                      {/* Sent */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(c.sent).toLocaleString()}
                      </td>

                      {/* Queued */}
                      <td className="px-4 py-3.5 text-right font-mono text-amber-600 dark:text-amber-400">
                        {Number(c.queued).toLocaleString()}
                      </td>

                      {/* Failed */}
                      <td className="px-4 py-3.5 text-right font-mono text-rose-600 dark:text-rose-400">
                        {Number(c.failed).toLocaleString()}
                      </td>

                      {/* Schedule */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-zinc-400" />
                          <span>{scheduledFormatted}</span>
                        </div>
                      </td>

                      {/* Daily Limit */}
                      <td className="px-4 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {c.emails_per_day ? `${c.emails_per_day}/day` : 'Unlimited'}
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-medium">
                        {c.last_activity || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pause Action */}
                          {isRunning && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handlePause(c)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 transition cursor-pointer"
                              title="Pause Campaign"
                              aria-label={`Pause ${c.name}`}
                            >
                              <Pause className="h-3 w-3" />
                            </button>
                          )}

                          {/* Resume Action */}
                          {isPaused && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleResume(c)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                              title="Resume Campaign"
                              aria-label={`Resume ${c.name}`}
                            >
                              <Play className="h-3 w-3" />
                            </button>
                          )}

                          {/* Cancel Action */}
                          {isCancellable && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => setCancelModalCampaign(c)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition cursor-pointer"
                              title="Cancel Campaign"
                              aria-label={`Cancel ${c.name}`}
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          )}

                          {/* Delete Action (allowed when not actively running) */}
                          {!isRunning && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => setDeleteModalCampaign(c)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition cursor-pointer"
                              title="Delete Campaign"
                              aria-label={`Delete ${c.name}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}

                          {/* View Details */}
                          <Link
                            href={`/campaigns/${c.campaign_id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
                            title="View Details"
                            aria-label={`View details for ${c.name}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Cancel */}
      <ConfirmationModal
        isOpen={Boolean(cancelModalCampaign)}
        title="Cancel this campaign?"
        description={`Are you sure you want to cancel "${cancelModalCampaign?.name}"? Recipients that have not been sent will no longer be processed. This action cannot be reversed.`}
        confirmText="Cancel Campaign"
        confirmVariant="danger"
        isLoading={Boolean(cancelModalCampaign && actionLoadingId === cancelModalCampaign.campaign_id)}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelModalCampaign(null)}
      />

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={Boolean(deleteModalCampaign)}
        title="Delete this campaign permanently?"
        description={`Are you sure you want to permanently delete "${deleteModalCampaign?.name}" (#${deleteModalCampaign?.campaign_id})? This will delete all campaign recipients, attempts, and audit events. This action CANNOT be reversed.`}
        confirmText="Delete Campaign"
        confirmVariant="danger"
        isLoading={Boolean(deleteModalCampaign && actionLoadingId === deleteModalCampaign.campaign_id)}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalCampaign(null)}
      />
    </div>
  );
}
