import { query, withTransaction } from '../client';
import { DbCampaign, DbCampaignSummary, DbRecipient } from '../types';
import { CreateCampaignInput, UpdateCampaignInput } from '@/lib/validation';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface CampaignFilterOptions {
  search?: string;
  status?: string;
}

export async function getCampaigns(options?: CampaignFilterOptions): Promise<DbCampaignSummary[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (options?.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    conditions.push(`(c.name ILIKE $${paramIdx} OR c.campaign_key ILIKE $${paramIdx} OR c.subject ILIKE $${paramIdx})`);
    params.push(term);
    paramIdx++;
  }

  if (options?.status && options.status.trim().length > 0 && options.status.toLowerCase() !== 'all') {
    conditions.push(`LOWER(c.status) = $${paramIdx}`);
    params.push(options.status.trim().toLowerCase());
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      c.id::text AS campaign_id,
      c.campaign_key,
      c.name,
      c.status,
      c.emails_per_day,
      c.emails_per_hour,
      c.emails_per_minute,
      c.scheduled_at::text,
      c.started_at::text,
      c.completed_at::text,
      COALESCE(v.total_recipients, 0)::int AS total_recipients,
      COALESCE(v.eligible, 0)::int AS eligible,
      COALESCE(v.queued, 0)::int AS queued,
      COALESCE(v.sending, 0)::int AS sending,
      COALESCE(v.sent, 0)::int AS sent,
      COALESCE(v.delivered, 0)::int AS delivered,
      COALESCE(v.failed, 0)::int AS failed,
      COALESCE(v.blocked, 0)::int AS blocked,
      COALESCE(v.cancelled, 0)::int AS cancelled
    FROM campaigns c
    LEFT JOIN v_campaign_summary v ON c.id = v.campaign_id
    ${whereClause}
    ORDER BY c.created_at DESC;
  `;

  const res = await query<DbCampaignSummary & {
    scheduled_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }>(sql, params);

  return res.rows.map((row) => {
    const total = Number(row.total_recipients) || 0;
    const sent = Number(row.sent) || 0;
    const progress = total > 0 ? Number(((sent / total) * 100).toFixed(1)) : 0;

    let lastActivity = 'Not started';
    if (row.completed_at) {
      lastActivity = 'Completed';
    } else if (row.started_at) {
      lastActivity = 'In progress';
    } else if (row.scheduled_at) {
      lastActivity = `Scheduled for ${new Date(row.scheduled_at).toLocaleDateString()}`;
    }

    return {
      ...row,
      progress_percentage: progress,
      last_activity: lastActivity,
    };
  });
}

export async function getCampaignById(
  id: string
): Promise<(DbCampaign & { summary: DbCampaignSummary; recent_activity: unknown[] }) | null> {
  const campaignSql = `
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
      c.template_version_id::text,
      tv.version_number AS template_version_number,
      c.audience_id::text,
      c.audience_version,
      c.audience_snapshot_at::text,
      c.send_mode,
      c.created_at::text,
      c.updated_at::text
    FROM campaigns c
    LEFT JOIN email_templates t ON c.template_id = t.id
    LEFT JOIN template_versions tv ON c.template_version_id = tv.id
    WHERE c.id = $1;
  `;

  const campaignRes = await query<DbCampaign>(campaignSql, [id]);

  if (campaignRes.rows.length === 0) {
    return null;
  }
  const campaign = campaignRes.rows[0];

  const summarySql = `
    SELECT
      campaign_id::text,
      campaign_key,
      name,
      status,
      COALESCE(total_recipients, 0)::int AS total_recipients,
      COALESCE(eligible, 0)::int AS eligible,
      COALESCE(queued, 0)::int AS queued,
      COALESCE(sending, 0)::int AS sending,
      COALESCE(sent, 0)::int AS sent,
      COALESCE(delivered, 0)::int AS delivered,
      COALESCE(failed, 0)::int AS failed,
      COALESCE(blocked, 0)::int AS blocked,
      COALESCE(cancelled, 0)::int AS cancelled
    FROM v_campaign_summary
    WHERE campaign_id = $1;
  `;

  const summaryRes = await query<DbCampaignSummary>(summarySql, [id]);
  const summary: DbCampaignSummary = summaryRes.rows[0] || {
    campaign_id: String(id),
    campaign_key: campaign.campaign_key,
    name: campaign.name,
    status: campaign.status,
    total_recipients: 0,
    eligible: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    blocked: 0,
    cancelled: 0,
  };

  const activitySql = `
    SELECT
      sa.id::text,
      sa.attempt_number,
      sa.status,
      sa.provider,
      sa.completed_at::text,
      sa.created_at::text,
      cr.email_normalized AS recipient
    FROM send_attempts sa
    JOIN campaign_recipients cr ON sa.campaign_recipient_id = cr.id
    WHERE cr.campaign_id = $1
    ORDER BY sa.created_at DESC
    LIMIT 10;
  `;

  const activityRes = await query(activitySql, [id]);

  return {
    ...campaign,
    summary,
    recent_activity: activityRes.rows,
  };
}

export async function createCampaign(data: CreateCampaignInput): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    // 1. Check campaign_key uniqueness
    const keyCheck = await client.query<{ id: string }>(
      'SELECT id FROM campaigns WHERE campaign_key = $1 LIMIT 1;',
      [data.campaign_key.trim()]
    );
    if (keyCheck.rows.length > 0) {
      throw new ConflictError(`Campaign key "${data.campaign_key}" is already in use.`);
    }

    // Determine initial status based on start_mode
    let initialStatus = 'draft';
    let startedAt: string | null = null;
    let scheduledAt: string | null = null;

    if (data.start_mode === 'start_now') {
      initialStatus = 'running';
      startedAt = new Date().toISOString();
    } else if (data.start_mode === 'schedule' && data.scheduled_at) {
      initialStatus = 'scheduled';
      scheduledAt = data.scheduled_at;
    } else if (data.scheduled_at) {
      initialStatus = 'scheduled';
      scheduledAt = data.scheduled_at;
    }

    // Lookup template version if not explicitly provided
    let templateVersionId = (data as any).template_version_id ? parseInt((data as any).template_version_id, 10) : null;
    if (!templateVersionId && data.template_id) {
      const tRes = await client.query<{ current_version_id: number | null }>(
        'SELECT current_version_id FROM email_templates WHERE id = $1;',
        [data.template_id]
      );
      templateVersionId = tRes.rows[0]?.current_version_id || null;
    }

    const insertSql = `
      INSERT INTO campaigns (
        campaign_key,
        name,
        description,
        status,
        subject,
        from_name,
        from_email,
        reply_to,
        scheduled_at,
        started_at,
        batch_size,
        emails_per_minute,
        emails_per_hour,
        emails_per_day,
        max_concurrency,
        max_retries,
        retry_backoff_seconds,
        max_recipients,
        template_id,
        template_version_id,
        send_mode
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING
        id::text,
        campaign_key,
        name,
        description,
        status,
        subject,
        from_name,
        from_email,
        reply_to,
        scheduled_at::text,
        started_at::text,
        paused_at::text,
        completed_at::text,
        batch_size,
        emails_per_minute,
        emails_per_hour,
        emails_per_day,
        max_concurrency,
        max_retries,
        retry_backoff_seconds,
        max_recipients,
        template_id::text,
        template_version_id::text,
        audience_id::text,
        audience_version,
        send_mode,
        created_at::text,
        updated_at::text;
    `;

    const values = [
      data.campaign_key.trim(),
      data.name.trim(),
      data.description ? data.description.trim() : null,
      initialStatus,
      data.subject.trim(),
      data.from_name ? data.from_name.trim() : 'First Client',
      data.from_email.trim(),
      data.reply_to ? data.reply_to.trim() : null,
      scheduledAt,
      startedAt,
      data.batch_size || 100,
      data.emails_per_minute ?? null,
      data.emails_per_hour ?? null,
      data.emails_per_day ?? null,
      data.max_concurrency || 1,
      data.max_retries ?? 3,
      data.retry_backoff_seconds ?? 300,
      data.max_recipients ?? null,
      data.template_id ? parseInt(data.template_id, 10) : null,
      templateVersionId,
      (data as any).send_mode || 'test',
    ];


    const insertRes = await client.query<DbCampaign>(insertSql, values);
    const campaign = insertRes.rows[0];

    // Record audit event in campaign_events
    await client.query(
      `INSERT INTO campaign_events (
        campaign_id,
        event_type,
        actor_type,
        actor_reference,
        event_data
      ) VALUES ($1, $2, $3, $4, $5);`,
      [
        campaign.id,
        'campaign_created',
        'operator',
        'local_operator',
        JSON.stringify({
          initial_status: initialStatus,
          campaign_key: campaign.campaign_key,
          start_mode: data.start_mode || 'draft',
        }),
      ]
    );

    return campaign;
  });
}

export async function updateCampaign(id: string, data: UpdateCampaignInput): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    // 1. Fetch current campaign to check status
    const currentRes = await client.query<DbCampaign>(
      `SELECT * FROM campaigns WHERE id = $1;`,
      [id]
    );
    if (currentRes.rows.length === 0) {
      throw new Error(`Campaign ${id} not found`);
    }
    const current = currentRes.rows[0];
    const status = current.status.toLowerCase();

    // 2. Enforce editing rules based on status
    if (['completed', 'cancelled', 'failed'].includes(status)) {
      throw new ConflictError(`Campaign cannot be edited because it is in "${status}" state.`);
    }

    if (['scheduled', 'running'].includes(status)) {
      const anyData = data as any;
      if (anyData.template_id !== undefined || anyData.template_version_id !== undefined) {
        throw new ConflictError(
          'Template version is locked for scheduled or running campaigns. Email content cannot be changed once execution has started.'
        );
      }
    }

    if (status === 'running') {
      // Core sending parameters cannot be edited while running
      const attemptedSendingChanges =
        (data.batch_size !== undefined && data.batch_size !== current.batch_size) ||
        (data.emails_per_minute !== undefined && data.emails_per_minute !== current.emails_per_minute) ||
        (data.emails_per_hour !== undefined && data.emails_per_hour !== current.emails_per_hour) ||
        (data.emails_per_day !== undefined && data.emails_per_day !== current.emails_per_day) ||
        (data.max_concurrency !== undefined && data.max_concurrency !== current.max_concurrency) ||
        (data.max_retries !== undefined && data.max_retries !== current.max_retries) ||
        (data.retry_backoff_seconds !== undefined && data.retry_backoff_seconds !== current.retry_backoff_seconds) ||
        ((data as any).max_recipients !== undefined && (data as any).max_recipients !== (current as any).max_recipients);

      if (attemptedSendingChanges) {
        throw new ConflictError(
          'Core sending controls and max recipients cannot be changed while a campaign is actively running. Pause the campaign first.'
        );
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let pIdx = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${pIdx++}`);
      values.push(data.name.trim());
    }
    if (data.description !== undefined) {
      updates.push(`description = $${pIdx++}`);
      values.push(data.description ? data.description.trim() : null);
    }
    if (data.subject !== undefined) {
      updates.push(`subject = $${pIdx++}`);
      values.push(data.subject.trim());
    }
    if (data.from_name !== undefined) {
      updates.push(`from_name = $${pIdx++}`);
      values.push(data.from_name ? data.from_name.trim() : null);
    }
    if (data.from_email !== undefined) {
      updates.push(`from_email = $${pIdx++}`);
      values.push(data.from_email.trim());
    }
    if (data.reply_to !== undefined) {
      updates.push(`reply_to = $${pIdx++}`);
      values.push(data.reply_to ? data.reply_to.trim() : null);
    }
    if (data.scheduled_at !== undefined) {
      updates.push(`scheduled_at = $${pIdx++}`);
      values.push(data.scheduled_at);
    }
    if ((data as any).send_mode !== undefined) {
      updates.push(`send_mode = $${pIdx++}`);
      values.push((data as any).send_mode);
    }

    // Only allow sending control updates if NOT running
    if (status !== 'running') {
      if ((data as any).max_recipients !== undefined) {
        updates.push(`max_recipients = $${pIdx++}`);
        values.push((data as any).max_recipients ? parseInt((data as any).max_recipients, 10) : null);
      }
      if ((data as any).template_id !== undefined && status === 'draft') {
        updates.push(`template_id = $${pIdx++}`);
        values.push((data as any).template_id ? parseInt((data as any).template_id, 10) : null);
      }
      if ((data as any).template_version_id !== undefined && status === 'draft') {
        updates.push(`template_version_id = $${pIdx++}`);
        values.push((data as any).template_version_id ? parseInt((data as any).template_version_id, 10) : null);
      }
      if (data.batch_size !== undefined) {
        updates.push(`batch_size = $${pIdx++}`);
        values.push(data.batch_size);
      }
      if (data.emails_per_minute !== undefined) {
        updates.push(`emails_per_minute = $${pIdx++}`);
        values.push(data.emails_per_minute);
      }
      if (data.emails_per_hour !== undefined) {
        updates.push(`emails_per_hour = $${pIdx++}`);
        values.push(data.emails_per_hour);
      }
      if (data.emails_per_day !== undefined) {
        updates.push(`emails_per_day = $${pIdx++}`);
        values.push(data.emails_per_day);
      }
      if (data.max_concurrency !== undefined) {
        updates.push(`max_concurrency = $${pIdx++}`);
        values.push(data.max_concurrency);
      }
      if (data.max_retries !== undefined) {
        updates.push(`max_retries = $${pIdx++}`);
        values.push(data.max_retries);
      }
      if (data.retry_backoff_seconds !== undefined) {
        updates.push(`retry_backoff_seconds = $${pIdx++}`);
        values.push(data.retry_backoff_seconds);
      }
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push(`updated_at = now()`);
    values.push(id);
    const idIdx = pIdx++;
    values.push(current.status);
    const statusIdx = pIdx++;

    const updateSql = `
      UPDATE campaigns
      SET ${updates.join(', ')}
      WHERE id = $${idIdx} AND status = $${statusIdx}
      RETURNING
        id::text,
        campaign_key,
        name,
        description,
        status,
        subject,
        from_name,
        from_email,
        reply_to,
        scheduled_at::text,
        started_at::text,
        paused_at::text,
        completed_at::text,
        batch_size,
        emails_per_minute,
        emails_per_hour,
        emails_per_day,
        max_concurrency,
        max_retries,
        retry_backoff_seconds,
        max_recipients,
        template_id::text,
        template_version_id::text,
        audience_id::text,
        audience_version,
        send_mode,
        created_at::text,
        updated_at::text;
    `;

    const updateRes = await client.query<DbCampaign>(updateSql, values);
    if (updateRes.rows.length === 0) {
      throw new ConflictError('Concurrent state change detected. Campaign update aborted.');
    }

    const updated = updateRes.rows[0];

    // Record audit event in campaign_events
    await client.query(
      `INSERT INTO campaign_events (
        campaign_id,
        event_type,
        actor_type,
        actor_reference,
        event_data
      ) VALUES ($1, $2, $3, $4, $5);`,
      [
        id,
        'campaign_updated',
        'operator',
        'local_operator',
        JSON.stringify({ updated_fields: Object.keys(data) }),
      ]
    );

    return updated;
  });
}

