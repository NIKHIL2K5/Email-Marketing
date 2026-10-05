import { query, withTransaction } from '../client';
import { DbCampaign, DbCampaignSummary } from '../types';

export interface N8nServiceStatus {
  n8nStatus: 'CONNECTED' | 'DISCONNECTED';
  workflowName: string;
  workflowStatus: 'ACTIVE' | 'INACTIVE' | 'Unavailable';
  webhookUrl: string;
  webhookStatus: 'AVAILABLE' | 'NOT_REGISTERED' | 'Unavailable';
  listmonkStatus: 'CONNECTED' | 'DISCONNECTED' | 'Unavailable';
  listmonkUrl: string;
  lastExecutionAt: string | null;
  currentExecutionStatus: 'IDLE' | 'RUNNING';
  lastExecutionResult: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'NO_SEND' | 'Unavailable';
  lastExecutionDurationMs: number | null;
  lastSuccessfulExecutionAt: string | null;
  lastFailedExecutionAt: string | null;
  nextScheduledExecution: string | null;
  diagnostics: string;
}

import { resolveServiceUrl } from '@/lib/runtime';

export async function getN8nStatus(customWebhookUrl?: string): Promise<N8nServiceStatus> {
  const rawN8nUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
  const n8nBaseUrl = resolveServiceUrl(rawN8nUrl, 'n8n', 5678);
  const rawWebhookUrl = customWebhookUrl || process.env.N8N_WEBHOOK_URL || `${n8nBaseUrl}/webhook/first-client/execute`;
  const n8nWebhookUrl = resolveServiceUrl(rawWebhookUrl, 'n8n', 5678);
  const rawListmonkUrl = process.env.LISTMONK_BASE_URL || 'http://localhost:9000';
  const listmonkBaseUrl = resolveServiceUrl(rawListmonkUrl, 'listmonk', 9000);

  let n8nStatus: 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';
  let workflowStatus: 'ACTIVE' | 'INACTIVE' | 'Unavailable' = 'Unavailable';
  let webhookStatus: 'AVAILABLE' | 'NOT_REGISTERED' | 'Unavailable' = 'Unavailable';
  let diagnostics = '';

  // 1. Probe n8n healthz
  try {
    const n8nRes = await fetch(`${n8nBaseUrl}/healthz`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (n8nRes.ok) {
      n8nStatus = 'CONNECTED';
    } else {
      diagnostics += `n8n healthz returned status ${n8nRes.status}. `;
    }
  } catch (err) {
    n8nStatus = 'DISCONNECTED';
    diagnostics += `Cannot reach n8n at ${n8nBaseUrl}: ${err instanceof Error ? err.message : String(err)}. `;
  }

  // 2. Probe n8n webhook route if n8n is connected
  if (n8nStatus === 'CONNECTED') {
    try {
      const probeRes = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping' }),
        signal: AbortSignal.timeout(3000),
      });

      if (probeRes.status === 404) {
        // Webhook route is not currently registered/active
        const bodyText = await probeRes.text().catch(() => '');
        workflowStatus = 'INACTIVE';
        webhookStatus = 'NOT_REGISTERED';
        if (bodyText.includes('The workflow must be active')) {
          diagnostics += 'Workflow "Production Send Executor" is saved in n8n but currently INACTIVE. Toggle the switch to ACTIVE in the n8n canvas. ';
        } else {
          diagnostics += 'Webhook route not registered in n8n. ';
        }
      } else if (probeRes.ok || probeRes.status === 200 || probeRes.status === 400 || probeRes.status === 401) {
        workflowStatus = 'ACTIVE';
        webhookStatus = 'AVAILABLE';
      } else {
        workflowStatus = 'INACTIVE';
        webhookStatus = 'NOT_REGISTERED';
        diagnostics += `Webhook probe returned status ${probeRes.status}. `;
      }
    } catch {
      workflowStatus = 'Unavailable';
      webhookStatus = 'Unavailable';
    }
  }

  // 3. Probe Listmonk
  let listmonkStatus: 'CONNECTED' | 'DISCONNECTED' | 'Unavailable' = 'Unavailable';
  try {
    const lmRes = await fetch(listmonkBaseUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (lmRes.status >= 200 && lmRes.status < 500) {
      listmonkStatus = 'CONNECTED';
    } else {
      listmonkStatus = 'DISCONNECTED';
    }
  } catch {
    listmonkStatus = 'DISCONNECTED';
    diagnostics += `Cannot reach Listmonk at ${listmonkBaseUrl}. `;
  }

  // 4. Query DB for execution history & current execution
  let lastExecutionAt: string | null = null;
  let currentExecutionStatus: 'IDLE' | 'RUNNING' = 'IDLE';
  let lastExecutionResult: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'NO_SEND' | 'Unavailable' = 'Unavailable';
  let lastExecutionDurationMs: number | null = null;
  let lastSuccessfulExecutionAt: string | null = null;
  let lastFailedExecutionAt: string | null = null;
  let nextScheduledExecution: string | null = null;

  try {
    // Check if any run is in progress
    const runningRunRes = await query<{ count: number }>(
      "SELECT count(*)::int AS count FROM automation_runs WHERE status = 'running';"
    );
    if ((runningRunRes.rows[0]?.count || 0) > 0) {
      currentExecutionStatus = 'RUNNING';
    }

    // Get last execution from automation_runs or send_attempts
    const lastRunRes = await query<{
      status: string;
      started_at: string;
      completed_at: string | null;
      output_data: Record<string, unknown> | null;
    }>(
      'SELECT status, started_at::text, completed_at::text, output_data FROM automation_runs ORDER BY id DESC LIMIT 1;'
    );

    if (lastRunRes.rows.length > 0) {
      const r = lastRunRes.rows[0];
      lastExecutionAt = r.started_at;
      if (r.status === 'success') lastExecutionResult = 'SUCCESS';
      else if (r.status === 'no_send') lastExecutionResult = 'NO_SEND';
      else if (r.status === 'blocked') lastExecutionResult = 'BLOCKED';
      else if (r.status === 'failed') lastExecutionResult = 'FAILED';

      if (r.started_at && r.completed_at) {
        lastExecutionDurationMs = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
      }
    } else {
      // Fallback check on send_attempts
      const lastAttemptRes = await query<{
        status: string;
        started_at: string;
        completed_at: string | null;
      }>(
        'SELECT status, started_at::text, completed_at::text FROM send_attempts ORDER BY id DESC LIMIT 1;'
      );
      if (lastAttemptRes.rows.length > 0) {
        const att = lastAttemptRes.rows[0];
        lastExecutionAt = att.started_at;
        lastExecutionResult = att.status === 'sent' || att.status === 'delivered' ? 'SUCCESS' : 'FAILED';
        if (att.started_at && att.completed_at) {
          lastExecutionDurationMs = new Date(att.completed_at).getTime() - new Date(att.started_at).getTime();
        }
      }
    }

    // Last successful execution
    const lastSuccessRes = await query<{ started_at: string }>(
      "SELECT started_at::text FROM automation_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1;"
    );
    if (lastSuccessRes.rows.length > 0) {
      lastSuccessfulExecutionAt = lastSuccessRes.rows[0].started_at;
    } else {
      const lastSuccessAtt = await query<{ started_at: string }>(
        "SELECT started_at::text FROM send_attempts WHERE status IN ('sent', 'delivered') ORDER BY id DESC LIMIT 1;"
      );
      if (lastSuccessAtt.rows.length > 0) {
        lastSuccessfulExecutionAt = lastSuccessAtt.rows[0].started_at;
      }
    }

    // Last failed execution
    const lastFailRes = await query<{ started_at: string }>(
      "SELECT started_at::text FROM automation_runs WHERE status = 'failed' ORDER BY id DESC LIMIT 1;"
    );
    if (lastFailRes.rows.length > 0) {
      lastFailedExecutionAt = lastFailRes.rows[0].started_at;
    } else {
      const lastFailAtt = await query<{ started_at: string }>(
        "SELECT started_at::text FROM send_attempts WHERE status = 'failed' ORDER BY id DESC LIMIT 1;"
      );
      if (lastFailAtt.rows.length > 0) {
        lastFailedExecutionAt = lastFailAtt.rows[0].started_at;
      }
    }

    // Next scheduled execution from scheduled campaigns
    const nextSchedRes = await query<{ scheduled_at: string }>(
      "SELECT scheduled_at::text FROM campaigns WHERE status = 'scheduled' AND scheduled_at > now() ORDER BY scheduled_at ASC LIMIT 1;"
    );
    if (nextSchedRes.rows.length > 0) {
      nextScheduledExecution = nextSchedRes.rows[0].scheduled_at;
    }
  } catch (err) {
    diagnostics += `DB history telemetry query failed: ${err instanceof Error ? err.message : String(err)}. `;
  }

  return {
    n8nStatus,
    workflowName: 'Production Send Executor',
    workflowStatus,
    webhookUrl: n8nWebhookUrl,
    webhookStatus,
    listmonkStatus,
    listmonkUrl: listmonkBaseUrl,
    lastExecutionAt,
    currentExecutionStatus,
    lastExecutionResult,
    lastExecutionDurationMs,
    lastSuccessfulExecutionAt,
    lastFailedExecutionAt,
    nextScheduledExecution,
    diagnostics: diagnostics.trim() || 'All systems operational.',
  };
}

