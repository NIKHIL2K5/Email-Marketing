import { query } from '../client';
import { DbDashboardData } from '../types';
import { getSystemHealth } from './health';

export async function getDashboardData(): Promise<DbDashboardData> {
  // 1. Contact health & eligibility breakdown
  const contactStatsSql = `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE eligibility_status = 'eligible')::int AS eligible,
      count(*) FILTER (WHERE eligibility_status = 'blocked')::int AS blocked,
      count(*) FILTER (WHERE suppression_status IN ('suppressed', 'blocked'))::int AS suppressed,
      count(*) FILTER (WHERE unsubscribe_status = 'unsubscribed')::int AS unsubscribed,
      count(*) FILTER (WHERE bounce_status IN ('hard', 'permanent'))::int AS hard_bounced
    FROM contact_email_status;
  `;
  const contactStatsRes = await query<{
    total: number;
    eligible: number;
    blocked: number;
    suppressed: number;
    unsubscribed: number;
    hard_bounced: number;
  }>(contactStatsSql);
  const contactStats = contactStatsRes.rows[0] || {
    total: 0,
    eligible: 0,
    blocked: 0,
    suppressed: 0,
    unsubscribed: 0,
    hard_bounced: 0,
  };

  // 2. Sent today, failed today, active campaigns, queued recipients
  const metricsSql = `
    SELECT
      (SELECT count(*)::int FROM send_attempts WHERE status = 'sent' AND created_at >= CURRENT_DATE) AS sent_today,
      (SELECT count(*)::int FROM send_attempts WHERE status = 'failed' AND created_at >= CURRENT_DATE) AS failed_today,
      (SELECT count(*)::int FROM campaigns WHERE status = 'running') AS active_campaigns,
      (SELECT count(*)::int FROM campaign_recipients WHERE status = 'queued') AS queued_recipients;
  `;
  const metricsRes = await query<{
    sent_today: number;
    failed_today: number;
    active_campaigns: number;
    queued_recipients: number;
  }>(metricsSql);
  const counts = metricsRes.rows[0] || {
    sent_today: 0,
    failed_today: 0,
    active_campaigns: 0,
    queued_recipients: 0,
  };

  // 3. Sending limits
  const limitsSql = `
    SELECT emails_per_day
    FROM sending_limits
    WHERE scope_type = 'global' AND enabled = true
    LIMIT 1;
  `;
  const limitsRes = await query<{ emails_per_day: number }>(limitsSql);
  const globalLimit = limitsRes.rows[0]?.emails_per_day || 500;
  const providerLimit = 300; // Brevo free tier limit

  // Check campaign limit from active/first campaign
  const campaignLimitSql = `
    SELECT emails_per_day
    FROM campaigns
    WHERE emails_per_day IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const campaignLimitRes = await query<{ emails_per_day: number }>(campaignLimitSql);
  const campaignLimit = campaignLimitRes.rows[0]?.emails_per_day || 100;

  const effectiveLimit = Math.min(globalLimit, campaignLimit, providerLimit);
  const sentToday = Number(counts.sent_today) || 0;
  const remainingToday = Math.max(0, effectiveLimit - sentToday);
  const percentage = effectiveLimit > 0 ? Math.min(100, Math.round((sentToday / effectiveLimit) * 100)) : 0;

  // 4. Real campaigns
  const campaignsSql = `
    SELECT
      c.id::text,
      c.campaign_key,
      c.name,
      c.description,
      UPPER(c.status) AS status,
      COALESCE(c.emails_per_day, 100)::int AS emails_per_day,
      COALESCE(v.total_recipients, 0)::int AS total_recipients,
      COALESCE(v.sent, 0)::int AS sent,
      c.created_at::text,
      c.started_at::text,
      c.completed_at::text
    FROM campaigns c
    LEFT JOIN v_campaign_summary v ON c.id = v.campaign_id
    ORDER BY c.created_at DESC
    LIMIT 10;
  `;
  const campaignsRes = await query<{
    id: string;
    campaign_key: string;
    name: string;
    description: string | null;
    status: string;
    emails_per_day: number;
    total_recipients: number;
    sent: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  }>(campaignsSql);

  const formattedCampaigns = campaignsRes.rows.map((row) => {
    const total = Number(row.total_recipients) || 0;
    const sent = Number(row.sent) || 0;
    const remaining = Math.max(0, total - sent);
    const progress = total > 0 ? Number(((sent / total) * 100).toFixed(1)) : 0;

    let lastActivity = 'Not started';
    if (row.completed_at) {
      lastActivity = 'Completed';
    } else if (row.started_at) {
      lastActivity = 'In progress';
    } else if (row.status === 'RUNNING') {
      lastActivity = 'Active';
    }

    return {
      id: row.id,
      name: row.name,
      key: row.campaign_key,
      description: row.description || undefined,
      status: row.status,
      maxRecipients: null, // As specified: null if not yet present in schema
      sent,
      remaining,
      dailyLimit: row.emails_per_day,
      progressPercentage: progress,
      lastActivity,
    };
  });

  // 5. Recent sending activity
  const activitySql = `
    SELECT
      sa.id::text,
      to_char(sa.created_at, 'HH12:MI AM') AS time,
      cr.email_normalized AS recipient,
      c.name AS campaign,
      CASE
        WHEN sa.status = 'sent' THEN 'Delivered'
        WHEN sa.status = 'sending' THEN 'Email sent'
        WHEN sa.status = 'failed' THEN 'Delivery failed'
        ELSE sa.status
      END AS event,
      CASE
        WHEN sa.status = 'sent' THEN 'SUCCESS'
        WHEN sa.status = 'sending' THEN 'SUCCESS'
        WHEN sa.status = 'failed' THEN 'FAILED'
        ELSE 'PENDING'
      END AS status
    FROM send_attempts sa
    JOIN campaign_recipients cr ON sa.campaign_recipient_id = cr.id
    JOIN campaigns c ON cr.campaign_id = c.id
    ORDER BY sa.created_at DESC
    LIMIT 10;
  `;
  const activityRes = await query<{
    id: string;
    time: string;
    recipient: string;
    campaign: string;
    event: string;
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'WARNING' | 'PENDING';
  }>(activitySql);

  // 6. System health
  const systemHealth = await getSystemHealth();

  return {
    metrics: {
      totalContacts: contactStats.total,
      eligibleContacts: contactStats.eligible,
      emailsSentToday: sentToday,
      emailsRemainingToday: remainingToday,
      activeCampaigns: Number(counts.active_campaigns) || 0,
      queuedRecipients: Number(counts.queued_recipients) || 0,
      failedSends: Number(counts.failed_today) || 0,
      suppressedContacts: contactStats.suppressed,
    },
    sendingCapacity: {
      sentToday,
      remainingToday,
      capacityLimit: providerLimit,
      percentage,
      globalLimit,
      campaignLimit,
      providerLimit,
      effectiveLimit,
      providerName: 'Brevo SMTP Relay',
    },
    campaigns: formattedCampaigns,
    recentActivity: activityRes.rows,
    systemHealth,
    contactHealth: {
      total: contactStats.total,
      eligible: contactStats.eligible,
      blocked: contactStats.blocked,
      suppressed: contactStats.suppressed,
      unsubscribed: contactStats.unsubscribed,
      hardBounced: contactStats.hard_bounced,
    },
  };
}