// ----------------------------------------------------
// STATE MACHINE TRANSITIONS
// ----------------------------------------------------

export async function scheduleCampaign(id: string, scheduledAt: string): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    // 1. Lock template version if not already locked
    const campRes = await client.query<{ template_id: number | null; template_version_id: number | null }>(
      'SELECT template_id, template_version_id FROM campaigns WHERE id = $1;',
      [id]
    );
    if (campRes.rows.length === 0) {
      throw new Error(`Campaign ${id} not found`);
    }
    const camp = campRes.rows[0];
    let versionToLock = camp.template_version_id;

    if (!versionToLock && camp.template_id) {
      const tRes = await client.query<{ current_version_id: number | null }>(
        'SELECT current_version_id FROM email_templates WHERE id = $1;',
        [camp.template_id]
      );
      versionToLock = tRes.rows[0]?.current_version_id || null;
    }

    const res = await client.query<DbCampaign>(
      `UPDATE campaigns
       SET status = 'scheduled',
           scheduled_at = $2,
           template_version_id = COALESCE(template_version_id, $3),
           updated_at = now()
       WHERE id = $1 AND status = 'draft'
       RETURNING id::text, campaign_key, name, description, status, subject, from_name, from_email, reply_to, scheduled_at::text, started_at::text, paused_at::text, completed_at::text, batch_size, emails_per_minute, emails_per_hour, emails_per_day, max_concurrency, max_retries, retry_backoff_seconds, max_recipients, template_id::text, template_version_id::text, audience_id::text, audience_version, send_mode, created_at::text, updated_at::text;`,
      [id, scheduledAt, versionToLock]
    );

    if (res.rows.length === 0) {
      throw new ConflictError('Campaign cannot be scheduled: must be in "draft" status.');
    }

    await client.query(
      `INSERT INTO campaign_events (campaign_id, event_type, actor_type, actor_reference, event_data)
       VALUES ($1, 'campaign_scheduled', 'operator', 'local_operator', $2);`,
      [id, JSON.stringify({ scheduled_at: scheduledAt, locked_template_version_id: versionToLock })]
    );

    return res.rows[0];
  });
}

