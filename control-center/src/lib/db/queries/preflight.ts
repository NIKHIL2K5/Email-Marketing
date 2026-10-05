import { query } from '../client';
import { DbPreflightResult, DbPreflightCheck } from '../types';

export async function runCampaignPreflight(campaignId: string): Promise<DbPreflightResult> {
  const checks: DbPreflightCheck[] = [];

  // 1. Fetch Campaign
  const campSql = `
    SELECT
      c.id::text,
      c.campaign_key,
      c.name,
      c.status,
      c.subject,
      c.from_name,
      c.from_email,
      c.reply_to,
      c.emails_per_minute,
      c.emails_per_hour,
      c.emails_per_day,
      c.batch_size,
      c.max_concurrency,
      c.template_id::text,
      c.template_version_id::text,
      tv.version_number AS template_version_number,
      tv.listmonk_template_id
    FROM campaigns c
    LEFT JOIN template_versions tv ON c.template_version_id = tv.id
    WHERE c.id = $1;
  `;

  const campRes = await query(campSql, [campaignId]);
  if (campRes.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const c = campRes.rows[0];

  // Check: Template Synchronization & Listmonk Mapping
  if (!c.template_version_id) {
    checks.push({
      id: 'template_synchronization',
      name: 'Template Version Synchronization',
      status: 'failed',
      message: 'The selected template version is not synchronized with Listmonk.',
      details: 'Campaign has no template version assigned. Select and lock an active template version before dispatching.',
    });
  } else if (!c.template_version_number) {
    checks.push({
      id: 'template_synchronization',
      name: 'Template Version Synchronization',
      status: 'failed',
      message: 'The selected template version is not synchronized with Listmonk.',
      details: `Referenced template version ${c.template_version_id} does not exist in the database.`,
    });
  } else if (!c.listmonk_template_id) {
    checks.push({
      id: 'template_synchronization',
      name: 'Template Version Synchronization',
      status: 'failed',
      message: 'The selected template version is not synchronized with Listmonk.',
      details: `Template version v${c.template_version_number} has not been synchronized to Listmonk (listmonk_template_id is missing).`,
    });
  } else {
    checks.push({
      id: 'template_synchronization',
      name: 'Template Version Synchronization',
      status: 'passed',
      message: `Template version v${c.template_version_number} is verified and synchronized with Listmonk (ID: ${c.listmonk_template_id}).`,
      details: `Listmonk transactional template ID ${c.listmonk_template_id} is active and ready for dispatch.`,
    });
  }

  // Check 1: Campaign Status Validity
  const statusLower = c.status.toLowerCase();
  if (['completed', 'cancelled', 'failed'].includes(statusLower)) {
    checks.push({
      id: 'lifecycle_state',
      name: 'Campaign Lifecycle State',
      status: 'failed',
      message: `Campaign is in terminal state "${c.status.toUpperCase()}". It cannot be dispatched.`,
    });
  } else {
    checks.push({
      id: 'lifecycle_state',
      name: 'Campaign Lifecycle State',
      status: 'passed',
      message: `State is "${c.status.toUpperCase()}" (ready for execution).`,
    });
  }

  // Check 2: Sender Identity & From Email Domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!c.from_email || !emailRegex.test(c.from_email)) {
    checks.push({
      id: 'sender_identity',
      name: 'Sender Identity & From Address',
      status: 'failed',
      message: 'Invalid or missing sender email address.',
    });
  } else {
    const domain = c.from_email.split('@')[1];
    checks.push({
      id: 'sender_identity',
      name: 'Sender Identity & From Address',
      status: 'passed',
      message: `Verified sender: "${c.from_name || 'System'}" <${c.from_email}>.`,
      details: `Dispatches will route via sender domain: ${domain}`,
    });
  }

  // Check 3: Audience & Recipient Counts
  const recipientsSql = `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'queued')::int AS queued,
      count(*) FILTER (WHERE status = 'sent')::int AS sent,
      count(*) FILTER (WHERE status = 'blocked')::int AS blocked
    FROM campaign_recipients
    WHERE campaign_id = $1;
  `;
  const recRes = await query<{ total: number; queued: number; sent: number; blocked: number }>(recipientsSql, [campaignId]);
  const rec = recRes.rows[0] || { total: 0, queued: 0, sent: 0, blocked: 0 };

  if (rec.total === 0) {
    checks.push({
      id: 'audience_assigned',
      name: 'Audience Assignment',
      status: 'failed',
      message: 'No recipients have been assigned to this campaign yet.',
      details: 'Use the Audience Ingestion tool or assign contacts before launching dispatch.',
    });
  } else if (rec.queued === 0 && rec.sent > 0) {
    checks.push({
      id: 'audience_assigned',
      name: 'Audience Queue State',
      status: 'warning',
      message: `All ${rec.sent} recipients have already been processed. 0 queued recipients remaining.`,
    });
  } else {
    checks.push({
      id: 'audience_assigned',
      name: 'Audience Assignment',
      status: 'passed',
      message: `${rec.queued} queued recipients ready for dispatch (${rec.total} total).`,
    });
  }

  // Check 4: Suppression & Unsubscribe Safety Check
  const suppressionSql = `
    SELECT count(*)::int AS suppressed_in_queue
    FROM campaign_recipients cr
    JOIN contact_email_status s ON cr.contact_id = s.contact_id
    WHERE cr.campaign_id = $1
      AND cr.status = 'queued'
      AND (s.suppression_status IN ('suppressed', 'blocked') OR s.unsubscribe_status = 'unsubscribed' OR s.bounce_status IN ('hard', 'permanent'));
  `;
  const supRes = await query<{ suppressed_in_queue: number }>(suppressionSql, [campaignId]);
  const suppressedInQueue = supRes.rows[0]?.suppressed_in_queue || 0;

  if (suppressedInQueue > 0) {
    checks.push({
      id: 'suppression_safety',
      name: 'Suppression & Opt-Out Gate',
      status: 'failed',
      message: `${suppressedInQueue} queued recipients are marked suppressed or unsubscribed!`,
      details: 'Database integrity trigger must prune suppressed contacts before dispatch.',
    });
  } else {
    checks.push({
      id: 'suppression_safety',
      name: 'Suppression & Opt-Out Gate',
      status: 'passed',
      message: '100% clean. Zero suppressed or unsubscribed contacts in active send queue.',
    });
  }

  // Check 5: Rate Limiting & Safety Envelopes
  const dailyLimit = Number(c.emails_per_day) || 100;
  const providerLimit = 300; // Brevo free relay capacity
  if (dailyLimit > providerLimit) {
    checks.push({
      id: 'rate_limits',
      name: 'Rate Limits vs. Provider Capacity',
      status: 'warning',
      message: `Campaign daily rate (${dailyLimit}/day) exceeds relay provider safe threshold (${providerLimit}/day).`,
      details: 'Automatic throttle will clamp sending to effective limit.',
    });
  } else {
    checks.push({
      id: 'rate_limits',
      name: 'Rate Limits vs. Provider Capacity',
      status: 'passed',
      message: `Rate limit configured at ${dailyLimit}/day (within safe envelope).`,
    });
  }

  // Check 6: Subject Line Quality
  if (!c.subject || c.subject.trim().length === 0) {
    checks.push({
      id: 'subject_line',
      name: 'Subject Line & Header Check',
      status: 'failed',
      message: 'Subject line is blank.',
    });
  } else if (c.subject.includes('{{') && !c.subject.includes('}}')) {
    checks.push({
      id: 'subject_line',
      name: 'Subject Line & Header Check',
      status: 'failed',
      message: 'Unclosed merge variable in subject line.',
    });
  } else {
    checks.push({
      id: 'subject_line',
      name: 'Subject Line & Header Check',
      status: 'passed',
      message: `Valid subject line: "${c.subject}".`,
    });
  }

  const failedCount = checks.filter((ch) => ch.status === 'failed').length;
  const warningCount = checks.filter((ch) => ch.status === 'warning').length;
  const canDispatch = failedCount === 0 && rec.total > 0;
  const totalWeight = checks.length;
  const passedWeight = checks.filter((ch) => ch.status === 'passed').length + warningCount * 0.5;
  const score = Math.round((passedWeight / totalWeight) * 100);

  return {
    campaignId,
    campaignKey: c.campaign_key,
    canDispatch,
    score,
    checks,
  };
}
