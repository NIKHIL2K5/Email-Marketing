import { query, withTransaction } from '../client';
import { recordAuditLog } from './audit';

export interface GlobalSendingLimits {
  id: string;
  scope_type: string;
  scope_key: string;
  emails_per_minute: number;
  emails_per_hour: number;
  emails_per_day: number;
  max_concurrency: number;
  enabled: boolean;
  updated_at: string;
}

export interface UpdateGlobalLimitsInput {
  emails_per_minute: number;
  emails_per_hour: number;
  emails_per_day: number;
  max_concurrency: number;
  enabled?: boolean;
}

export async function getGlobalSendingLimits(): Promise<GlobalSendingLimits> {
  const sql = `
    SELECT
      id::text,
      scope_type,
      scope_key,
      emails_per_minute,
      emails_per_hour,
      emails_per_day,
      max_concurrency,
      enabled,
      updated_at::text
    FROM sending_limits
    WHERE scope_type = 'global' AND scope_key = 'global'
    LIMIT 1;
  `;
  const res = await query<GlobalSendingLimits>(sql);
  if (res.rows.length === 0) {
    // Default fallback if row missing
    return {
      id: '1',
      scope_type: 'global',
      scope_key: 'global',
      emails_per_minute: 10,
      emails_per_hour: 100,
      emails_per_day: 500,
      max_concurrency: 1,
      enabled: true,
      updated_at: new Date().toISOString(),
    };
  }
  return res.rows[0];
}

export async function updateGlobalSendingLimits(
  input: UpdateGlobalLimitsInput,
  operator?: string
): Promise<GlobalSendingLimits> {
  if (input.emails_per_minute <= 0 || input.emails_per_hour <= 0 || input.emails_per_day <= 0) {
    throw new Error('Sending limits must be positive integers');
  }

  if (input.max_concurrency <= 0) {
    throw new Error('Concurrency limit must be at least 1');
  }

  return withTransaction(async (client) => {
    const current = await getGlobalSendingLimits();

    const sql = `
      UPDATE sending_limits
      SET
        emails_per_minute = $1,
        emails_per_hour = $2,
        emails_per_day = $3,
        max_concurrency = $4,
        enabled = COALESCE($5, enabled),
        updated_at = now()
      WHERE scope_type = 'global' AND scope_key = 'global'
      RETURNING
        id::text,
        scope_type,
        scope_key,
        emails_per_minute,
        emails_per_hour,
        emails_per_day,
        max_concurrency,
        enabled,
        updated_at::text;
    `;

    const res = await client.query<GlobalSendingLimits>(sql, [
      input.emails_per_minute,
      input.emails_per_hour,
      input.emails_per_day,
      input.max_concurrency,
      input.enabled !== undefined ? input.enabled : true,
    ]);

    const updated = res.rows[0];

    await recordAuditLog({
      actor_reference: operator || 'operator',
      action: 'global_sending_limits_updated',
      entity_type: 'sending_limits',
      entity_id: 'global',
      before_state: current as unknown as Record<string, unknown>,
      after_state: updated as unknown as Record<string, unknown>,
      result: 'success',
    });

    return updated;
  });
}

export async function updateGlobalSendMode(
  sendMode: 'disabled' | 'test' | 'real',
  operator?: string
): Promise<{ sendMode: string }> {
  if (!['disabled', 'test', 'real'].includes(sendMode)) {
    throw new Error('Invalid send mode: must be disabled, test, or real');
  }

  return withTransaction(async (client) => {
    // Update all active campaigns to the specified send_mode
    await client.query(
      `UPDATE campaigns
       SET send_mode = $1,
           updated_at = now()
       WHERE status IN ('draft', 'scheduled', 'paused', 'running');`,
      [sendMode]
    );

    await recordAuditLog({
      actor_reference: operator || 'operator',
      action: 'global_send_mode_changed',
      entity_type: 'system_setting',
      entity_id: 'send_mode',
      after_state: { send_mode: sendMode },
      result: 'success',
    });

    return { sendMode };
  });
}