export async function startCampaign(id: string): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    // Lock template version if not already locked
    const campRes = await client.query<{ template_id: number | null; template_version_id: number | null }>(
      'SELECT template_id, template_version_id FROM campaigns WHERE id = $1;',
      [id]
    );
    if (campRes.rows.length === 0) {
      throw new Error(`Campaign ${id} not found`);
    }
    const camp = campRes.rows[0];
    let versionToLock = camp.template_version_id;

    if (!versionToLock && camp.template_id) {
      const tRes = await client.query<{ current_version_id: number | null }>(
        'SELECT current_version_id FROM email_templates WHERE id = $1;',
        [camp.template_id]
      );
      versionToLock = tRes.rows[0]?.current_version_id || null;
    }

    const res = await client.query<DbCampaign>(
      `UPDATE campaigns
       SET status = 'running',
           started_at = COALESCE(started_at, now()),
           template_version_id = COALESCE(template_version_id, $2),
           updated_at = now()
       WHERE id = $1 AND status IN ('draft', 'scheduled')
       RETURNING id::text, campaign_key, name, description, status, subject, from_name, from_email, reply_to, scheduled_at::text, started_at::text, paused_at::text, completed_at::text, batch_size, emails_per_minute, emails_per_hour, emails_per_day, max_concurrency, max_retries, retry_backoff_seconds, max_recipients, template_id::text, template_version_id::text, audience_id::text, audience_version, send_mode, created_at::text, updated_at::text;`,
      [id, versionToLock]
    );

    if (res.rows.length === 0) {
      throw new ConflictError('Campaign cannot be started: must be in "draft" or "scheduled" status.');
    }

    await client.query(
      `INSERT INTO campaign_events (campaign_id, event_type, actor_type, actor_reference, event_data)
       VALUES ($1, 'campaign_started', 'operator', 'local_operator', $2);`,
      [id, JSON.stringify({ transitioned_to: 'running', locked_template_version_id: versionToLock })]
    );

    return res.rows[0];
  });
}