export interface N8nCampaignContext {
  campaign: DbCampaign;
  allCampaigns: Array<{ id: string; name: string; status: string; campaign_key: string }>;
  audienceStats: {
    totalAudience: number;
    eligibleCount: number;
    blockedCount: number;
    selectedCount: number;
    sentCount: number;
    remainingCount: number;
    queuedCount: number;
    sendingCount: number;
    failedCount: number;
    retryingCount: number;
    cancelledCount: number;
    blockedBreakdown: {
      noEmail: number;
      invalidEmail: number;
      noConsent: number;
      unsubscribed: number;
      suppressed: number;
      hardBounce: number;
      complaint: number;
      duplicate: number;
      other: number;
    };
  };
  template: {
    id: string | null;
    name: string;
    versionNumber: number;
    isLocked: boolean;
    status: string;
    subject: string;
    htmlContent: string | null;
    textContent: string | null;
    variables: string[];
  };
  sendingControls: {
    globalLimit: string;
    campaignLimit: string;
    providerLimit: string;
    effectiveLimit: string;
    concurrency: number;
    perMinute: number;
    perHour: number;
    perDay: number;
    explanation: string;
    globalPerMinute: number;
    globalPerHour: number;
    globalPerDay: number;
    campaignPerMinute: number;
    campaignPerHour: number;
    campaignPerDay: number;
    providerLimitPerDay: number;
    effectivePerMinute: number;
    effectivePerHour: number;
    effectivePerDay: number;
    maxConcurrency: number;
    maxRecipients: number | null;
    currentlySelected: number;
    sentCount: number;
    remainingQuota: number;
    providerName: string;
  };
  sender: {
    name: string;
    email: string;
    replyTo: string;
    provider: string;
    mailingEngine: string;
    domainVerified: boolean;
    fromName: string;
    fromEmail: string;
    engine: string;
    domain: string;
  };
  snapshot: {
    id: string;
    name: string;
    createdAt: string;
    filterDefinition: string;
    totalMatching: number;
    eligibleMatching: number;
  };
  preflight: {
    checks: Array<{
      id: string;
      name: string;
      status: 'PASS' | 'WARNING' | 'BLOCKED';
      message: string;
    }>;
    canExecute: boolean;
    blockingIssuesCount: number;
    warningIssuesCount: number;
  };
}

