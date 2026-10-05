'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Ban,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Workflow,
  ShieldCheck,
  Send,
  Database,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Eye,
  ChevronRight,
  X,
  ExternalLink,
  Layers,
  Activity,
  Server,
  Lock,
  Mail,
  User,
  Building,
  Info,
  Radio,
  Copy,
  Check,
  FlaskConical,
  Zap,
  Wifi,
  WifiOff,
  Square,
  UserX,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { N8nServiceStatus, N8nCampaignContext } from '@/lib/db/queries/n8n';

export interface RecipientRow {
  recipientId: string;
  contactId: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  country: string;
  consentStatus: string;
  validationStatus: string;
  suppressionStatus: string;
  bounceStatus: string;
  complaintStatus: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  providerMessageId: string | null;
  eligibilityReason: string;
  eligibilityStatus: string;
  emails_sent_count?: number;
}

export interface ExecutionRecord {
  id: string;
  executionId: string;
  campaignId: string | null;
  campaignName: string;
  status: 'SUCCESS' | 'NO_SEND' | 'BLOCKED' | 'FAILED' | 'ERROR';
  recipientEmail: string;
  attemptNumber: number;
  provider: string;
  result: string;
  errorMessage?: string;
  startedAt: string;
  completedAt: string | null;
  duration: string;
  timeline: Array<{
    stage: string;
    status: 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'PENDING';
    timestamp: string;
    details?: string;
  }>;
}

interface RecipientDetailData {
  recipient_id: string;
  campaign_id: string;
  contact_id: string;
  email_normalized: string;
  campaign_recipient_status: string;
  attempt_count: number;
  eligibility_reason: string;
  provider_message_id: string | null;
  queued_at: string | null;
  sending_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  campaign_name: string;
  campaign_status: string;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  seniority: string;
  industry: string;
  city: string;
  state: string;
  country: string;
  eligibility_status: string;
  consent_status: string;
  consent_source: string;
  email_validation_status: string;
  unsubscribe_status: string;
  bounce_status: string;
  complaint_status: string;
  suppression_status: string;
  emails_sent_count?: number;
  explanationItems: Array<{ label: string; passed: boolean; details?: string }>;
  attempts: Array<{
    id: string;
    attempt_number: number;
    status: string;
    provider: string;
    provider_message_id: string | null;
    smtp_response_code: number | null;
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
  }>;
}

interface Props {
  initialStatus: N8nServiceStatus;
  initialContext: N8nCampaignContext | null;
  initialExecutions: ExecutionRecord[];
}

