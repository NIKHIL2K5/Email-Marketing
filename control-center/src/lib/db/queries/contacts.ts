import { query, withTransaction } from '../client';
import { DbContact, DbContactDetail } from '../types';

export interface ContactsQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export async function getContacts({
  page = 1,
  pageSize = 50,
  search,
  status,
}: ContactsQueryParams): Promise<{
  contacts: DbContact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const offset = (safePage - 1) * safePageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search && search.trim().length > 0) {
    const cleanSearch = `%${search.trim()}%`;
    conditions.push(
      `(c.email ILIKE $${paramIdx} OR c.first_name ILIKE $${paramIdx} OR c.last_name ILIKE $${paramIdx} OR c.company ILIKE $${paramIdx})`
    );
    params.push(cleanSearch);
    paramIdx++;
  }

  if (status && status.trim().length > 0) {
    conditions.push(`s.eligibility_status = $${paramIdx}`);
    params.push(status.trim().toLowerCase());
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT count(*)::int AS count
    FROM contacts c
    LEFT JOIN contact_email_status s ON c.id = s.contact_id
    ${whereClause};
  `;

  const countRes = await query<{ count: number }>(countSql, params);
  const total = countRes.rows[0]?.count || 0;
  const totalPages = Math.ceil(total / safePageSize);

  params.push(safePageSize);
  const limitIdx = paramIdx++;
  params.push(offset);
  const offsetIdx = paramIdx++;

  const listSql = `
    SELECT
      c.id::text,
      c.first_name,
      c.last_name,
      c.title,
      c.company,
      c.email,
      c.city,
      c.state,
      c.country,
      c.created_at::text,
      s.eligibility_status,
      s.eligibility_reason,
      s.consent_status,
      s.bounce_status,
      s.complaint_status,
      s.suppression_status,
      COALESCE(sent_stats.emails_sent_count, 0)::int AS emails_sent_count,
      COALESCE(sent_stats.campaigns_count, 0)::int AS campaigns_count
    FROM contacts c
    LEFT JOIN contact_email_status s ON c.id = s.contact_id
    LEFT JOIN (
      SELECT contact_id,
             COUNT(*) FILTER (WHERE status = 'sent') AS emails_sent_count,
             COUNT(*) AS campaigns_count
      FROM campaign_recipients
      GROUP BY contact_id
    ) sent_stats ON c.id = sent_stats.contact_id
    ${whereClause}
    ORDER BY c.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const listRes = await query<DbContact>(listSql, params);

  return {
    contacts: listRes.rows,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function getContactById(id: string): Promise<DbContactDetail | null> {
  const contactSql = `
    SELECT
      c.id::text,
      c.source_staging_id::text,
      c.first_name,
      c.last_name,
      c.title,
      c.company,
      c.company_name_for_emails,
      c.email,
      c.email_normalized,
      c.seniority,
      c.departments,
      c.industry,
      c.city,
      c.state,
      c.country,
      c.data_quality_status,
      c.created_at::text,
      s.email_validation_status,
      s.consent_status,
      s.consent_source,
      s.consent_recorded_at::text,
      s.unsubscribe_status,
      s.bounce_status,
      s.complaint_status,
      s.suppression_status,
      s.eligibility_status,
      s.eligibility_reason,
      s.last_evaluated_at::text,
      COALESCE(sent_stats.emails_sent_count, 0)::int AS emails_sent_count,
      COALESCE(sent_stats.campaigns_count, 0)::int AS campaigns_count
    FROM contacts c
    LEFT JOIN contact_email_status s ON c.id = s.contact_id
    LEFT JOIN (
      SELECT contact_id,
             COUNT(*) FILTER (WHERE status = 'sent') AS emails_sent_count,
             COUNT(*) AS campaigns_count
      FROM campaign_recipients
      WHERE contact_id = $1
      GROUP BY contact_id
    ) sent_stats ON c.id = sent_stats.contact_id
    WHERE c.id = $1;
  `;

  const contactRes = await query<DbContactDetail>(contactSql, [id]);
  if (contactRes.rows.length === 0) {
    return null;
  }

  const contact = contactRes.rows[0];

  const historySql = `
    SELECT
      cr.campaign_id::text,
      c.name AS campaign_name,
      cr.status,
      cr.sent_at::text
    FROM campaign_recipients cr
    JOIN campaigns c ON cr.campaign_id = c.id
    WHERE cr.contact_id = $1
    ORDER BY cr.created_at DESC;
  `;

  const historyRes = await query<{
    campaign_id: string;
    campaign_name: string;
    status: string;
    sent_at: string | null;
  }>(historySql, [id]);

  return {
    ...contact,
    campaign_history: historyRes.rows,
  };
}

export async function setContactBlockStatus(
  contactId: string,
  block: boolean,
  reason: string = 'Manual operator action'
): Promise<{
  contact_id: string;
  eligibility_status: string;
  eligibility_reason: string;
  suppression_status: string;
  emails_sent_count: number;
}> {
  return withTransaction(async (client) => {
    // 1. Get contact normalized email
    const contactRes = await client.query<{ email_normalized: string }>(
      'SELECT email_normalized FROM contacts WHERE id = $1;',
      [contactId]
    );

    if (contactRes.rows.length === 0) {
      throw new Error(`Contact ID ${contactId} not found.`);
    }

    const emailNorm = contactRes.rows[0].email_normalized;

    if (block) {
      // Remove any prior manual_block suppression records to avoid unique constraint violations
      await client.query(
        `DELETE FROM contact_suppressions 
         WHERE (contact_id = $1::bigint OR email_normalized = $2) AND suppression_type = 'manual_block';`,
        [contactId, emailNorm]
      );

      // Insert authoritative active manual block record
      await client.query(
        `INSERT INTO contact_suppressions (
          contact_id, email_normalized, suppression_type, reason, source, active, occurred_at
        ) VALUES ($1::bigint, $2, 'manual_block', $3, 'operator_console', true, now());`,
        [contactId, emailNorm, reason]
      );

      await client.query(
        `UPDATE contact_email_status 
         SET suppression_status = 'blocked', updated_at = now() 
         WHERE contact_id = $1::bigint;`,
        [contactId]
      );

      // Block queued recipients in campaigns
      await client.query(
        `UPDATE campaign_recipients
         SET status = 'blocked', 
             eligibility_reason = 'manual_operator_block',
             updated_at = now()
         WHERE contact_id = $1::bigint AND status = 'queued';`,
        [contactId]
      );
    } else {
      // Unblock: deactivate manual suppressions
      await client.query(
        `UPDATE contact_suppressions
         SET active = false, occurred_at = now()
         WHERE (contact_id = $1::bigint OR email_normalized = $2)
           AND suppression_type = 'manual_block';`,
        [contactId, emailNorm]
      );

      await client.query(
        `UPDATE contact_email_status
         SET suppression_status = 'not_suppressed', updated_at = now()
         WHERE contact_id = $1::bigint;`,
        [contactId]
      );

      // Unblock queued campaign recipients that were manually blocked
      await client.query(
        `UPDATE campaign_recipients
         SET status = 'queued',
             eligibility_reason = 'eligible',
             updated_at = now()
         WHERE contact_id = $1::bigint AND status = 'blocked' AND eligibility_reason = 'manual_operator_block';`,
        [contactId]
      );
    }

    // Authoritative PostgreSQL recalculation
    await client.query('SELECT public.refresh_contact_eligibility($1);', [contactId]);

    // Fetch updated status
    const statusRes = await client.query<{
      contact_id: string;
      eligibility_status: string;
      eligibility_reason: string;
      suppression_status: string;
    }>(
      `SELECT contact_id::text, eligibility_status, eligibility_reason, suppression_status
       FROM contact_email_status
       WHERE contact_id = $1;`,
      [contactId]
    );

    // Fetch sent count
    const sentRes = await client.query<{ count: number }>(
      `SELECT count(*)::int as count 
       FROM campaign_recipients 
       WHERE contact_id = $1 AND status = 'sent';`,
      [contactId]
    );

    return {
      ...statusRes.rows[0],
      emails_sent_count: sentRes.rows[0]?.count || 0,
    };
  });
}