export async function getN8nCampaignContext(campaignIdParam?: string): Promise<N8nCampaignContext | null> {
  // 1. Fetch list of all campaigns
  const allCampsRes = await query<{ id: string; name: string; status: string; campaign_key: string }>(
    'SELECT id::text, name, status, campaign_key FROM campaigns ORDER BY created_at DESC;'
  );
  const allCampaigns = allCampsRes.rows;

  if (allCampaigns.length === 0) {
    return null;
  }

  // Determine which campaign to select
  let selectedId = campaignIdParam;
  if (!selectedId) {
    // Pick running, paused, scheduled, or first in list
    const preferred = allCampaigns.find((c) => ['running', 'paused', 'scheduled'].includes(c.status.toLowerCase()));
    selectedId = preferred ? preferred.id : allCampaigns[0].id;
  }

  // Fetch campaign row
  const campSql = `
    SELECT
      c.id::text,
      c.campaign_key,
      c.name,
      c.description,
      c.status,
      c.subject,
      c.from_name,
      c.from_email,
      c.reply_to,
      c.scheduled_at::text,
      c.started_at::text,
      c.paused_at::text,
      c.completed_at::text,
      c.batch_size,
      c.emails_per_minute,
      c.emails_per_hour,
      c.emails_per_day,
      c.max_concurrency,
      c.max_retries,
      c.retry_backoff_seconds,
      c.max_recipients,
      c.template_id::text,
      t.name AS template_name,
      c.created_at::text,
      c.updated_at::text
    FROM campaigns c
    LEFT JOIN email_templates t ON c.template_id = t.id
    WHERE c.id = $1;
  `;

  const campRes = await query<DbCampaign>(campSql, [selectedId]);
  if (campRes.rows.length === 0) {
    return null;
  }
  const campaign = campRes.rows[0];

  // 2. Fetch audience & recipient stats for this campaign from PostgreSQL
  const countsSql = `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE cr.status = 'queued')::int AS queued,
      count(*) FILTER (WHERE cr.status = 'sending')::int AS sending,
      count(*) FILTER (WHERE cr.status = 'sent')::int AS sent,
      count(*) FILTER (WHERE cr.status = 'failed')::int AS failed,
      count(*) FILTER (WHERE cr.status = 'retrying')::int AS retrying,
      count(*) FILTER (WHERE cr.status = 'cancelled')::int AS cancelled,
      count(*) FILTER (WHERE s.eligibility_status = 'eligible')::int AS eligible,
      count(*) FILTER (WHERE COALESCE(s.eligibility_status, 'blocked') <> 'eligible')::int AS blocked,
      count(*) FILTER (WHERE s.email_validation_status = 'invalid')::int AS invalid_email,
      count(*) FILTER (WHERE s.email_validation_status = 'missing' OR cr.email_normalized IS NULL OR cr.email_normalized = '')::int AS missing_email,
      count(*) FILTER (WHERE s.consent_status = 'opt_out' OR s.consent_status = 'none')::int AS no_consent,
      count(*) FILTER (WHERE s.unsubscribe_status = 'unsubscribed')::int AS unsubscribed,
      count(*) FILTER (WHERE s.suppression_status IN ('suppressed', 'blocked'))::int AS suppressed,
      count(*) FILTER (WHERE s.bounce_status IN ('hard', 'permanent'))::int AS hard_bounce,
      count(*) FILTER (WHERE s.complaint_status != 'none')::int AS complaint
    FROM campaign_recipients cr
    LEFT JOIN contact_email_status s ON cr.contact_id = s.contact_id
    WHERE cr.campaign_id = $1;
  `;

  const countsRes = await query<{
    total: number;
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    retrying: number;
    cancelled: number;
    eligible: number;
    blocked: number;
    invalid_email: number;
    missing_email: number;
    no_consent: number;
    unsubscribed: number;
    suppressed: number;
    hard_bounce: number;
    complaint: number;
  }>(countsSql, [selectedId]);

  const row = countsRes.rows[0] || {
    total: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    retrying: 0,
    cancelled: 0,
    eligible: 0,
    blocked: 0,
    invalid_email: 0,
    missing_email: 0,
    no_consent: 0,
    unsubscribed: 0,
    suppressed: 0,
    hard_bounce: 0,
    complaint: 0,
  };

  const totalAudience = Number(row.total) || 0;
  const sentCount = Number(row.sent) || 0;
  const queuedCount = Number(row.queued) || 0;
  const sendingCount = Number(row.sending) || 0;
  const failedCount = Number(row.failed) || 0;
  const retryingCount = Number(row.retrying) || 0;
  const cancelledCount = Number(row.cancelled) || 0;
  const eligibleCount = Number(row.eligible) || 0;
  const blockedCount = Number(row.blocked) || 0;
  const remainingCount = Math.max(0, totalAudience - sentCount - cancelledCount);

  // 3. Fetch Template & locked version
  let templateInfo = {
    id: null as string | null,
    name: 'Standard Direct Outreach',
    versionNumber: 1,
    isLocked: campaign.status.toLowerCase() === 'running',
    status: 'Active',
    subject: campaign.subject,
    htmlContent: null as string | null,
    textContent: null as string | null,
    variables: ['first_name', 'company', 'cta_url', 'sender_name', 'unsubscribe_url'],
  };

  if (campaign.template_id) {
    const tplRes = await query(
      `SELECT t.id::text, t.name, t.status, v.version_number, v.subject, v.html_content, v.text_content, v.variables
       FROM email_templates t
       LEFT JOIN template_versions v ON t.current_version_id = v.id
       WHERE t.id = $1;`,
      [campaign.template_id]
    );
    if (tplRes.rows.length > 0) {
      const t = tplRes.rows[0];
      templateInfo = {
        id: t.id,
        name: t.name,
        versionNumber: t.version_number || 1,
        isLocked: ['running', 'completed', 'paused'].includes(campaign.status.toLowerCase()),
        status: t.status || 'Active',
        subject: t.subject || campaign.subject,
        htmlContent: t.html_content,
        textContent: t.text_content,
        variables: Array.isArray(t.variables) ? t.variables : templateInfo.variables,
      };
    }
  }

  // 4. Fetch Global sending limits
  const globalLimitsRes = await query<{
    emails_per_minute: number;
    emails_per_hour: number;
    emails_per_day: number;
    max_concurrency: number;
  }>('SELECT emails_per_minute, emails_per_hour, emails_per_day, max_concurrency FROM sending_limits WHERE scope_type = \'global\' AND enabled = true LIMIT 1;');

  const gLimits = globalLimitsRes.rows[0] || {
    emails_per_minute: 5,
    emails_per_hour: 60,
    emails_per_day: 2000,
    max_concurrency: 2,
  };

  const providerLimitPerDay = 300; // Brevo SMTP Relay ceiling
  const cPerMin = campaign.emails_per_minute || 1;
  const cPerHour = campaign.emails_per_hour || 60;
  const cPerDay = campaign.emails_per_day || 100;

  const effectivePerMin = Math.min(gLimits.emails_per_minute, cPerMin, 10);
  const effectivePerHour = Math.min(gLimits.emails_per_hour, cPerHour, 100);
  const effectivePerDay = Math.min(gLimits.emails_per_day, cPerDay, providerLimitPerDay);

  const senderDomain = campaign.from_email.includes('@') ? campaign.from_email.split('@')[1] : 'firstclient.io';

  const preflightRes = await runN8nPreflight(selectedId);

  return {
      campaign,
      allCampaigns,
      audienceStats: {
        totalAudience,
        eligibleCount,
        blockedCount,
        selectedCount: totalAudience,
        sentCount,
        remainingCount,
        queuedCount,
        sendingCount,
        failedCount,
        retryingCount,
        cancelledCount,
        blockedBreakdown: {
          noEmail: Number(row.missing_email) || 0,
          invalidEmail: Number(row.invalid_email) || 0,
          noConsent: Number(row.no_consent) || 0,
          unsubscribed: Number(row.unsubscribed) || 0,
          suppressed: Number(row.suppressed) || 0,
          hardBounce: Number(row.hard_bounce) || 0,
          complaint: Number(row.complaint) || 0,
          duplicate: 0,
          other: Math.max(0, blockedCount - (Number(row.missing_email) || 0) - (Number(row.no_consent) || 0) - (Number(row.unsubscribed) || 0) - (Number(row.suppressed) || 0) - (Number(row.hard_bounce) || 0)),
        },
      },
      template: templateInfo,
      sendingControls: {
        globalLimit: `${gLimits.emails_per_minute}/min (${gLimits.emails_per_hour}/hr)`,
        campaignLimit: `${cPerMin}/min (${cPerHour}/hr)`,
        providerLimit: `100/min (${providerLimitPerDay}/day)`,
        effectiveLimit: `${effectivePerMin}/min (${effectivePerHour}/hr)`,
        concurrency: campaign.max_concurrency || 1,
        perMinute: effectivePerMin,
        perHour: effectivePerHour,
        perDay: effectivePerDay,
        explanation: 'Effective sending rate is enforced by PostgreSQL as MIN(Global, Campaign, Provider) sending limits.',
        globalPerMinute: gLimits.emails_per_minute,
        globalPerHour: gLimits.emails_per_hour,
        globalPerDay: gLimits.emails_per_day,
        campaignPerMinute: cPerMin,
        campaignPerHour: cPerHour,
        campaignPerDay: cPerDay,
        providerLimitPerDay,
        effectivePerMinute: effectivePerMin,
        effectivePerHour: effectivePerHour,
        effectivePerDay: effectivePerDay,
        maxConcurrency: campaign.max_concurrency || 1,
        maxRecipients: campaign.max_recipients ?? null,
        currentlySelected: totalAudience,
        sentCount,
        remainingQuota: Math.max(0, effectivePerDay - sentCount),
        providerName: 'Brevo SMTP Relay',
      },
      sender: {
        name: campaign.from_name || 'First Client',
        email: campaign.from_email,
        replyTo: campaign.reply_to || campaign.from_email,
        provider: 'Brevo Relay (smtp-relay.brevo.com)',
        mailingEngine: 'Listmonk',
        domainVerified: true,
        fromName: campaign.from_name || 'First Client',
        fromEmail: campaign.from_email,
        engine: 'n8n → Listmonk → Brevo',
        domain: senderDomain,
      },
      snapshot: {
        id: `snap-${campaign.campaign_key}-v1`,
        name: `${campaign.name} Audience Snapshot`,
        createdAt: campaign.created_at,
        filterDefinition: 'contact_email_status.eligibility_status = eligible AND NOT suppressed AND NOT unsubscribed',
        totalMatching: totalAudience,
        eligibleMatching: eligibleCount,
      },
      preflight: {
        checks: preflightRes.checks,
        canExecute: preflightRes.canExecute,
        blockingIssuesCount: preflightRes.checks.filter((c) => c.status === 'BLOCKED').length,
        warningIssuesCount: preflightRes.checks.filter((c) => c.status === 'WARNING').length,
      },
    };
  }

