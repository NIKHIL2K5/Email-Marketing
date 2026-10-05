import { query } from '../client';
import { DbDeliverabilityMetrics } from '../types';

export async function getDeliverabilityMetrics(): Promise<DbDeliverabilityMetrics> {
  const statsSql = `
    SELECT
      (SELECT count(*)::int FROM send_attempts WHERE status = 'sent') AS sent,
      (SELECT count(*)::int FROM campaign_recipients WHERE status = 'delivered') AS delivered,
      (SELECT count(*)::int FROM contact_email_status WHERE bounce_status IN ('hard', 'permanent')) AS hard_bounced,
      (SELECT count(*)::int FROM contact_email_status WHERE bounce_status = 'soft') AS soft_bounced,
      (SELECT count(*)::int FROM contact_email_status WHERE complaint_status != 'none') AS complaints,
      (SELECT count(*)::int FROM contact_email_status WHERE unsubscribe_status = 'unsubscribed') AS unsubscribed,
      (SELECT count(*)::int FROM campaign_recipients WHERE status = 'blocked') AS blocked,
      (SELECT count(*)::int FROM contact_email_status WHERE suppression_status IN ('suppressed', 'blocked')) AS suppressed;
  `;

  const statsRes = await query<{
    sent: number;
    delivered: number;
    hard_bounced: number;
    soft_bounced: number;
    complaints: number;
    unsubscribed: number;
    blocked: number;
    suppressed: number;
  }>(statsSql);

  const stats = statsRes.rows[0] || {
    sent: 0,
    delivered: 0,
    hard_bounced: 0,
    soft_bounced: 0,
    complaints: 0,
    unsubscribed: 0,
    blocked: 0,
    suppressed: 0,
  };

  const recentEventsSql = `
    SELECT
      sa.id::text,
      to_char(sa.created_at, 'HH12:MI AM') AS time,
      cr.email_normalized AS recipient,
      c.name AS campaign,
      sa.provider,
      sa.status AS event,
      UPPER(sa.status) AS status
    FROM send_attempts sa
    JOIN campaign_recipients cr ON sa.campaign_recipient_id = cr.id
    JOIN campaigns c ON cr.campaign_id = c.id
    ORDER BY sa.created_at DESC
    LIMIT 20;
  `;

  const eventsRes = await query<{
    id: string;
    time: string;
    recipient: string;
    campaign: string;
    provider: string;
    event: string;
    status: string;
  }>(recentEventsSql);

  return {
    sent: stats.sent,
    delivered: stats.delivered,
    hardBounced: stats.hard_bounced,
    softBounced: stats.soft_bounced,
    complaints: stats.complaints,
    unsubscribed: stats.unsubscribed,
    blocked: stats.blocked,
    suppressed: stats.suppressed,
    recentEvents: eventsRes.rows,
  };
}
