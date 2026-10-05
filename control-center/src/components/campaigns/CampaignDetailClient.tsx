'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DbCampaign, DbCampaignSummary } from '@/lib/db';
import { CampaignStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Mail,
  Sliders,
  Users,
  Play,
  Pause,
  XCircle,
  Edit,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  History,
  ShieldCheck,
  Layers,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

interface SendAttemptItem {
  id: string;
  attempt_number: number;
  status: string;
  provider: string;
  completed_at: string | null;
  created_at: string;
  recipient: string;
}

interface CampaignDetailClientProps {
  initialCampaign: DbCampaign & {
    summary: DbCampaignSummary;
    recent_activity: SendAttemptItem[];
  };
}

export function CampaignDetailClient({ initialCampaign }: CampaignDetailClientProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);

  // Banner feedback
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDatetime, setScheduleDatetime] = useState(
    campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : ''
  );
  const [showEditModal, setShowEditModal] = useState(false);

  // Pre-flight & Audience Modals
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [preflightData, setPreflightData] = useState<{
    canDispatch: boolean;
    score: number;
    checks: Array<{ id: string; name: string; status: 'passed' | 'warning' | 'failed'; message: string; details?: string }>;
  } | null>(null);
  const [isLoadingPreflight, setIsLoadingPreflight] = useState(false);

  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [audienceLimit, setAudienceLimit] = useState('500');
  const [isAttachingAudience, setIsAttachingAudience] = useState(false);

  // Edit Form Fields
  const [editName, setEditName] = useState(campaign.name);
  const [editDescription, setEditDescription] = useState(campaign.description || '');
  const [editSubject, setEditSubject] = useState(campaign.subject);
  const [editFromName, setEditFromName] = useState(campaign.from_name || '');
  const [editFromEmail, setEditFromEmail] = useState(campaign.from_email);
  const [editReplyTo, setEditReplyTo] = useState(campaign.reply_to || '');
  const [editBatchSize, setEditBatchSize] = useState(String(campaign.batch_size || 50));
  const [editPerMin, setEditPerMin] = useState(String(campaign.emails_per_minute ?? 10));
  const [editPerHour, setEditPerHour] = useState(String(campaign.emails_per_hour ?? 500));
  const [editPerDay, setEditPerDay] = useState(String(campaign.emails_per_day ?? 2000));
  const [editMaxConcurrency, setEditMaxConcurrency] = useState(String(campaign.max_concurrency || 1));
  const [editMaxRetries, setEditMaxRetries] = useState(String(campaign.max_retries ?? 3));
  const [editBackoff, setEditBackoff] = useState(String(campaign.retry_backoff_seconds ?? 300));
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const statusUpper = campaign.status.toUpperCase();
  const isDraft = statusUpper === 'DRAFT';
  const isScheduled = statusUpper === 'SCHEDULED';
  const isRunning = statusUpper === 'RUNNING';
  const isPaused = statusUpper === 'PAUSED';
  const isTerminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(statusUpper);

  // Audience counts
  const total = Number(campaign.summary.total_recipients) || 0;
  const sent = Number(campaign.summary.sent) || 0;
  const queued = Number(campaign.summary.queued) || 0;
  const sending = Number(campaign.summary.sending) || 0;
  const failed = Number(campaign.summary.failed) || 0;
  const blocked = Number(campaign.summary.blocked) || 0;
  const remaining = Math.max(0, total - (sent + failed + blocked));
  const progressPct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.campaign);
      }
    } catch {
      router.refresh();
    }
  };

  const handleRunPreflight = async () => {
    setIsLoadingPreflight(true);
    setShowPreflightModal(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/preflight`);
      const data = await res.json();
      if (res.ok) {
        setPreflightData(data);
      }
    } catch {
      //
    } finally {
      setIsLoadingPreflight(false);
    }
  };

  const handleAttachAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAttachingAudience(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/assign-audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: parseInt(audienceLimit, 10) }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({ type: 'success', message: data.message });
        setShowAudienceModal(false);
        await refreshData();
      } else {
        setBanner({ type: 'error', message: data.error || 'Failed to attach audience' });
      }
    } catch {
      setBanner({ type: 'error', message: 'Network error attaching audience' });
    } finally {
      setIsAttachingAudience(false);
    }
  };

  // State Transitions
  const handleStart = async () => {
    setIsActionLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start campaign');
      setBanner({ type: 'success', message: 'Campaign transitioned to RUNNING state.' });
      setShowStartModal(false);
      await refreshData();
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Error starting campaign' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePause = async () => {
    setIsActionLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pause`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to pause campaign');
      setBanner({ type: 'success', message: 'Campaign is now PAUSED.' });
      await refreshData();
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Error pausing campaign' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    setIsActionLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/resume`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resume campaign');
      setBanner({ type: 'success', message: 'Campaign resumed to RUNNING state.' });
      await refreshData();
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Error resuming campaign' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsActionLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel campaign');
      setBanner({ type: 'success', message: 'Campaign CANCELLED. Queued dispatches have been aborted.' });
      setShowCancelModal(false);
      await refreshData();
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Error cancelling campaign' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsActionLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete campaign');
      router.push('/campaigns');
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Error deleting campaign' });
      setIsActionLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDatetime) return;
    setIsActionLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: new Date(scheduleDatetime).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule campaign');
      setBanner({ type: 'success', message: `Campaign scheduled for ${new Date(scheduleDatetime).toLocaleString()}.` });
      setShowScheduleModal(false);
      await refreshData();
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Error scheduling campaign' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditErrors({});
    setIsActionLoading(true);
    setBanner(null);

    const payload: Record<string, unknown> = {
      name: editName.trim(),
      description: editDescription.trim() || null,
      subject: editSubject.trim(),
      from_name: editFromName.trim() || null,
      reply_to: editReplyTo.trim() || null,
    };

    if (isDraft) {
      payload.from_email = editFromEmail.trim();
      payload.batch_size = parseInt(editBatchSize, 10);
      payload.emails_per_minute = parseInt(editPerMin, 10);
      payload.emails_per_hour = parseInt(editPerHour, 10);
      payload.emails_per_day = parseInt(editPerDay, 10);
      payload.max_concurrency = parseInt(editMaxConcurrency, 10);
      payload.max_retries = parseInt(editMaxRetries, 10);
      payload.retry_backoff_seconds = parseInt(editBackoff, 10);
    } else if (isScheduled || isPaused) {
      payload.emails_per_minute = parseInt(editPerMin, 10);
      payload.emails_per_hour = parseInt(editPerHour, 10);
      payload.emails_per_day = parseInt(editPerDay, 10);
      payload.batch_size = parseInt(editBatchSize, 10);
    }

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details) setEditErrors(data.details);
        throw new Error(data.error || 'Failed to update campaign');
      }
      setBanner({ type: 'success', message: 'Campaign configuration updated.' });
      setShowEditModal(false);
      await refreshData();
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Update error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
                {campaign.name}
              </h1>
              <StatusBadge status={campaign.status as CampaignStatus} size="md" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              <span>Key: {campaign.campaign_key}</span>
              <span>·</span>
              <span>ID: {campaign.id}</span>
              <span>·</span>
              <span>Created: {new Date(campaign.created_at).toLocaleDateString()}</span>
              <span>·</span>
              <span>Updated: {new Date(campaign.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action Controls Depending on State Machine */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Button (available in non-terminal states) */}
          {!isTerminal && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>{isRunning ? 'Edit Metadata' : 'Edit Configuration'}</span>
            </button>
          )}

          {/* Draft Actions */}
          {isDraft && (
            <>
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-2xs hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 cursor-pointer transition"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Schedule</span>
              </button>
              <button
                type="button"
                onClick={handleRunPreflight}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300 cursor-pointer transition"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Pre-Flight Check</span>
              </button>
              <button
                type="button"
                onClick={() => setShowStartModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer transition"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Now</span>
              </button>
            </>
          )}

          {/* Scheduled Actions */}
          {isScheduled && (
            <button
              type="button"
              onClick={() => setShowStartModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer transition"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Start Immediately</span>
            </button>
          )}

          {/* Running Actions */}
          {isRunning && (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={handlePause}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer transition"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Pause Campaign</span>
            </button>
          )}

          {/* Paused Actions */}
          {isPaused && (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer transition"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Resume Campaign</span>
            </button>
          )}

          {/* Cancel Action (Draft, Scheduled, Running, Paused) */}
          {!isTerminal && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer transition"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {/* Delete Action (allowed when not actively running) */}
          {!isRunning && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-2xs hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-rose-900 dark:hover:bg-rose-950/30 cursor-pointer transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
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

      {/* Grid: Overview & Audience Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Campaign Overview */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <Mail className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Message & Sender Overview
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-zinc-400 block">Subject Line</span>
              <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{campaign.subject}</p>
            </div>

            <div>
              <span className="text-[11px] font-medium text-zinc-400 block">Sender Identity</span>
              <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                {campaign.from_name ? `${campaign.from_name} <${campaign.from_email}>` : campaign.from_email}
              </p>
            </div>

            {campaign.reply_to && (
              <div>
                <span className="text-[11px] font-medium text-zinc-400 block">Reply-To</span>
                <p className="font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">{campaign.reply_to}</p>
              </div>
            )}

            <div>
              <span className="text-[11px] font-medium text-zinc-400 block">Description</span>
              <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 whitespace-pre-wrap">
                {campaign.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </div>

        {/* Audience / Recipient Summary (2 cols on large screen) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Audience & Recipient Execution
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => setShowAudienceModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Attach Audience</span>
                </button>
              )}
              <Link
                href={`/campaigns/${campaign.id}/recipients`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
              >
                <span>View all recipients</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Counts Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-medium text-zinc-400">Total Audience</span>
              <p className="mt-1 font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {total.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3 dark:border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Sent</span>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {sent.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3 dark:border-amber-500/20">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Queued</span>
              <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
                {queued.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-rose-500/10 bg-rose-500/5 p-3 dark:border-rose-500/20">
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Failed</span>
              <p className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400">
                {failed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1 font-mono">
            <span>Sending In-Flight: <strong className="text-zinc-700 dark:text-zinc-300">{sending}</strong></span>
            <span>Blocked / Suppressed: <strong className="text-zinc-700 dark:text-zinc-300">{blocked}</strong></span>
            <span>Remaining Untouched: <strong className="text-zinc-700 dark:text-zinc-300">{remaining.toLocaleString()}</strong></span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 font-medium">Delivery Completion</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Sending Configuration & Schedule Timeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sending Configuration */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <Sliders className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Sending Configuration & Throttling
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-zinc-400 block font-medium">Batch Size</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {campaign.batch_size} recipients
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Rate / Minute</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {campaign.emails_per_minute ? `${campaign.emails_per_minute}/min` : 'Unlimited'}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Rate / Hour</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {campaign.emails_per_hour ? `${campaign.emails_per_hour}/hr` : 'Unlimited'}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Rate / Day</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {campaign.emails_per_day ? `${campaign.emails_per_day}/day` : 'Unlimited'}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Max Concurrency</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {campaign.max_concurrency} worker{campaign.max_concurrency === 1 ? '' : 's'}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block font-medium">Max Retries / Backoff</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {campaign.max_retries} attempts ({campaign.retry_backoff_seconds}s backoff)
              </span>
            </div>

            <div className="col-span-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="text-zinc-400 block font-medium">Max Lifetime Recipients</span>
              <span className="font-mono text-zinc-500 italic">Not configured</span>
            </div>
          </div>
        </div>

        {/* Schedule Timeline */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <Clock className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Schedule & Execution Timeline
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 font-medium">Scheduled Time</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : 'Immediate / Not scheduled'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 font-medium">Started At</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {campaign.started_at ? new Date(campaign.started_at).toLocaleString() : 'Not started'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 font-medium">Paused At</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {campaign.paused_at ? new Date(campaign.paused_at).toLocaleString() : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-zinc-400 font-medium">Completed / Terminated At</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {campaign.completed_at ? new Date(campaign.completed_at).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sending Activity (from send_attempts) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Sending Activity
            </h2>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {campaign.recent_activity?.length || 0} latest attempts
          </span>
        </div>

        {campaign.recent_activity && campaign.recent_activity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">Recipient</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium text-right">Attempt #</th>
                  <th className="px-4 py-2.5 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono text-[11px]">
                {campaign.recent_activity.map((act) => (
                  <tr key={act.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/40">
                    <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                      {act.recipient}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          act.status.toLowerCase() === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : act.status.toLowerCase() === 'failed'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {act.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{act.provider || 'Brevo'}</td>
                    <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                      #{act.attempt_number}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-400">
                      {act.completed_at ? new Date(act.completed_at).toLocaleTimeString() : new Date(act.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 py-3 text-center">
            No send attempts recorded for this campaign yet.
          </p>
        )}
      </div>

      {/* Confirmation Modal for Cancel */}
      <ConfirmationModal
        isOpen={showCancelModal}
        title="Cancel this campaign?"
        description="Recipients that have not been sent will no longer be processed. This action cannot be reversed."
        confirmText="Cancel Campaign"
        confirmVariant="danger"
        isLoading={isActionLoading}
        onConfirm={handleCancel}
        onClose={() => setShowCancelModal(false)}
      />

      {/* Confirmation Modal for Start */}
      <ConfirmationModal
        isOpen={showStartModal}
        title="Start Campaign Execution?"
        description={`This will transition "${campaign.name}" into RUNNING state in PostgreSQL. n8n orchestration will pick up eligible batches according to configured envelopes.`}
        confirmText="Start Campaign"
        confirmVariant="primary"
        isLoading={isActionLoading}
        onConfirm={handleStart}
        onClose={() => setShowStartModal(false)}
      />

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <Calendar className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Schedule Campaign Execution
              </h3>
            </div>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Target Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleDatetime}
                  onChange={(e) => setScheduleDatetime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading || !scheduleDatetime}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
                >
                  {isActionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Configuration Modal */}
      {showEditModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-zinc-500" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Edit Campaign ({campaign.status.toUpperCase()})
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {isRunning && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                  Rate envelopes and sender email are locked while a campaign is actively RUNNING. Only identity and metadata fields may be edited safely.
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Campaign Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  {editErrors.name && <p className="text-[11px] text-rose-500">{editErrors.name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Subject Line <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  {editErrors.subject && <p className="text-[11px] text-rose-500">{editErrors.subject}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={editFromName}
                      onChange={(e) => setEditFromName(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      From Email {isRunning ? '(Locked)' : ''}
                    </label>
                    <input
                      type="email"
                      disabled={!isDraft}
                      value={editFromEmail}
                      onChange={(e) => setEditFromEmail(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={editReplyTo}
                    onChange={(e) => setEditReplyTo(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Rate Envelopes (Editable if not running) */}
                {!isRunning && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Throttle & Concurrency Controls
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-zinc-400 block">Batch Size</label>
                        <input
                          type="number"
                          min="1"
                          value={editBatchSize}
                          onChange={(e) => setEditBatchSize(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block">Per Minute</label>
                        <input
                          type="number"
                          min="0"
                          value={editPerMin}
                          onChange={(e) => setEditPerMin(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block">Per Hour</label>
                        <input
                          type="number"
                          min="0"
                          value={editPerHour}
                          onChange={(e) => setEditPerHour(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block">Per Day</label>
                        <input
                          type="number"
                          min="0"
                          value={editPerDay}
                          onChange={(e) => setEditPerDay(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      {isDraft && (
                        <>
                          <div>
                            <label className="text-[11px] text-zinc-400 block">Max Concurrency</label>
                            <input
                              type="number"
                              min="1"
                              value={editMaxConcurrency}
                              onChange={(e) => setEditMaxConcurrency(e.target.value)}
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-zinc-400 block">Max Retries</label>
                            <input
                              type="number"
                              min="0"
                              value={editMaxRetries}
                              onChange={(e) => setEditMaxRetries(e.target.value)}
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-zinc-400 block">Backoff (s)</label>
                            <input
                              type="number"
                              min="0"
                              value={editBackoff}
                              onChange={(e) => setEditBackoff(e.target.value)}
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
                >
                  {isActionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Pre-Flight Checklist Modal */}
      {showPreflightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Pre-Flight Safety Verification Gate
                </h2>
              </div>
              <button
                onClick={() => setShowPreflightModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoadingPreflight ? (
              <div className="py-12 text-center text-zinc-400">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-600 mb-2" />
                <span>Running automated pre-flight checks against PostgreSQL...</span>
              </div>
            ) : preflightData ? (
              <div className="space-y-4">
                {/* Score Header */}
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 border border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-800">
                  <div>
                    <span className="text-xs text-zinc-500">Readiness Score</span>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {preflightData.score}% Verified
                    </p>
                  </div>
                  <div>
                    {preflightData.canDispatch ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" /> Ready for Dispatch
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-rose-500/20">
                        <XCircle className="h-4 w-4" /> Action Required Before Dispatch
                      </span>
                    )}
                  </div>
                </div>

                {/* Checks List */}
                <div className="space-y-2">
                  {preflightData.checks.map((chk) => (
                    <div
                      key={chk.id}
                      className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800 bg-white dark:bg-zinc-900/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{chk.name}</span>
                        {chk.status === 'passed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                          </span>
                        )}
                        {chk.status === 'warning' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" /> Warning
                          </span>
                        )}
                        {chk.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{chk.message}</p>
                      {chk.details && <p className="mt-0.5 text-[11px] text-zinc-400">{chk.details}</p>}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowPreflightModal(false)}
                    className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    Close
                  </button>
                  {preflightData.canDispatch && isDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPreflightModal(false);
                        setShowStartModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Proceed to Launch</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Attach Audience Modal */}
      {showAudienceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Attach Audience to Campaign
                </h2>
              </div>
              <button
                onClick={() => setShowAudienceModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAttachAudience} className="space-y-4 text-xs">
              <p className="text-zinc-600 dark:text-zinc-400">
                This will query PostgreSQL for verified, eligible contacts with active consent who are not already in this campaign, and insert them into the send queue.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Number of Eligible Contacts to Ingest
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={audienceLimit}
                  onChange={(e) => setAudienceLimit(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAudienceModal(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAttachingAudience}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isAttachingAudience && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isAttachingAudience ? 'Attaching...' : 'Attach Contacts'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete this campaign permanently?"
        description={`Are you sure you want to permanently delete "${campaign.name}" (#${campaign.id})? All recipients, send attempts, and events will be deleted. This action cannot be reversed.`}
        confirmText="Delete Campaign"
        confirmVariant="danger"
        isLoading={isActionLoading}
        onConfirm={handleDelete}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