export async function pauseCampaign(id: string): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    const res = await client.query<DbCampaign>(
      `UPDATE campaigns
       SET status = 'paused',
           paused_at = now(),
           updated_at = now()
       WHERE id = $1 AND status = 'running'
       RETURNING id::text, campaign_key, name, description, status, subject, from_name, from_email, reply_to, scheduled_at::text, started_at::text, paused_at::text, completed_at::text, batch_size, emails_per_minute, emails_per_hour, emails_per_day, max_concurrency, max_retries, retry_backoff_seconds, created_at::text, updated_at::text;`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new ConflictError('Campaign cannot be paused: must be in "running" status.');
    }

    await client.query(
      `INSERT INTO campaign_events (campaign_id, event_type, actor_type, actor_reference, event_data)
       VALUES ($1, 'campaign_paused', 'operator', 'local_operator', $2);`,
      [id, JSON.stringify({ transitioned_to: 'paused' })]
    );

    return { ...res.rows[0], max_recipients: null };
  });
}

export async function resumeCampaign(id: string): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    const res = await client.query<DbCampaign>(
      `UPDATE campaigns
       SET status = 'running',
           updated_at = now()
       WHERE id = $1 AND status = 'paused'
       RETURNING id::text, campaign_key, name, description, status, subject, from_name, from_email, reply_to, scheduled_at::text, started_at::text, paused_at::text, completed_at::text, batch_size, emails_per_minute, emails_per_hour, emails_per_day, max_concurrency, max_retries, retry_backoff_seconds, created_at::text, updated_at::text;`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new ConflictError('Campaign cannot be resumed: must be in "paused" status.');
    }

    await client.query(
      `INSERT INTO campaign_events (campaign_id, event_type, actor_type, actor_reference, event_data)
       VALUES ($1, 'campaign_resumed', 'operator', 'local_operator', $2);`,
      [id, JSON.stringify({ transitioned_to: 'running' })]
    );

    return { ...res.rows[0], max_recipients: null };
  });
}