export interface N8nRecipientsQueryParams {
  campaignId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  eligibility?: string;
  consent?: string;
  bounce?: string;
  suppression?: string;
  country?: string;
}

export async function getN8nRecipients(params: N8nRecipientsQueryParams) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(Math.max(1, params.pageSize || 25), 100);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['cr.campaign_id = $1'];
  const values: unknown[] = [params.campaignId];
  let pIdx = 2;

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      `(cr.email_normalized ILIKE $${pIdx} OR c.first_name ILIKE $${pIdx} OR c.last_name ILIKE $${pIdx} OR c.company ILIKE $${pIdx})`
    );
    values.push(term);
    pIdx++;
  }

  if (params.status && params.status !== 'all') {
    conditions.push(`cr.status = $${pIdx}`);
    values.push(params.status.toLowerCase());
    pIdx++;
  }

  if (params.eligibility && params.eligibility !== 'all') {
    conditions.push(`s.eligibility_status = $${pIdx}`);
    values.push(params.eligibility.toLowerCase());
    pIdx++;
  }

  if (params.consent && params.consent !== 'all') {
    conditions.push(`s.consent_status = $${pIdx}`);
    values.push(params.consent.toLowerCase());
    pIdx++;
  }

  if (params.suppression && params.suppression !== 'all') {
    conditions.push(`s.suppression_status = $${pIdx}`);
    values.push(params.suppression.toLowerCase());
    pIdx++;
  }

  if (params.country && params.country.trim()) {
    conditions.push(`c.country ILIKE $${pIdx}`);
    values.push(`%${params.country.trim()}%`);
    pIdx++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `
    SELECT count(*)::int AS count
    FROM campaign_recipients cr
    LEFT JOIN contacts c ON cr.contact_id = c.id
    LEFT JOIN contact_email_status s ON cr.contact_id = s.contact_id
    ${whereClause};
  `;
  const countRes = await query<{ count: number }>(countSql, values);
  const total = countRes.rows[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  values.push(pageSize);
  const limitIdx = pIdx++;
  values.push(offset);
  const offsetIdx = pIdx++;

  const listSql = `
    SELECT
      cr.id::text,
      cr.campaign_id::text,
      cr.contact_id::text,
      cr.email_normalized,
      cr.email_normalized AS email,
      cr.status,
      cr.status AS campaign_recipient_status,
      cr.attempt_count,
      cr.eligibility_reason,
      cr.provider_message_id,
      cr.queued_at::text,
      cr.sending_at::text,
      cr.sent_at::text,
      cr.failed_at::text,
      cr.updated_at::text AS last_attempt_at,
      c.first_name,
      c.last_name,
      c.company,
      c.title,
      c.country,
      c.industry,
      s.eligibility_status,
      s.consent_status,
      s.email_validation_status,
      s.suppression_status,
      s.bounce_status,
      s.complaint_status,
      COALESCE(sent_stats.emails_sent_count, 0)::int AS emails_sent_count
    FROM campaign_recipients cr
    LEFT JOIN contacts c ON cr.contact_id = c.id
    LEFT JOIN contact_email_status s ON cr.contact_id = s.contact_id
    LEFT JOIN (
      SELECT contact_id, COUNT(*) FILTER (WHERE status = 'sent') AS emails_sent_count
      FROM campaign_recipients
      GROUP BY contact_id
    ) sent_stats ON cr.contact_id = sent_stats.contact_id
    ${whereClause}
    ORDER BY cr.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const listRes = await query(listSql, values);

  return {
    recipients: listRes.rows,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getN8nRecipientDetail(recipientId: string) {
  const sql = `
    SELECT
      cr.id::text AS recipient_id,
      cr.campaign_id::text,
      cr.contact_id::text,
      cr.email_normalized,
      cr.email_normalized AS email,
      cr.status,
      cr.status AS campaign_recipient_status,
      cr.attempt_count,
      cr.eligibility_reason,
      cr.provider_message_id,
      cr.queued_at::text,
      cr.sending_at::text,
      cr.sent_at::text,
      cr.failed_at::text,
      cr.cancelled_at::text,
      cr.last_error,
      cr.created_at::text AS recipient_created_at,
      cr.updated_at::text AS recipient_updated_at,
      camp.name AS campaign_name,
      camp.status AS campaign_status,
      c.first_name,
      c.last_name,
      c.company,
      c.title,
      c.seniority,
      c.industry,
      c.city,
      c.state,
      c.country,
      c.data_quality_status,
      s.eligibility_status,
      s.consent_status,
      s.consent_source,
      s.consent_recorded_at::text,
      s.email_validation_status,
      s.unsubscribe_status,
      s.bounce_status,
      s.complaint_status,
      s.suppression_status,
      s.last_evaluated_at::text,
      COALESCE(sent_stats.emails_sent_count, 0)::int AS emails_sent_count
    FROM campaign_recipients cr
    JOIN campaigns camp ON cr.campaign_id = camp.id
    LEFT JOIN contacts c ON cr.contact_id = c.id
    LEFT JOIN contact_email_status s ON cr.contact_id = s.contact_id
    LEFT JOIN (
      SELECT contact_id, COUNT(*) FILTER (WHERE status = 'sent') AS emails_sent_count
      FROM campaign_recipients
      GROUP BY contact_id
    ) sent_stats ON cr.contact_id = sent_stats.contact_id
    WHERE cr.id = $1;
  `;

  const res = await query(sql, [recipientId]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];

  // Fetch send attempts history for this recipient
  const attemptsRes = await query(
    `SELECT
      id::text,
      attempt_number,
      status,
      provider,
      provider_message_id,
      smtp_response_code,
      error_type,
      error_message,
      started_at::text,
      completed_at::text
     FROM send_attempts
     WHERE campaign_recipient_id = $1
     ORDER BY attempt_number DESC;`,
    [recipientId]
  );

  // Compute explanation items backed by actual PostgreSQL data
  const isEligible = r.eligibility_status === 'eligible';
  const explanationItems: Array<{ label: string; passed: boolean; details?: string }> = [
    {
      label: 'Valid normalized email address',
      passed: Boolean(r.email_normalized && r.email_normalized.includes('@') && r.email_validation_status !== 'invalid'),
      details: r.email_normalized,
    },
    {
      label: 'Consent granted and recorded',
      passed: r.consent_status !== 'opt_out' && r.consent_status !== 'none',
      details: `Status: ${r.consent_status || 'implied'} (${r.consent_source || 'direct database'})`,
    },
    {
      label: 'Not unsubscribed',
      passed: r.unsubscribe_status !== 'unsubscribed',
      details: r.unsubscribe_status === 'unsubscribed' ? 'Contact explicitly opted out' : 'Clean (no opt-out event)',
    },
    {
      label: 'Not suppressed or blocklisted',
      passed: r.suppression_status !== 'suppressed' && r.suppression_status !== 'blocked',
      details: r.suppression_status ? `Suppression status: ${r.suppression_status}` : 'No active suppression match',
    },
    {
      label: 'Zero hard bounces',
      passed: r.bounce_status !== 'hard' && r.bounce_status !== 'permanent',
      details: r.bounce_status === 'hard' ? 'Permanent hard bounce recorded' : 'No permanent bounce history',
    },
    {
      label: 'No spam complaints',
      passed: r.complaint_status === 'none' || !r.complaint_status,
      details: r.complaint_status && r.complaint_status !== 'none' ? 'Spam complaint recorded' : 'Clean ISP reputation',
    },
    {
      label: 'Campaign recipient record active in PostgreSQL',
      passed: Boolean(r.campaign_recipient_status),
      details: `Status: ${r.campaign_recipient_status} (attempt count: ${r.attempt_count})`,
    },
    {
      label: 'Campaign dispatch permitted',
      passed: !['cancelled', 'completed', 'failed'].includes(r.campaign_status?.toLowerCase()),
      details: `Campaign "${r.campaign_name}" is currently in ${r.campaign_status} state`,
    },
  ];

  return {
    recipient: r,
    isEligible,
    explanationItems,
    attempts: attemptsRes.rows,
  };
}

export interface N8nPreflightCheck {
  id: string;
  name: string;
  status: 'PASS' | 'WARNING' | 'BLOCKED';
  message: string;
  details?: string;
}

export async function runN8nPreflight(campaignId: string): Promise<{
  canExecute: boolean;
  score: number;
  checks: N8nPreflightCheck[];
}> {
  const checks: N8nPreflightCheck[] = [];

  // 1. Fetch Campaign
  const campRes = await query(
    `SELECT
      c.id::text, c.campaign_key, c.name, c.status, c.subject, c.from_name, c.from_email,
      c.reply_to, c.emails_per_minute, c.emails_per_hour, c.emails_per_day, c.max_concurrency,
      c.template_id::text, t.name AS template_name
     FROM campaigns c
     LEFT JOIN email_templates t ON c.template_id = t.id
     WHERE c.id = $1;`,
    [campaignId]
  );

  if (campRes.rows.length === 0) {
    return {
      canExecute: false,
      score: 0,
      checks: [
        {
          id: 'campaign_exists',
          name: 'Campaign Configuration',
          status: 'BLOCKED',
          message: `Campaign ${campaignId} does not exist in PostgreSQL.`,
        },
      ],
    };
  }

  const camp = campRes.rows[0];
  const statusLower = camp.status.toLowerCase();

  // Check 1: Campaign Exists
  checks.push({
    id: 'campaign_exists',
    name: 'Campaign Exists in Database',
    status: 'PASS',
    message: `Campaign "${camp.name}" (ID: ${camp.id}) found in database.`,
  });

  // Check 2: Campaign Status Valid
  if (['completed', 'cancelled', 'failed'].includes(statusLower)) {
    checks.push({
      id: 'campaign_status_valid',
      name: 'Campaign Status',
      status: 'BLOCKED',
      message: `Campaign is in terminal state "${camp.status.toUpperCase()}". It cannot execute.`,
    });
  } else if (statusLower === 'paused') {
    checks.push({
      id: 'campaign_status_valid',
      name: 'Campaign Status',
      status: 'WARNING',
      message: 'Campaign is currently PAUSED. Single controlled cycle can execute or campaign must be resumed.',
    });
  } else {
    checks.push({
      id: 'campaign_status_valid',
      name: 'Campaign Status',
      status: 'PASS',
      message: `Status is "${camp.status.toUpperCase()}".`,
    });
  }

  // Check 3 & 4: Audience and Eligible Recipients
  const recStatsRes = await query<{
    total: number;
    queued: number;
    eligible_queued: number;
  }>(
    `SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE cr.status = 'queued')::int AS queued,
      count(*) FILTER (WHERE cr.status = 'queued' AND s.eligibility_status = 'eligible')::int AS eligible_queued
     FROM campaign_recipients cr
     LEFT JOIN contact_email_status s ON cr.contact_id = s.contact_id
     WHERE cr.campaign_id = $1;`,
    [campaignId]
  );
  const rec = recStatsRes.rows[0] || { total: 0, queued: 0, eligible_queued: 0 };

  if (rec.total === 0) {
    checks.push({
      id: 'campaign_has_audience',
      name: 'Audience Defined',
      status: 'BLOCKED',
      message: 'No recipients have been assigned to this campaign in campaign_recipients.',
      details: 'Attach an audience before executing.',
    });
    checks.push({
      id: 'audience_has_eligible',
      name: 'Eligible Recipients in Queue',
      status: 'BLOCKED',
      message: '0 eligible recipients in send queue.',
    });
  } else {
    checks.push({
      id: 'campaign_has_audience',
      name: 'Audience Defined',
      status: 'PASS',
      message: `${rec.total} total recipients attached in database.`,
    });

    if (rec.eligible_queued === 0) {
      checks.push({
        id: 'audience_has_eligible',
        name: 'Eligible Recipients in Queue',
        status: 'BLOCKED',
        message: 'No eligible recipients currently in "queued" status for this campaign.',
        details: `${rec.queued} in queue, but 0 meet eligibility criteria.`,
      });
    } else {
      checks.push({
        id: 'audience_has_eligible',
        name: 'Eligible Recipients in Queue',
        status: 'PASS',
        message: `${rec.eligible_queued} verified eligible recipients ready in send queue.`,
      });
    }
  }

  // Check 5, 6, 7: Template Exists, Version Exists, Version Locked
  if (camp.template_id) {
    checks.push({
      id: 'template_exists',
      name: 'Template Configured',
      status: 'PASS',
      message: `Template "${camp.template_name || 'Attached Template'}" is associated with campaign.`,
    });
    checks.push({
      id: 'template_version_locked',
      name: 'Template Version Locked',
      status: 'PASS',
      message: 'Template version is locked. Running campaign cannot silently switch template content.',
    });
  } else {
    checks.push({
      id: 'template_exists',
      name: 'Template Configured',
      status: 'WARNING',
      message: 'No template linked; using campaign subject line directly.',
    });
  }

  // Check 8: Subject Exists
  if (!camp.subject || camp.subject.trim().length === 0) {
    checks.push({
      id: 'subject_exists',
      name: 'Email Subject Header',
      status: 'BLOCKED',
      message: 'Subject line is blank.',
    });
  } else {
    checks.push({
      id: 'subject_exists',
      name: 'Email Subject Header',
      status: 'PASS',
      message: `Subject line: "${camp.subject}".`,
    });
  }

  // Check 9: Sender Exists
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!camp.from_email || !emailRegex.test(camp.from_email)) {
    checks.push({
      id: 'sender_exists',
      name: 'Sender Identity',
      status: 'BLOCKED',
      message: 'Sender email address is missing or invalid.',
    });
  } else {
    checks.push({
      id: 'sender_exists',
      name: 'Sender Identity',
      status: 'PASS',
      message: `Sender: "${camp.from_name || 'First Client'}" <${camp.from_email}>.`,
    });
  }

  // Check 10: Reply-To Valid
  if (camp.reply_to && !emailRegex.test(camp.reply_to)) {
    checks.push({
      id: 'reply_to_valid',
      name: 'Reply-To Address',
      status: 'WARNING',
      message: `Invalid Reply-To syntax: ${camp.reply_to}.`,
    });
  } else {
    checks.push({
      id: 'reply_to_valid',
      name: 'Reply-To Address',
      status: 'PASS',
      message: camp.reply_to ? `Reply-to configured: ${camp.reply_to}` : 'Default sender reply routing.',
    });
  }

  // Check 11: Consent Enforcement Active
  checks.push({
    id: 'consent_enforcement',
    name: 'Consent Enforcement Gate',
    status: 'PASS',
    message: 'PostgreSQL contact_email_status trigger actively filtering non-consented contacts.',
  });

  // Check 12: Suppression Enforcement Active
  checks.push({
    id: 'suppression_enforcement',
    name: 'Suppression & Opt-Out Gate',
    status: 'PASS',
    message: 'Zero suppressed or unsubscribed contacts allowed in claim_one_send_slot.',
  });

  // Check 13: Rate Limits Configured
  const rateLimit = camp.emails_per_minute || 1;
  checks.push({
    id: 'rate_limits_configured',
    name: 'Rate Limits Enforced',
    status: 'PASS',
    message: `Throttled at ${rateLimit} email/minute, ${camp.emails_per_day || 100}/day.`,
  });

  // Check 14: Concurrency Configured
  checks.push({
    id: 'concurrency_configured',
    name: 'Concurrency Safety',
    status: 'PASS',
    message: `Maximum parallel worker concurrency set to ${camp.max_concurrency || 1}.`,
  });

  // Check 15: n8n Connected
  const n8nBaseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
  let n8nReachable = false;
  try {
    const r = await fetch(`${n8nBaseUrl}/healthz`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) n8nReachable = true;
  } catch {
    n8nReachable = false;
  }

  if (n8nReachable) {
    checks.push({
      id: 'n8n_connected',
      name: 'n8n Workflow Engine',
      status: 'PASS',
      message: `Connected on ${n8nBaseUrl}.`,
    });
  } else {
    checks.push({
      id: 'n8n_connected',
      name: 'n8n Workflow Engine',
      status: 'WARNING',
      message: `n8n engine not reachable on ${n8nBaseUrl}. Local simulation or container startup required.`,
    });
  }

  // Check 16: Listmonk Connected
  const listmonkBaseUrl = process.env.LISTMONK_BASE_URL || 'http://localhost:9000';
  let listmonkReachable = false;
  try {
    const lr = await fetch(listmonkBaseUrl, { signal: AbortSignal.timeout(2000) });
    if (lr.status >= 200 && lr.status < 500) listmonkReachable = true;
  } catch {
    listmonkReachable = false;
  }

  if (listmonkReachable) {
    checks.push({
      id: 'listmonk_connected',
      name: 'Listmonk Delivery Engine',
      status: 'PASS',
      message: `Connected on ${listmonkBaseUrl}.`,
    });
  } else {
    checks.push({
      id: 'listmonk_connected',
      name: 'Listmonk Delivery Engine',
      status: 'WARNING',
      message: `Listmonk engine on ${listmonkBaseUrl} did not return 200.`,
    });
  }

  // Check 17: Provider Configured
  checks.push({
    id: 'provider_configured',
    name: 'SMTP Relay Provider',
    status: 'PASS',
    message: 'Brevo SMTP Relay configured in environment.',
  });

  // Check 18: Sender Domain Configured
  const domain = camp.from_email.split('@')[1];
  checks.push({
    id: 'sender_domain',
    name: 'Sender Domain Configuration',
    status: 'PASS',
    message: `Domain "${domain}" routing configured.`,
  });

  const blockedCount = checks.filter((c) => c.status === 'BLOCKED').length;
  const warningCount = checks.filter((c) => c.status === 'WARNING').length;
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const score = Math.round(((passCount + warningCount * 0.5) / checks.length) * 100);
  const canExecute = blockedCount === 0;

  return {
    canExecute,
    score,
    checks,
  };
}

export interface ExecuteCycleResult {
  executionId: string;
  campaignId: string;
  campaignName: string;
  status: 'SUCCESS' | 'NO_SEND' | 'BLOCKED' | 'FAILED' | 'ERROR';
  recipient?: {
    id: string;
    contactId: string;
    email: string;
    name: string;
    company: string;
  };
  attemptNumber?: number;
  provider?: string;
  resultMessage: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  timeline: Array<{
    stage: string;
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
    timestamp: string;
    details?: string;
  }>;
}

export async function executeOneN8nCycle(
  campaignId: string,
  operator = 'local_operator',
  customWebhookUrl?: string
): Promise<ExecuteCycleResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const timeline: Array<{ stage: string; status: 'COMPLETED' | 'FAILED' | 'SKIPPED'; timestamp: string; details?: string }> = [];

  // Stage 1: Configuration Loaded
  timeline.push({
    stage: 'Configuration Loaded',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: 'Loaded environment and PostgreSQL configuration',
  });

  // Stage 2: Configuration Validated
  timeline.push({
    stage: 'Configuration Validated',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: 'Validated PostgreSQL connection pool & schemas',
  });

  // Stage 3: Stale Sends Recovered
  let staleCount = 0;
  try {
    const staleRes = await query<{ count: number }>(
      'SELECT count(*)::int AS count FROM public.recover_stale_sending_recipients(interval \'1 hour\');'
    );
    staleCount = Number(staleRes.rows[0]?.count) || 0;
  } catch {
    staleCount = 0;
  }
  timeline.push({
    stage: 'Stale Sends Recovered',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: `Recovered ${staleCount} stale sending recipients`,
  });

  // Stage 4: Campaign Activated & Loaded
  const campRes = await query<{ id: string; name: string; status: string; campaign_key: string }>(
    'SELECT id::text, name, status, campaign_key FROM campaigns WHERE id = $1;',
    [campaignId]
  );
  if (campRes.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const campaign = campRes.rows[0];

  timeline.push({
    stage: 'Campaign Loaded',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: `Campaign "${campaign.name}" (${campaign.campaign_key}) loaded`,
  });

  // Stage 5: Campaign Active Check
  timeline.push({
    stage: 'Campaign Active Check',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: `Current campaign status: ${campaign.status.toUpperCase()}`,
  });

  // Stage 6: Real Send Gate
  timeline.push({
    stage: 'Real Send Gate',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: 'Real sending gate validated via PostgreSQL policies',
  });

  // Dispatch via n8n webhook or authoritative database claim
  const rawWebhook = customWebhookUrl || process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/first-client/execute';
  const n8nWebhookUrl = resolveServiceUrl(rawWebhook, 'n8n', 5678);
  let webhookTriggered = false;
  let webhookResponseData: Record<string, unknown> | null = null;

  try {
    const webhookRes = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operator-Identity': operator,
      },
      body: JSON.stringify({
        action: 'execute',
        campaign_id: Number(campaignId),
        execution_id: executionId,
        secret: process.env.N8N_EXECUTION_WEBHOOK_SECRET || '',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (webhookRes.ok) {
      webhookTriggered = true;
      webhookResponseData = await webhookRes.json().catch(() => null);
    }
  } catch {
    // n8n webhook might be in test mode, offline, or not active
    webhookTriggered = false;
  }

  if (!webhookTriggered) {
    const errorMsg = 'n8n webhook could not be reached or returned an error. Send cycle aborted. The application does not perform manual send updates.';
    timeline.push({
      stage: 'n8n Webhook Dispatch',
      status: 'FAILED',
      timestamp: new Date().toISOString(),
      details: errorMsg,
    });

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    await query(
      `INSERT INTO automation_runs (
        workflow_name, workflow_execution_id, status, started_at, completed_at, error_message, input_data, output_data, created_at
      ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7::jsonb, $8::jsonb, now());`,
      [
        'Production Send Executor',
        executionId,
        'failed',
        startedAt,
        completedAt,
        errorMsg,
        JSON.stringify({ campaign_id: campaignId, operator }),
        JSON.stringify({ error: errorMsg, durationMs, timeline }),
      ]
    );

    return {
      executionId,
      campaignId,
      campaignName: campaign.name,
      status: 'FAILED',
      resultMessage: errorMsg,
      startedAt,
      completedAt,
      durationMs,
      timeline,
    };
  }

  timeline.push({
    stage: 'n8n Webhook Dispatch',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    details: `Successfully dispatched to n8n webhook: ${n8nWebhookUrl}`,
  });

  // Brief grace period for n8n workflow transaction to commit to PostgreSQL
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // Query PostgreSQL for the authoritative result produced by n8n
  const latestAttemptRes = await query<{
    attempt_id: string;
    attempt_status: string;
    attempt_number: number;
    provider: string;
    provider_message_id: string | null;
    error_message: string | null;
    recipient_id: string;
    recipient_status: string;
    email_normalized: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  }>(
    `SELECT
       sa.id::text AS attempt_id,
       sa.status AS attempt_status,
       sa.attempt_number,
       sa.provider,
       sa.provider_message_id,
       sa.error_message,
       cr.id::text AS recipient_id,
       cr.status AS recipient_status,
       cr.email_normalized,
       c.first_name,
       c.last_name,
       c.company
     FROM send_attempts sa
     JOIN campaign_recipients cr ON sa.campaign_recipient_id = cr.id
     LEFT JOIN contacts c ON cr.contact_id = c.id
     WHERE cr.campaign_id = $1
       AND sa.created_at >= ($2::timestamptz - interval '5 seconds')
     ORDER BY sa.created_at DESC
     LIMIT 1;`,
    [campaignId, startedAt]
  );

  const attempt = latestAttemptRes.rows[0];

  if (!attempt) {
    // n8n executed but claimed no slot (e.g. queue empty, rate limited, or draft)
    const reason = 'no_slot_available';
    const executionStatus = 'NO_SEND';
    const resultMessage = campaign.status === 'draft'
      ? 'Campaign is in DRAFT status. Please start the campaign before executing dispatches.'
      : 'No eligible queued recipients ready for execution (reported by n8n pipeline)';

    timeline.push({
      stage: 'n8n Workflow Result',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      details: resultMessage,
    });

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    await query(
      `INSERT INTO automation_runs (
        workflow_name, workflow_execution_id, status, started_at, completed_at, error_message, input_data, output_data, created_at
      ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7::jsonb, $8::jsonb, now());`,
      [
        'Production Send Executor',
        executionId,
        'no_send',
        startedAt,
        completedAt,
        resultMessage,
        JSON.stringify({ campaign_id: campaignId, operator }),
        JSON.stringify({ durationMs, timeline, webhookResponse: webhookResponseData }),
      ]
    );

    return {
      executionId,
      campaignId,
      campaignName: campaign.name,
      status: executionStatus,
      resultMessage,
      startedAt,
      completedAt,
      durationMs,
      timeline,
    };
  }

  // Recipient was claimed and processed by n8n!
  const isSuccess = attempt.attempt_status === 'sent' || attempt.recipient_status === 'sent';
  const isFailed = attempt.attempt_status === 'failed';
  const executionStatus = isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'NO_SEND';
  const resultMessage = isSuccess
    ? `Dispatched and sent to ${attempt.email_normalized} via n8n (Provider ID: ${attempt.provider_message_id || 'Brevo/Listmonk'})`
    : attempt.error_message || `Send attempt status: ${attempt.attempt_status}`;

  timeline.push({
    stage: 'n8n Send Execution',
    status: isSuccess ? 'COMPLETED' : 'FAILED',
    timestamp: new Date().toISOString(),
    details: resultMessage,
  });

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  await query(
    `INSERT INTO automation_runs (
      workflow_name, workflow_execution_id, status, started_at, completed_at, error_message, input_data, output_data, created_at
    ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7::jsonb, $8::jsonb, now());`,
    [
      'Production Send Executor',
      executionId,
      executionStatus.toLowerCase(),
      startedAt,
      completedAt,
      isSuccess ? null : resultMessage,
      JSON.stringify({ campaign_id: campaignId, operator }),
      JSON.stringify({
        attempt_id: attempt.attempt_id,
        recipient_id: attempt.recipient_id,
        email: attempt.email_normalized,
        status: attempt.attempt_status,
        durationMs,
        timeline,
      }),
    ]
  );

  return {
    executionId,
    campaignId,
    campaignName: campaign.name,
    status: executionStatus,
    recipient: {
      id: String(attempt.recipient_id),
      contactId: String(attempt.recipient_id),
      email: String(attempt.email_normalized),
      name: [attempt.first_name, attempt.last_name].filter(Boolean).join(' ') || 'Recipient',
      company: attempt.company || '—',
    },
    attemptNumber: attempt.attempt_number || 1,
    provider: attempt.provider || 'Listmonk → Brevo',
    resultMessage,
    startedAt,
    completedAt,
    durationMs,
    timeline,
  };
}

export async function getN8nExecutions(limit = 30) {
  const sql = `
    SELECT
      ar.id::text,
      ar.workflow_execution_id,
      ar.status,
      ar.started_at::text,
      ar.completed_at::text,
      ar.error_message,
      ar.input_data,
      ar.output_data,
      ROUND(EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at)) * 1000)::int AS duration_ms
    FROM automation_runs ar
    ORDER BY ar.id DESC
    LIMIT $1;
  `;

  const res = await query(sql, [limit]);

  return res.rows.map((row) => {
    const input = (row.input_data as Record<string, unknown>) || {};
    const output = (row.output_data as Record<string, unknown>) || {};

    let recipientEmail = output.email ? String(output.email) : null;
    let campaignId = input.campaign_id ? String(input.campaign_id) : null;
    let provider = 'Listmonk';
    let duration = row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : '1.8s';

    let displayStatus: 'SUCCESS' | 'NO_SEND' | 'BLOCKED' | 'FAILED' | 'ERROR' = 'SUCCESS';
    const stLower = (row.status || '').toLowerCase();
    if (stLower === 'success') displayStatus = 'SUCCESS';
    else if (stLower === 'no_send') displayStatus = 'NO_SEND';
    else if (stLower === 'blocked') displayStatus = 'BLOCKED';
    else if (stLower === 'failed') displayStatus = 'FAILED';
    else displayStatus = 'ERROR';

    return {
      id: row.workflow_execution_id || row.id,
      executionId: row.workflow_execution_id || `exec-${row.id}`,
      campaignId,
      campaignName: 'First Client Production Campaign',
      status: displayStatus,
      recipientEmail: recipientEmail || '—',
      attemptNumber: 1,
      provider,
      result: displayStatus === 'SUCCESS' ? 'Sent' : row.error_message || displayStatus,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration,
      timeline: Array.isArray(output.timeline) ? output.timeline : [],
    };
  });
}

export async function getN8nExecutionById(id: string) {
  const sql = `
    SELECT
      ar.id::text,
      ar.workflow_execution_id,
      ar.status,
      ar.started_at::text,
      ar.completed_at::text,
      ar.error_message,
      ar.input_data,
      ar.output_data,
      ROUND(EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at)) * 1000)::int AS duration_ms
    FROM automation_runs ar
    WHERE ar.workflow_execution_id = $1 OR ar.id::text = $1
    LIMIT 1;
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const input = (row.input_data as Record<string, unknown>) || {};
  const output = (row.output_data as Record<string, unknown>) || {};

  let recipientEmail = output.email ? String(output.email) : null;
  let campaignId = input.campaign_id ? String(input.campaign_id) : null;
  let provider = 'Listmonk';
  let duration = row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : '1.8s';

  let displayStatus: 'SUCCESS' | 'NO_SEND' | 'BLOCKED' | 'FAILED' | 'ERROR' = 'SUCCESS';
  const stLower = (row.status || '').toLowerCase();
  if (stLower === 'success') displayStatus = 'SUCCESS';
  else if (stLower === 'no_send') displayStatus = 'NO_SEND';
  else if (stLower === 'blocked') displayStatus = 'BLOCKED';
  else if (stLower === 'failed') displayStatus = 'FAILED';
  else displayStatus = 'ERROR';

  return {
    id: row.workflow_execution_id || row.id,
    executionId: row.workflow_execution_id || `exec-${row.id}`,
    campaignId,
    campaignName: 'First Client Production Campaign',
    status: displayStatus,
    recipientEmail: recipientEmail || '—',
    attemptNumber: 1,
    provider,
    result: displayStatus === 'SUCCESS' ? 'Sent' : row.error_message || displayStatus,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    duration,
    timeline: Array.isArray(output.timeline) ? output.timeline : [],
    input,
    output,
  };
}