export function N8nConsoleClient({ initialStatus, initialContext, initialExecutions }: Props) {
  const [, startTransition] = useTransition();

  // State
  const [serviceStatus, setServiceStatus] = useState<N8nServiceStatus>(initialStatus);
  const [context, setContext] = useState<N8nCampaignContext | null>(initialContext);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    initialContext?.campaign.id || (initialContext?.allCampaigns[0]?.id ?? '')
  );
  const [executions, setExecutions] = useState<ExecutionRecord[]>(initialExecutions);

  // Recipient Table Filters & Pagination
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
  const [consentFilter, setConsentFilter] = useState('all');

  // Drawers & Modals
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [recipientDetail, setRecipientDetail] = useState<RecipientDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [activeExecutionTimeline, setActiveExecutionTimeline] = useState<ExecutionRecord | null>(null);
  const [previewTab, setPreviewTab] = useState<'html' | 'text'>('html');

  // Webhook Configuration & Listener State
  const defaultTestUrl = 'http://localhost:5678/webhook-test/first-client/execute';
  const defaultProdUrl = 'http://localhost:5678/webhook/first-client/execute';

  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('n8n_custom_webhook_url') || defaultProdUrl;
    }
    return defaultProdUrl;
  });

  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'listening' | 'connected' | 'error'>('idle');
  const [isPingingWebhook, setIsPingingWebhook] = useState(false);
  const [webhookDetails, setWebhookDetails] = useState<{
    latencyMs?: number;
    message?: string;
    hint?: string;
    timestamp?: string;
    status?: number;
  } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Full Campaign Dispatch State
  const [isFullDispatchRunning, setIsFullDispatchRunning] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState<{
    current: number;
    total: number;
    sent: number;
    failed: number;
    blocked: number;
  } | null>(null);
  const stopDispatchRef = React.useRef(false);

  // Live Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecutionResultModal, setLastExecutionResultModal] = useState<Record<string, unknown> | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch campaign context whenever campaign changes
  const reloadCampaignContext = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    try {
      const res = await fetch(`/api/n8n/campaign?campaign_id=${campaignId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setContext(json.data);
      }
    } catch (e) {
      console.error('Failed to load campaign context:', e);
    }
  }, []);

  // Fetch recipients list
  const reloadRecipients = useCallback(async () => {
    if (!selectedCampaignId) return;
    setRecipientsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        campaign_id: selectedCampaignId,
        page: String(page),
        page_size: String(pageSize),
        search: searchQuery,
        status: statusFilter,
        eligibility: eligibilityFilter,
        consent: consentFilter,
      });
      const res = await fetch(`/api/n8n/recipients?${queryParams.toString()}`);
      const json = await res.json();
      const rawList = json.data?.recipients || json.recipients || [];
      const totalCount = json.data?.totalCount ?? json.total ?? rawList.length;
      const pages = json.data?.totalPages ?? json.totalPages ?? 1;

      setRecipients(
        rawList.map((r: any) => ({
          recipientId: String(r.id || r.recipient_id || r.recipientId || ''),
          contactId: String(r.contact_id || r.contactId || ''),
          status: String(r.campaign_recipient_status || r.status || 'queued'),
          firstName: r.first_name || r.firstName || '',
          lastName: r.last_name || r.lastName || '',
          email: r.email_normalized || r.email || '',
          company: r.company || '',
          title: r.title || '',
          country: r.country || '',
          consentStatus: r.consent_status || r.consentStatus || 'implied',
          validationStatus: r.email_validation_status || r.validationStatus || 'valid',
          suppressionStatus: r.suppression_status || r.suppressionStatus || 'not_suppressed',
          bounceStatus: r.bounce_status || r.bounceStatus || 'none',
          complaintStatus: r.complaint_status || r.complaintStatus || 'none',
          attemptCount: Number(r.attempt_count ?? r.attemptCount ?? 0),
          lastAttemptAt: r.last_attempt_at || r.lastAttemptAt || null,
          providerMessageId: r.provider_message_id || r.providerMessageId || null,
          eligibilityReason: r.eligibility_reason || r.eligibilityReason || 'eligible',
          eligibilityStatus: r.eligibility_status || r.eligibilityStatus || 'eligible',
          emails_sent_count: Number(r.emails_sent_count ?? 0),
        }))
      );
      setTotalRecipients(totalCount);
      setTotalPages(pages);
    } catch (e) {
      console.error('Failed to fetch recipients:', e);
    } finally {
      setRecipientsLoading(false);
    }
  }, [selectedCampaignId, page, pageSize, searchQuery, statusFilter, eligibilityFilter, consentFilter]);

  // Contact Block / Unblock Toggle Handler
  const [isTogglingBlockId, setIsTogglingBlockId] = useState<string | null>(null);

  const handleToggleContactBlock = async (contactId: string, block: boolean) => {
    if (!contactId) return;
    setIsTogglingBlockId(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update contact status');

      setActionMessage({
        type: 'success',
        text: block
          ? `Contact #${contactId} has been BLOCKED from all campaigns.`
          : `Contact #${contactId} has been UNBLOCKED and is now ELIGIBLE for sending!`,
      });

      // Reload recipients and campaign context
      reloadRecipients();
      reloadCampaignContext(selectedCampaignId);

      // If drawer is open for this contact, update it
      if (recipientDetail && recipientDetail.contact_id === contactId) {
        setRecipientDetail((prev) =>
          prev
            ? {
                ...prev,
                eligibility_status: json.data.eligibility_status,
                eligibility_reason: json.data.eligibility_reason,
                suppression_status: json.data.suppression_status,
                emails_sent_count: json.data.emails_sent_count ?? prev.emails_sent_count,
              }
            : null
        );
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error changing contact status',
      });
    } finally {
      setIsTogglingBlockId(null);
    }
  };

  // Fetch recent executions
  const reloadExecutions = useCallback(async () => {
    try {
      const res = await fetch('/api/n8n/executions?limit=20');
      const json = await res.json();
      if (json.success && json.data) {
        setExecutions(json.data);
      }
    } catch (e) {
      console.error('Failed to reload executions:', e);
    }
  }, []);

  // Fetch service status
  const reloadServiceStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/n8n/status');
      const json = await res.json();
      if (json.success && json.data) {
        setServiceStatus(json.data);
      }
    } catch (e) {
      console.error('Failed to reload service status:', e);
    }
  }, []);

  const handleGlobalRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      reloadServiceStatus(),
      reloadCampaignContext(selectedCampaignId),
      reloadRecipients(),
      reloadExecutions(),
    ]);
    setRefreshing(false);
  }, [reloadServiceStatus, reloadCampaignContext, reloadRecipients, reloadExecutions, selectedCampaignId]);

  useEffect(() => {
    if (selectedCampaignId) {
      reloadCampaignContext(selectedCampaignId);
    }
  }, [selectedCampaignId, reloadCampaignContext]);

  useEffect(() => {
    reloadRecipients();
  }, [reloadRecipients]);

  // Handle Recipient Detail Fetch
  const handleOpenRecipient = async (recipientId: string) => {
    setActiveRecipientId(recipientId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/n8n/recipients/${recipientId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRecipientDetail(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch recipient detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  // Ping / Handshake with n8n Webhook
  const handlePingWebhook = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || webhookUrl).trim();
    if (!targetUrl) return;
    setIsPingingWebhook(true);
    setWebhookStatus('listening');
    setWebhookDetails(null);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('n8n_custom_webhook_url', targetUrl);
      }
      const res = await fetch('/api/n8n/ping-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          campaignId: selectedCampaignId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setWebhookStatus('connected');
        setWebhookDetails({
          status: json.status,
          latencyMs: json.latencyMs,
          message: json.message || 'Webhook verified & connected',
          timestamp: new Date().toLocaleTimeString(),
        });
        setActionMessage({
          type: 'success',
          text: `n8n Webhook Connected! Handshake verified in ${json.latencyMs}ms. Campaign dispatches unlocked.`,
        });
      } else {
        setWebhookStatus('error');
        setWebhookDetails({
          status: json.status,
          latencyMs: json.latencyMs,
          message: json.error || 'Connection failed',
          hint: json.hint,
          timestamp: new Date().toLocaleTimeString(),
        });
        setActionMessage({
          type: 'error',
          text: json.error || 'Webhook verification failed',
        });
      }
    } catch (err) {
      setWebhookStatus('error');
      setWebhookDetails({
        status: 0,
        message: err instanceof Error ? err.message : String(err),
        hint: 'Ensure n8n is running on http://localhost:5678',
        timestamp: new Date().toLocaleTimeString(),
      });
      setActionMessage({
        type: 'error',
        text: `Failed to ping n8n webhook: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsPingingWebhook(false);
    }
  };

  const handleCopyWebhook = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  // Execute ONE Controlled Cycle
  const handleExecuteNow = async () => {
    if (!context || isExecuting) return;
    setIsExecuting(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/n8n/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          campaign_id: selectedCampaignId,
          operator: 'admin-console',
          webhook_url: webhookUrl,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.status === 'BLOCKED' || json.status === 'FAILED' || json.status === 'ERROR') {
        setActionMessage({
          type: 'error',
          text: json.error || json.resultMessage || 'Execution cycle failed.',
        });
      } else {
        setLastExecutionResultModal(json);
        setActionMessage({
          type: 'success',
          text: `Executed 1 controlled cycle via ${webhookUrl.includes('webhook-test') ? 'Test' : 'Production'} Webhook. Status: ${json.status}.`,
        });
        handleGlobalRefresh();
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Run Full Campaign Dispatch (Durable Server-side Execution Worker)
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleRunFullCampaign = async () => {
    if (!context || isExecuting || isFullDispatchRunning) return;
    setIsFullDispatchRunning(true);
    const totalQueued = context.audienceStats.queuedCount;
    setDispatchProgress({ current: 0, total: totalQueued, sent: 0, failed: 0, blocked: 0 });

    try {
      // 1. Submit durable execution request to PostgreSQL
      const res = await fetch('/api/n8n/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: selectedCampaignId,
          limit: totalQueued,
          webhook_url: webhookUrl,
          action: 'full_campaign_dispatch',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.execution) {
        throw new Error(json.error || 'Failed to initiate durable dispatch');
      }

      const execReq = json.execution;
      setActiveJobId(execReq.execution_id);
      setActionMessage({
        type: 'success',
        text: `Durable server execution started (ID: ${execReq.execution_id}). Campaign will continue running in PostgreSQL worker even if this browser tab is closed.`,
      });

      // 2. Poll job progress from PostgreSQL
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/n8n/dispatch?executionId=${execReq.execution_id}`);
          const pollJson = await pollRes.json();
          const job = pollJson.execution;

          if (job) {
            setDispatchProgress({
              current: job.processed_count,
              total: totalQueued,
              sent: job.success_count,
              failed: job.failure_count,
              blocked: job.blocked_count,
            });

            if (['completed', 'failed', 'cancelled'].includes(job.status)) {
              clearInterval(interval);
              setIsFullDispatchRunning(false);
              setActiveJobId(null);
              setActionMessage({
                type: job.status === 'completed' ? 'success' : 'info',
                text: `Execution job ${job.status}: ${job.success_count} sent, ${job.failure_count} failed, ${job.blocked_count} blocked.`,
              });
              handleGlobalRefresh();
            }
          }
        } catch {
          // Keep polling
        }
      }, 1500);
    } catch (err) {
      setIsFullDispatchRunning(false);
      setActionMessage({
        type: 'error',
        text: `Dispatch error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleStopDispatch = async () => {
    if (activeJobId) {
      try {
        await fetch(`/api/n8n/dispatch?executionId=${activeJobId}`, { method: 'DELETE' });
      } catch (e) {
        console.error(e);
      }
    }
    setIsFullDispatchRunning(false);
    setActionMessage({ type: 'info', text: 'Campaign dispatch cancel signal sent to server worker.' });
  };


  // Campaign State Toggles
  const handleCampaignAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    if (!selectedCampaignId) return;
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignId}/${action}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: `Campaign #${selectedCampaignId} successfully ${action === 'start' ? 'started and is now RUNNING! Recipient dispatches unlocked.' : action + 'd.'}`,
        });
        reloadCampaignContext(selectedCampaignId);
      } else {
        setActionMessage({
          type: 'error',
          text: json.error || `Failed to ${action} campaign.`,
        });
      }
    } catch (e) {
      setActionMessage({
        type: 'error',
        text: `Network error: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const isExecutionBlocked = Boolean(
    !context ||
    context.preflight.canExecute === false ||
    context.campaign.status === 'cancelled' ||
    context.campaign.status === 'completed'
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
              n8n Mission Control
            </h1>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              PRODUCTION PIPELINE
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Real-time execution telemetry, strict PostgreSQL slot claiming, and single-cycle orchestration
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Campaign Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Campaign:
            </span>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {context?.allCampaigns.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  #{c.id} — {c.name} ({c.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGlobalRefresh}
            disabled={refreshing}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Refresh pipeline status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              : 'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {actionMessage.type === 'error' && <XCircle className="h-4 w-4 text-rose-600" />}
            {actionMessage.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ACTION 1: N8N LIVE WEBHOOK LISTENER & INTEGRATION CARD */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  n8n Webhook Listener &amp; Integration
                </h2>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  POST
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect your n8n workflow webhook before launching recipient dispatches
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {webhookStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                CONNECTED &amp; LISTENING
              </span>
            ) : webhookStatus === 'listening' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                LISTENING &amp; PINGING...
              </span>
            ) : webhookStatus === 'error' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-400">
                <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                NOT CONNECTED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                <Radio className="h-3.5 w-3.5 text-zinc-400" />
                NOT VERIFIED
              </span>
            )}
          </div>
        </div>

        {/* Webhook Configuration Form */}
        <div className="mt-4 space-y-4">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                setWebhookUrl(defaultTestUrl);
                setWebhookStatus('idle');
                setWebhookDetails(null);
                if (typeof window !== 'undefined') localStorage.setItem('n8n_custom_webhook_url', defaultTestUrl);
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                webhookUrl.includes('webhook-test')
                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:border-orange-500/40 dark:text-orange-300 font-bold'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              ⚡ Test URL (Listen for test event)
            </button>
            <button
              type="button"
              onClick={() => {
                setWebhookUrl(defaultProdUrl);
                setWebhookStatus('idle');
                setWebhookDetails(null);
                if (typeof window !== 'undefined') localStorage.setItem('n8n_custom_webhook_url', defaultProdUrl);
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                !webhookUrl.includes('webhook-test') && webhookUrl.includes('webhook')
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/40 dark:text-indigo-300 font-bold'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              🚀 Production URL (Active Workflow)
            </button>
          </div>

          {/* URL Input with Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setWebhookStatus('idle');
                  setWebhookDetails(null);
                }}
                placeholder="http://localhost:5678/webhook-test/first-client/execute"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-xs text-zinc-900 shadow-2xs focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                title="Copy webhook URL"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <button
              type="button"
              disabled={isPingingWebhook}
              onClick={() => handlePingWebhook()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700 active:scale-95 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600 transition cursor-pointer shrink-0"
            >
              {isPingingWebhook ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Listening &amp; Pinging...
                </>
              ) : (
                <>
                  <FlaskConical className="h-3.5 w-3.5" />
                  Activate Listening &amp; Ping Webhook
                </>
              )}
            </button>
          </div>

          {/* Handshake Feedback Banner */}
          {webhookStatus === 'connected' && webhookDetails && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">
                    Handshake Verified (HTTP {webhookDetails.status || 200} in {webhookDetails.latencyMs}ms)
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                    n8n successfully received the test event and is listening on{' '}
                    <code className="font-mono font-semibold">{webhookUrl}</code>. Campaign dispatches are now unlocked!
                  </p>
                  {webhookDetails.timestamp && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Last ping verified at {webhookDetails.timestamp}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {webhookStatus === 'error' && webhookDetails && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-900 dark:text-rose-200">
                    Webhook Connection Failed {webhookDetails.status ? `(HTTP ${webhookDetails.status})` : ''}
                  </div>
                  <p className="text-rose-800 dark:text-rose-300 text-[11px]">
                    {webhookDetails.message}
                  </p>
                  {webhookDetails.hint && (
                    <p className="text-[11px] font-semibold text-rose-900 dark:text-rose-200 bg-rose-100/60 dark:bg-rose-900/40 p-2 rounded mt-1">
                      💡 {webhookDetails.hint}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {webhookStatus === 'idle' && (
            <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2.5 text-[11px] text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <Info className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
              <span>
                <strong>How to connect:</strong> Click the orange <strong>&quot;Listen for test event&quot;</strong> button in your n8n Webhook node first, then click <strong>&quot;Activate Listening &amp; Ping Webhook&quot;</strong> here. When both are connected, the campaign dispatch buttons unlock.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 23: WHO AM I SENDING TO? SUMMARY (3 Pillars) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Pillar 1: WHO ARE WE SENDING TO? */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                1
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Who are we sending to?
              </h2>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">RECIPIENTS</span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Audience:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {context?.snapshot.name || 'Authoritative DB Audience'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Selected for Campaign:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {context?.audienceStats.selectedCount.toLocaleString() ?? 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Eligible:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {context?.audienceStats.eligibleCount.toLocaleString() ?? 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Already Sent:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {context?.audienceStats.sentCount.toLocaleString() ?? '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Remaining to Send:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {context?.audienceStats.remainingCount.toLocaleString() ?? 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400">Blocked / Ineligible:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {context?.audienceStats.blockedCount.toLocaleString() ?? '0'}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: WHY ARE WE SENDING? */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-xs font-bold text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                2
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Why are we sending?
              </h2>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">PURPOSE</span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Campaign:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={context?.campaign.name}>
                {context?.campaign.name || 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Template Version:</span>
              <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                <Lock className="h-3 w-3 text-zinc-500" />
                {context?.template.name} v{context?.template.versionNumber}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400">Subject:</span>
              <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 p-2 rounded-lg truncate block" title={context?.template.subject}>
                {context?.template.subject || 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Sender Identity:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {context?.sender.name} &lt;{context?.sender.email}&gt;
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 3: HOW ARE WE SENDING? */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-xs font-bold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                3
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                How are we sending?
              </h2>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">EXECUTION</span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Effective Rate:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {context?.sendingControls.effectiveLimit || '1/min'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Concurrency:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {context?.sendingControls.concurrency || 1}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Delivery Provider:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {context?.sender.provider || 'Brevo SMTP'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Mailing Engine:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {context?.sender.mailingEngine || 'Listmonk'}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400">Orchestrator:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                n8n Webhook Server-to-Server
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 22: VISUAL SUMMARY CHAIN CARD */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="h-4 w-4 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Pipeline Architecture Chain
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">1. Campaign</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">#{context?.campaign.id}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">2. Audience</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{context?.audienceStats.selectedCount} Total</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">3. Snapshot</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">PostgreSQL</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">4. Template</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">v{context?.template.versionNumber} Locked</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">5. Policy</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{context?.sendingControls.effectiveLimit}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-2.5 py-1.5 font-medium dark:border-indigo-800 dark:bg-indigo-950/40">
            <span className="text-[10px] text-indigo-500 uppercase font-mono">6. Orchestrator</span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300">n8n</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">7. Engine</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Listmonk</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">8. SMTP</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Brevo</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium dark:border-emerald-800 dark:bg-emerald-950/40">
            <span className="text-[10px] text-emerald-600 uppercase font-mono">Recipient</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">Inbox</span>
          </div>
        </div>
      </div>

      {/* SECTION 4 & 29: EXECUTION STATUS & N8N HEALTH */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Execution Status Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                n8n Execution Status
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                serviceStatus.currentExecutionStatus === 'RUNNING'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 animate-pulse'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                ● {serviceStatus.currentExecutionStatus}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">n8n Service</span>
              <div className="mt-1 flex items-center gap-1.5 font-bold">
                <span className={`h-2 w-2 rounded-full ${serviceStatus.n8nStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={serviceStatus.n8nStatus === 'CONNECTED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                  {serviceStatus.n8nStatus}
                </span>
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Workflow Status</span>
              <div className="mt-1 font-bold">
                <span className={serviceStatus.workflowStatus === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                  {serviceStatus.workflowStatus}
                </span>
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Last Result</span>
              <div className="mt-1 font-mono font-bold">
                <span className={
                  serviceStatus.lastExecutionResult === 'SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' :
                  serviceStatus.lastExecutionResult === 'FAILED' ? 'text-rose-600 dark:text-rose-400' :
                  'text-zinc-600 dark:text-zinc-400'
                }>
                  {serviceStatus.lastExecutionResult}
                </span>
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Duration</span>
              <div className="mt-1 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                {serviceStatus.lastExecutionDurationMs ? `${(serviceStatus.lastExecutionDurationMs / 1000).toFixed(1)}s` : 'Unavailable'}
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Last Execution</span>
              <div className="mt-1 font-mono text-zinc-700 dark:text-zinc-300">
                {serviceStatus.lastExecutionAt ? new Date(serviceStatus.lastExecutionAt).toLocaleTimeString() : 'Unavailable'}
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Last Success</span>
              <div className="mt-1 font-mono text-emerald-600 dark:text-emerald-400">
                {serviceStatus.lastSuccessfulExecutionAt ? new Date(serviceStatus.lastSuccessfulExecutionAt).toLocaleTimeString() : 'Unavailable'}
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Last Failure</span>
              <div className="mt-1 font-mono text-rose-600 dark:text-rose-400">
                {serviceStatus.lastFailedExecutionAt ? new Date(serviceStatus.lastFailedExecutionAt).toLocaleTimeString() : 'None'}
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-mono text-[10px]">Next Scheduled</span>
              <div className="mt-1 font-mono text-zinc-700 dark:text-zinc-300">
                {serviceStatus.nextScheduledExecution ? new Date(serviceStatus.nextScheduledExecution).toLocaleTimeString() : 'Manual Trigger'}
              </div>
            </div>
          </div>
        </div>

        {/* n8n Connection Health Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Service Connectivity
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 uppercase">HEALTH</span>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">n8n Engine:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {serviceStatus.n8nStatus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Webhook Route:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {serviceStatus.webhookStatus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Listmonk Engine:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {serviceStatus.listmonkStatus}
              </span>
            </div>
            <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Diagnostics:</span>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight">
                {serviceStatus.diagnostics}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5, 13 & 14: ACTIVE CAMPAIGN, SENDING LIMITS & EXECUTION CONTROLS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Campaign Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Campaign Envelope
              </h2>
            </div>
            {context?.campaign.status && (
              <StatusBadge status={context.campaign.status as any} />
            )}
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Campaign ID:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                #{context?.campaign.id} ({context?.campaign.campaign_key})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Max Recipients Cap:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {context?.campaign.max_recipients || 1000}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Scheduled At:</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {context?.campaign.scheduled_at ? new Date(context.campaign.scheduled_at).toLocaleString() : 'Immediate / Manual'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Started At:</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {context?.campaign.started_at ? new Date(context.campaign.started_at).toLocaleString() : 'Not started'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Retry Policy:</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Max 3 attempts (Exponential backoff)
              </span>
            </div>

            {/* Campaign lifecycle quick buttons */}
            <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {context?.campaign.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handleCampaignAction('start')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-600 py-1.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Start Campaign (Enable Sending)
                </button>
              )}
              {context?.campaign.status === 'running' && (
                <button
                  type="button"
                  onClick={() => handleCampaignAction('pause')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              )}
              {context?.campaign.status === 'paused' && (
                <button
                  type="button"
                  onClick={() => handleCampaignAction('resume')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </button>
              )}
              {context?.campaign.status !== 'cancelled' && context?.campaign.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => handleCampaignAction('cancel')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 cursor-pointer"
                >
                  <Ban className="h-3.5 w-3.5 text-rose-500" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sending Controls Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Sending Limits & Rate Safety
              </h2>
            </div>
            <span className="font-mono text-[10px] text-zinc-400 uppercase">ENFORCED IN DB</span>
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Global Rate Limit:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {context?.sendingControls.globalLimit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Campaign Limit:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {context?.sendingControls.campaignLimit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Provider Limit:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {context?.sendingControls.providerLimit}
              </span>
            </div>
            <div className="flex justify-between rounded-lg bg-emerald-50/60 p-2 dark:bg-emerald-950/20">
              <span className="font-semibold text-emerald-900 dark:text-emerald-300">Effective Active Rate:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {context?.sendingControls.effectiveLimit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Concurrency:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {context?.sendingControls.concurrency} concurrent
              </span>
            </div>

            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
              {context?.sendingControls.explanation}
            </p>
          </div>
        </div>

        {/* Execution Controls & Execute Now Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Execution Controls
              </h2>
            </div>
            <span className="font-mono text-[10px] text-zinc-400 uppercase">
              {webhookStatus === 'connected' ? 'WEBHOOK UNLOCKED' : 'LOCKED'}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {/* Lockout Notice if Webhook not connected */}
            {webhookStatus !== 'connected' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-900 dark:text-amber-200">
                      Campaign Dispatch Locked
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      You must activate listening and connect the n8n webhook above before you can run campaign dispatches.
                    </p>
                    <button
                      type="button"
                      onClick={() => handlePingWebhook()}
                      className="mt-1 inline-flex items-center gap-1 font-bold text-amber-900 underline hover:text-amber-700 dark:text-amber-200 cursor-pointer"
                    >
                      <Zap className="h-3 w-3" /> Connect &amp; Ping Webhook Now
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Webhook Verified &amp; Ready</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300 truncate font-mono">
                  Target: {webhookUrl}
                </p>
              </div>
            )}

            {/* Draft Campaign Notice & Quick Start */}
            {context?.campaign.status === 'draft' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-900 dark:text-amber-200">
                      Campaign is in DRAFT Status
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      PostgreSQL safety rules strictly block sending slots from being claimed while a campaign is in Draft. Click below to start the campaign:
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCampaignAction('start')}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer transition active:scale-95"
                    >
                      <Play className="h-3 w-3 fill-current" /> Start Campaign Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Live Full Dispatch Progress */}
            {isFullDispatchRunning && dispatchProgress && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-2">
                <div className="flex justify-between font-semibold text-indigo-900 dark:text-indigo-200">
                  <span>Dispatching All Queued Recipients...</span>
                  <span className="font-mono">
                    {dispatchProgress.current} / {dispatchProgress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((dispatchProgress.current / (dispatchProgress.total || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-indigo-800 dark:text-indigo-300 font-mono">
                  <span>Sent: {dispatchProgress.sent}</span>
                  <span>Failed: {dispatchProgress.failed}</span>
                  <span>Blocked: {dispatchProgress.blocked}</span>
                </div>
                <button
                  type="button"
                  onClick={handleStopDispatch}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                >
                  <Square className="h-3 w-3 fill-current" /> Stop Dispatch
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Button 1: Single Slot */}
              <button
                type="button"
                onClick={handleExecuteNow}
                disabled={isExecuting || isExecutionBlocked || webhookStatus !== 'connected' || isFullDispatchRunning}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold shadow-xs transition-all ${
                  isExecutionBlocked || webhookStatus !== 'connected' || isFullDispatchRunning
                    ? 'cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-500 dark:hover:bg-emerald-600 cursor-pointer'
                }`}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Execute 1 Slot
                  </>
                )}
              </button>

              {/* Button 2: Full Campaign Queue Dispatch */}
              <button
                type="button"
                onClick={handleRunFullCampaign}
                disabled={isExecuting || isExecutionBlocked || webhookStatus !== 'connected' || isFullDispatchRunning || (context?.audienceStats.queuedCount || 0) === 0}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold shadow-xs transition-all ${
                  isExecutionBlocked || webhookStatus !== 'connected' || isFullDispatchRunning || (context?.audienceStats.queuedCount || 0) === 0
                    ? 'cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer'
                }`}
                title={`Run dispatch for all ${context?.audienceStats.queuedCount || 0} queued recipients`}
              >
                {isFullDispatchRunning ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Run All Queued ({context?.audienceStats.queuedCount || 0})
                  </>
                )}
              </button>
            </div>

            {isExecutionBlocked && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Execution blocked by pre-flight or campaign state.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 6 & 19: TEMPLATE CONTROL & PRE-FLIGHT CHECKS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Template Control Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-purple-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Template Control & Version Lock
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <Lock className="h-3 w-3" />
                Template Locked: v{context?.template.versionNumber}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Template Name:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {context?.template.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Subject Line:</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100">
                {context?.template.subject}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Variables Used:</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {context?.template.variables.map((v) => (
                  <span
                    key={v}
                    className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview Box */}
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="flex items-center justify-between pb-2">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Template Preview</span>
                <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 p-0.5 text-[11px]">
                  <button
                    onClick={() => setPreviewTab('html')}
                    className={`px-2 py-0.5 rounded ${previewTab === 'html' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold' : 'text-zinc-500'}`}
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => setPreviewTab('text')}
                    className={`px-2 py-0.5 rounded ${previewTab === 'text' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold' : 'text-zinc-500'}`}
                  >
                    Plain Text
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {previewTab === 'html'
                  ? context?.template.htmlContent || '<html><body><p>Hello {{first_name}}, this is {{sender_name}} from First Client...</p></body></html>'
                  : context?.template.textContent || 'Hello {{first_name}},\n\nThis is {{sender_name}} from First Client...\n\nUnsubscribe: {{unsubscribe_url}}'}
              </div>
            </div>
          </div>
        </div>

        {/* Pre-Flight Checks Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Pre-Flight Safety Checks
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {context?.preflight.canExecute ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  SAFE TO EXECUTE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                  <XCircle className="h-3.5 w-3.5" />
                  BLOCKED ({context?.preflight.blockingIssuesCount})
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
            {context?.preflight.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-start justify-between rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                <div className="flex items-start gap-2">
                  {check.status === 'PASS' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {check.status === 'WARNING' && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  {check.status === 'BLOCKED' && (
                    <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{check.name}</span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{check.message}</p>
                  </div>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    check.status === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : check.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {check.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 7 & 8: RECIPIENT / AUDIENCE BREAKDOWN */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Recipient Classification & Eligibility Breakdown
            </h2>
          </div>
          <span className="font-mono text-xs text-zinc-400">
            SNAPSHOT: {context?.snapshot.id}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 text-xs">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Audience</span>
            <div className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {context?.audienceStats.totalAudience.toLocaleString()}
            </div>
            <span className="text-[10px] text-zinc-400">contacts</span>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <span className="text-[10px] font-mono text-emerald-700 uppercase">Eligible</span>
            <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {context?.audienceStats.eligibleCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-600">can send</span>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
            <span className="text-[10px] font-mono text-rose-700 uppercase">Blocked</span>
            <div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-400">
              {context?.audienceStats.blockedCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-rose-600">disqualified</span>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Selected</span>
            <div className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {context?.audienceStats.selectedCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-zinc-400">in queue</span>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <span className="text-[10px] font-mono text-blue-700 uppercase">Sent</span>
            <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-400">
              {context?.audienceStats.sentCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-blue-600">completed</span>
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <span className="text-[10px] font-mono text-indigo-700 uppercase">Remaining</span>
            <div className="mt-1 text-lg font-bold text-indigo-700 dark:text-indigo-400">
              {context?.audienceStats.remainingCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-indigo-600">pending</span>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <span className="text-[10px] font-mono text-amber-700 uppercase">Failed/Retry</span>
            <div className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-400">
              {((context?.audienceStats.failedCount || 0) + (context?.audienceStats.retryingCount || 0)).toLocaleString()}
            </div>
            <span className="text-[10px] text-amber-600">issues</span>
          </div>
        </div>

        {/* Blocked reasons breakdown */}
        <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Disqualification Breakdown (PostgreSQL Authority):
          </span>
          <div className="mt-2 flex flex-wrap gap-4 text-zinc-600 dark:text-zinc-400">
            <span>Unsubscribed: <strong className="text-zinc-900 dark:text-zinc-100">{context?.audienceStats.blockedBreakdown.unsubscribed || 0}</strong></span>
            <span>Suppressed: <strong className="text-zinc-900 dark:text-zinc-100">{context?.audienceStats.blockedBreakdown.suppressed || 0}</strong></span>
            <span>Hard Bounced: <strong className="text-zinc-900 dark:text-zinc-100">{context?.audienceStats.blockedBreakdown.hardBounce || 0}</strong></span>
            <span>Complaints: <strong className="text-zinc-900 dark:text-zinc-100">{context?.audienceStats.blockedBreakdown.complaint || 0}</strong></span>
            <span>No Consent: <strong className="text-zinc-900 dark:text-zinc-100">{context?.audienceStats.blockedBreakdown.noConsent || 0}</strong></span>
            <span>Invalid/Missing Email: <strong className="text-zinc-900 dark:text-zinc-100">{(context?.audienceStats.blockedBreakdown.invalidEmail || 0) + (context?.audienceStats.blockedBreakdown.noEmail || 0)}</strong></span>
          </div>
        </div>
      </div>

      {/* SECTION 9: RECIPIENT TABLE WITH SERVER-SIDE PAGINATION */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Authoritative Campaign Recipients ({totalRecipients.toLocaleString()})
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click any row to open the eligibility explanation drawer
              </p>
            </div>

            {/* Table Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search name, email, company..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-2.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 w-48 sm:w-56"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-800 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Campaign Statuses</option>
                <option value="queued">Queued</option>
                <option value="sending">Sending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={eligibilityFilter}
                onChange={(e) => {
                  setEligibilityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-800 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Eligibility</option>
                <option value="eligible">Eligible Only</option>
                <option value="blocked">Blocked Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Company & Role</th>
                <th className="px-4 py-3">Emails Sent</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Validation</th>
                <th className="px-4 py-3">Eligibility</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Last Attempt</th>
                <th className="px-4 py-3">Provider Msg ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recipientsLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    <RefreshCw className="inline h-4 w-4 animate-spin mr-2" />
                    Querying PostgreSQL recipient state...
                  </td>
                </tr>
              ) : recipients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    No recipients match the selected criteria.
                  </td>
                </tr>
              ) : (
                recipients.map((r) => (
                  <tr
                    key={r.recipientId}
                    onClick={() => handleOpenRecipient(r.recipientId)}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          r.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : r.status === 'sending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                            : r.status === 'failed'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.firstName} {r.lastName}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {r.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-800 dark:text-zinc-200 font-medium">{r.company || '—'}</div>
                      <div className="text-[11px] text-zinc-500">{r.title || r.country || '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        (r.emails_sent_count || 0) > 0
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <Mail className="h-3 w-3" />
                        {r.emails_sent_count || 0} sent
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.consentStatus === 'granted' || r.consentStatus === 'implied'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                        }`}
                      >
                        {r.consentStatus || 'none'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                        {r.validationStatus || 'valid'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {r.eligibilityStatus === 'eligible' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          )}
                          <span className="truncate max-w-[90px] text-[11px] text-zinc-600 dark:text-zinc-400" title={r.eligibilityReason}>
                            {r.eligibilityReason || r.eligibilityStatus}
                          </span>
                        </div>
                        {r.eligibilityStatus === 'eligible' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleContactBlock(r.contactId, true)}
                            disabled={isTogglingBlockId === r.contactId}
                            className="rounded px-2 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Block contact from receiving emails"
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleContactBlock(r.contactId, false)}
                            disabled={isTogglingBlockId === r.contactId}
                            className="rounded px-2 py-0.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            title="Unblock contact and restore eligibility"
                          >
                            Unblock
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      {r.attemptCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500">
                      {r.lastAttemptAt ? new Date(r.lastAttemptAt).toLocaleTimeString() : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-400 max-w-[120px] truncate">
                      {r.providerMessageId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages} ({totalRecipients} total recipients)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 px-3 py-1 font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-200 px-3 py-1 font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 17: RECENT EXECUTIONS & TIMELINE TRIGGER */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Recent n8n Execution Activity (Last {executions.length})
              </h2>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Click any execution to inspect the 14-stage executor timeline
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Execution ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recipient Processed</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Result / Reason</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                    No executions recorded yet. Click &quot;Execute Now&quot; to run cycle 1.
                  </td>
                </tr>
              ) : (
                executions.map((ex) => (
                  <tr
                    key={ex.id}
                    onClick={() => setActiveExecutionTimeline(ex)}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {ex.executionId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ex.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : ex.status === 'NO_SEND'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : ex.status === 'BLOCKED'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {ex.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                      {ex.recipientEmail}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500">
                      {new Date(ex.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                      {ex.duration}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {ex.provider}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 truncate max-w-xs">
                      {ex.result}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveExecutionTimeline(ex);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Timeline <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 10 & 11: RECIPIENT DETAIL DRAWER (WHY IS THIS PERSON RECEIVING?) */}
      {activeRecipientId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/60 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400">Recipient Inspection</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {recipientDetail ? `${recipientDetail.first_name} ${recipientDetail.last_name}` : 'Loading...'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveRecipientId(null);
                  setRecipientDetail(null);
                }}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {detailLoading || !recipientDetail ? (
                <div className="flex items-center justify-center py-12 text-zinc-500">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Evaluating PostgreSQL eligibility criteria...
                </div>
              ) : (
                <>
                  {/* Identity Box */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Email:</span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {recipientDetail.email_normalized}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Company:</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {recipientDetail.company}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Role & Title:</span>
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {recipientDetail.title || 'Executive'} ({recipientDetail.seniority || 'Senior'})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Location:</span>
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {[recipientDetail.city, recipientDetail.state, recipientDetail.country].filter(Boolean).join(', ') || 'Global'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-200/60 pt-2 dark:border-zinc-700/60">
                      <span className="text-zinc-500">Total Lifetime Emails Sent:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {recipientDetail.emails_sent_count || 0} sent
                      </span>
                    </div>
                  </div>

                  {/* Contact Block Status Quick Toggle Card */}
                  <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Eligibility State:
                      </span>
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        recipientDetail.eligibility_status === 'eligible'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {recipientDetail.eligibility_status === 'eligible' ? 'Eligible' : 'Blocked'}
                      </span>
                    </div>
                    {recipientDetail.eligibility_status === 'eligible' ? (
                      <button
                        type="button"
                        onClick={() => handleToggleContactBlock(recipientDetail.contact_id, true)}
                        disabled={isTogglingBlockId === recipientDetail.contact_id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 transition cursor-pointer"
                      >
                        {isTogglingBlockId === recipientDetail.contact_id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserX className="h-3.5 w-3.5" />
                        )}
                        Block Contact (Mark Ineligible)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleContactBlock(recipientDetail.contact_id, false)}
                        disabled={isTogglingBlockId === recipientDetail.contact_id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition cursor-pointer"
                      >
                        {isTogglingBlockId === recipientDetail.contact_id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        Unblock Contact (Restore Eligibility)
                      </button>
                    )}
                  </div>

                  {/* SECTION 11: WHY IS THIS PERSON RECEIVING / BLOCKED? */}
                  <div className={`rounded-xl border p-4 ${
                    recipientDetail.eligibility_status === 'eligible'
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                      : 'border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      {recipientDetail.eligibility_status === 'eligible' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                            Why this recipient is eligible
                          </h4>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-rose-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
                            Why this recipient is blocked
                          </h4>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      {recipientDetail.explanationItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          {item.passed ? (
                            <span className="font-bold text-emerald-600">✓</span>
                          ) : (
                            <span className="font-bold text-rose-600">✕</span>
                          )}
                          <div>
                            <span className={`font-semibold ${item.passed ? 'text-zinc-900 dark:text-zinc-100' : 'text-rose-900 dark:text-rose-300'}`}>
                              {item.label}
                            </span>
                            {item.details && (
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Campaign Recipient Status */}
                  <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Campaign Execution Status</span>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Status:</span>
                      <span className="font-mono font-bold uppercase text-zinc-900 dark:text-zinc-100">
                        {recipientDetail.campaign_recipient_status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Attempt Count:</span>
                      <span className="font-mono font-bold">{recipientDetail.attempt_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Provider Message ID:</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[250px]">
                        {recipientDetail.provider_message_id || 'None'}
                      </span>
                    </div>
                    {recipientDetail.last_error && (
                      <div className="rounded bg-rose-50 p-2 font-mono text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        Last Error: {recipientDetail.last_error}
                      </div>
                    )}
                  </div>

                  {/* Send Attempts History */}
                  <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Send Attempt History</span>
                    {recipientDetail.attempts.length === 0 ? (
                      <p className="text-zinc-500">No send attempts initiated yet for this recipient.</p>
                    ) : (
                      recipientDetail.attempts.map((att) => (
                        <div
                          key={att.id}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800 space-y-1"
                        >
                          <div className="flex justify-between font-mono font-semibold">
                            <span>Attempt #{att.attempt_number}</span>
                            <span className={att.status === 'sent' ? 'text-emerald-600' : 'text-rose-600'}>
                              {att.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-zinc-500">
                            <span>Provider: {att.provider}</span>
                            <span>{new Date(att.started_at).toLocaleTimeString()}</span>
                          </div>
                          {att.error_message && (
                            <p className="font-mono text-[10px] text-rose-600">{att.error_message}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 18: EXECUTION TIMELINE MODAL */}
      {activeExecutionTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400">14-Stage Executor Pipeline</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Execution {activeExecutionTimeline.executionId}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      activeExecutionTimeline.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {activeExecutionTimeline.status}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setActiveExecutionTimeline(null)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Timeline Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800 flex justify-between font-mono text-zinc-600 dark:text-zinc-300">
                <span>Recipient: {activeExecutionTimeline.recipientEmail}</span>
                <span>Duration: {activeExecutionTimeline.duration}</span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {activeExecutionTimeline.timeline.length > 0 ? (
                  activeExecutionTimeline.timeline.map((stage, idx) => (
                    <div key={idx} className="relative">
                      <span
                        className={`absolute -left-6 top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-zinc-900 ${
                          stage.status === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : stage.status === 'SKIPPED'
                            ? 'bg-zinc-400'
                            : 'bg-rose-500'
                        }`}
                      />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{stage.stage}</span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {new Date(stage.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {stage.details && (
                        <p className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {stage.details}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  // Default 14 stages template if legacy record
                  [
                    'Configuration Loaded',
                    'Configuration Validated',
                    'Stale Sends Recovered',
                    'Campaign Activated',
                    'Campaign Loaded',
                    'Campaign Active Check',
                    'Real Send Gate',
                    'Send Slot Claimed (FOR UPDATE SKIP LOCKED)',
                    'Send Attempt Created',
                    'Send Context Loaded',
                    'Context Validated',
                    'Listmonk Send Executed',
                    'Provider Result Recorded',
                    'PostgreSQL Result Updated',
                    'Campaign Finalization Evaluated',
                  ].map((stageName, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{stageName}</span>
                        <span className="font-mono text-[10px] text-emerald-600">PASSED</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 16: LAST EXECUTION RESULT MODAL */}
      {lastExecutionResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Execution Cycle Finished
                </h3>
              </div>
              <button
                onClick={() => setLastExecutionResultModal(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Execution ID:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {String(lastExecutionResultModal.executionId)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {String(lastExecutionResultModal.status)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Recipient Processed:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {(lastExecutionResultModal.recipient as any)?.email || 'None (no slot available)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Attempt Count:</span>
                <span className="font-mono font-bold">
                  {String(lastExecutionResultModal.attemptNumber || 1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Duration:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {String(lastExecutionResultModal.durationMs)}ms
                </span>
              </div>
              <div className="rounded bg-zinc-50 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {String(lastExecutionResultModal.resultMessage)}
              </div>
            </div>

            <button
              onClick={() => setLastExecutionResultModal(null)}
              className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Close & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