export async function cancelCampaign(id: string): Promise<DbCampaign> {
  return withTransaction(async (client) => {
    const res = await client.query<DbCampaign>(
      `UPDATE campaigns
       SET status = 'cancelled',
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
       WHERE id = $1 AND status IN ('draft', 'scheduled', 'running', 'paused')
       RETURNING id::text, campaign_key, name, description, status, subject, from_name, from_email, reply_to, scheduled_at::text, started_at::text, paused_at::text, completed_at::text, batch_size, emails_per_minute, emails_per_hour, emails_per_day, max_concurrency, max_retries, retry_backoff_seconds, created_at::text, updated_at::text;`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new ConflictError('Campaign cannot be cancelled: must be in draft, scheduled, running, or paused status.');
    }

    // Cancel any queued/pending recipients
    await client.query(
      `UPDATE campaign_recipients
       SET status = 'cancelled',
           cancelled_at = now(),
           updated_at = now()
       WHERE campaign_id = $1 AND status IN ('pending', 'queued');`,
      [id]
    );

    await client.query(
      `INSERT INTO campaign_events (campaign_id, event_type, actor_type, actor_reference, event_data)
       VALUES ($1, 'campaign_cancelled', 'operator', 'local_operator', $2);`,
      [id, JSON.stringify({ transitioned_to: 'cancelled' })]
    );

    return { ...res.rows[0], max_recipients: null };
  });
}