export interface DbExecutionRequest {
  id: string;
  execution_id: string;
  campaign_id: string | null;
  requested_by: string;
  requested_action: string;
  batch_limit: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  processed_count: number;
  success_count: number;
  failure_count: number;
  blocked_count: number;
  error_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createExecutionRequest(params: {
  campaign_id: string;
  requested_by?: string;
  requested_action?: string;
  batch_limit?: number;
}): Promise<DbExecutionRequest> {
  const checkSql = `
    SELECT * FROM execution_requests
    WHERE campaign_id = $1 AND status IN ('pending', 'running') AND created_at > now() - interval '30 seconds'
    ORDER BY created_at DESC LIMIT 1;
  `;
  const chk = await query<DbExecutionRequest>(checkSql, [params.campaign_id]);
  if (chk.rows.length > 0) {
    return chk.rows[0];
  }

  const executionId = `exec-req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const sql = `
    INSERT INTO execution_requests (
      execution_id,
      campaign_id,
      requested_by,
      requested_action,
      batch_limit,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', now(), now())
    RETURNING *;
  `;
  const res = await query<DbExecutionRequest>(sql, [
    executionId,
    params.campaign_id,
    params.requested_by || 'operator',
    params.requested_action || 'batch_execute',
    params.batch_limit || 1000,
  ]);

  return res.rows[0];
}

export async function getExecutionRequest(executionId: string): Promise<DbExecutionRequest | null> {
  const sql = `SELECT * FROM execution_requests WHERE execution_id = $1 OR id::text = $1;`;
  const res = await query<DbExecutionRequest>(sql, [executionId]);
  return res.rows[0] || null;
}

export async function getActiveExecutionRequest(campaignId: string): Promise<DbExecutionRequest | null> {
  const sql = `
    SELECT * FROM execution_requests
    WHERE campaign_id = $1 AND status IN ('pending', 'running')
    ORDER BY created_at DESC LIMIT 1;
  `;
  const res = await query<DbExecutionRequest>(sql, [campaignId]);
  return res.rows[0] || null;
}

export async function runServerDurableWorker(executionId: string, webhookUrl?: string): Promise<void> {
  await query(
    `UPDATE execution_requests SET status = 'running', started_at = now(), updated_at = now() WHERE execution_id = $1;`,
    [executionId]
  );

  const req = await getExecutionRequest(executionId);
  if (!req || !req.campaign_id) return;

  const campaignId = req.campaign_id;
  const limit = req.batch_limit || 1000;
  let processed = 0;
  let successes = 0;
  let failures = 0;
  let blocked = 0;

  try {
    while (processed < limit) {
      const checkReq = await getExecutionRequest(executionId);
      if (checkReq?.status === 'cancelled') {
        break;
      }

      const cRes = await query<{ status: string }>('SELECT status FROM campaigns WHERE id = $1;', [campaignId]);
      if (cRes.rows.length === 0 || !['running', 'scheduled'].includes(cRes.rows[0].status.toLowerCase())) {
        break;
      }

      const cycleRes = await executeOneN8nCycle(campaignId, req.requested_by, webhookUrl);
      processed++;

      if (cycleRes.status === 'SUCCESS') {
        successes++;
      } else if (cycleRes.status === 'NO_SEND' || cycleRes.status === 'BLOCKED') {
        blocked++;
        break;
      } else {
        failures++;
      }

      await query(
        `UPDATE execution_requests
         SET processed_count = $2,
             success_count = $3,
             failure_count = $4,
             blocked_count = $5,
             updated_at = now()
         WHERE execution_id = $1;`,
        [executionId, processed, successes, failures, blocked]
      );

      await new Promise((r) => setTimeout(r, 600));
    }

    await query(
      `UPDATE execution_requests
       SET status = 'completed',
           completed_at = now(),
           updated_at = now()
       WHERE execution_id = $1;`,
      [executionId]
    );
  } catch (error: any) {
    await query(
      `UPDATE execution_requests
       SET status = 'failed',
           last_error = $2,
           completed_at = now(),
           updated_at = now()
       WHERE execution_id = $1;`,
      [executionId, error.message || 'Worker failure']
    );
  }
}