export async function getCampaignRecipients(
  campaignId: string,
  page = 1,
  pageSize = 50,
  search?: string
): Promise<{ recipients: DbRecipient[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const offset = (safePage - 1) * safePageSize;

  const conditions: string[] = ['campaign_id = $1'];
  const params: unknown[] = [campaignId];
  let paramIdx = 2;

  if (search && search.trim().length > 0) {
    conditions.push(`email_normalized ILIKE $${paramIdx}`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `SELECT count(*)::int AS count FROM campaign_recipients cr ${whereClause};`;
  const countRes = await query<{ count: number }>(countSql, params);
  const total = countRes.rows[0]?.count || 0;
  const totalPages = Math.ceil(total / safePageSize);

  params.push(safePageSize);
  const limitIdx = paramIdx++;
  params.push(offset);
  const offsetIdx = paramIdx++;

  const listSql = `
    SELECT
      cr.id::text,
      cr.campaign_id::text,
      cr.contact_id::text,
      cr.email_normalized AS email,
      cr.status,
      cr.attempt_count,
      cr.eligibility_reason,
      cr.queued_at::text,
      cr.sending_at::text,
      cr.sent_at::text,
      cr.delivered_at::text,
      cr.failed_at::text,
      cr.cancelled_at::text,
      cr.last_error,
      cr.provider_message_id,
      c.first_name,
      c.last_name,
      c.company,
      c.title,
      s.consent_status,
      s.suppression_status,
      s.unsubscribe_status,
      s.bounce_status,
      s.complaint_status,
      s.eligibility_status,
      cr.created_at::text,
      cr.updated_at::text
    FROM campaign_recipients cr
    LEFT JOIN contacts c ON cr.contact_id = c.id
    LEFT JOIN contact_email_status s ON cr.contact_id = s.contact_id
    ${whereClause}
    ORDER BY cr.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const listRes = await query<DbRecipient>(listSql, params);

  return {
    recipients: listRes.rows,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function excludeCampaignRecipient(
  campaignId: string,
  recipientId: string,
  operator?: string
): Promise<{ success: boolean; recipientId: string }> {
  return withTransaction(async (client) => {
    const res = await client.query<{ id: string; contact_id: string; email_normalized: string }>(
      `UPDATE campaign_recipients
       SET status = 'cancelled',
           eligibility_reason = 'Excluded from campaign by operator',
           cancelled_at = now(),
           updated_at = now()
       WHERE id = $1 AND campaign_id = $2
       RETURNING id::text, contact_id::text, email_normalized;`,
      [recipientId, campaignId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Campaign recipient ${recipientId} not found in campaign ${campaignId}`);
    }

    const row = res.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
        actor_type, actor_reference, action, entity_type, entity_id, after_state, result, created_at
      ) VALUES ('operator', $1, 'campaign_recipient_excluded', 'campaign_recipient', $2, $3::jsonb, 'success', now());`,
      [
        operator || 'operator',
        String(row.id),
        JSON.stringify({ campaign_id: campaignId, email: row.email_normalized }),
      ]
    );

    return { success: true, recipientId: String(row.id) };
  });
}

export async function reincludeCampaignRecipient(
  campaignId: string,
  recipientId: string,
  operator?: string
): Promise<{ success: boolean; recipientId: string }> {
  return withTransaction(async (client) => {
    // Check contact eligibility
    const chk = await client.query<{ eligibility_status: string }>(
      `SELECT s.eligibility_status
       FROM campaign_recipients cr
       JOIN contact_email_status s ON cr.contact_id = s.contact_id
       WHERE cr.id = $1 AND cr.campaign_id = $2;`,
      [recipientId, campaignId]
    );

    if (chk.rows.length === 0) {
      throw new Error(`Recipient ${recipientId} not found`);
    }

    if (chk.rows[0].eligibility_status !== 'eligible') {
      throw new ConflictError(
        `Cannot re-include contact because global eligibility is "${chk.rows[0].eligibility_status}".`
      );
    }

    const res = await client.query<{ id: string; email_normalized: string }>(
      `UPDATE campaign_recipients
       SET status = 'queued',
           eligibility_reason = 'Re-included in campaign by operator',
           cancelled_at = null,
           updated_at = now()
       WHERE id = $1 AND campaign_id = $2
       RETURNING id::text, email_normalized;`,
      [recipientId, campaignId]
    );

    await client.query(
      `INSERT INTO audit_logs (
        actor_type, actor_reference, action, entity_type, entity_id, after_state, result, created_at
      ) VALUES ('operator', $1, 'campaign_recipient_reincluded', 'campaign_recipient', $2, $3::jsonb, 'success', now());`,
      [
        operator || 'operator',
        recipientId,
        JSON.stringify({ campaign_id: campaignId, email: res.rows[0]?.email_normalized }),
      ]
    );

    return { success: true, recipientId };
  });
}

export async function deleteCampaign(id: string): Promise<{ deleted: boolean; campaignId: string; name: string }> {
  return withTransaction(async (client) => {
    const checkRes = await client.query<{ id: string; name: string; status: string }>(
      'SELECT id, name, status FROM campaigns WHERE id = $1 FOR UPDATE;',
      [id]
    );

    if (checkRes.rows.length === 0) {
      throw new Error(`Campaign with ID ${id} not found`);
    }

    const campaign = checkRes.rows[0];
    if (campaign.status.toLowerCase() === 'running') {
      throw new Error(`Cannot delete an active RUNNING campaign. Please pause or cancel it first.`);
    }

    // Delete campaign (cascades to campaign_recipients, send_attempts, campaign_events)
    await client.query('DELETE FROM campaigns WHERE id = $1;', [id]);

    return {
      deleted: true,
      campaignId: id,
      name: campaign.name,
    };
  });
}

