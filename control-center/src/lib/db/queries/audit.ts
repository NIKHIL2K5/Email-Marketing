import { query } from '../client';

export interface AuditLogEntry {
  id: string;
  actor_type: string;
  actor_reference: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  result: string;
  ip_address: string | null;
  created_at: string;
}

export interface RecordAuditInput {
  actor_type?: string;
  actor_reference?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  result?: string;
  ip_address?: string | null;
}

export async function recordAuditLog(input: RecordAuditInput): Promise<AuditLogEntry> {
  const sql = `
    INSERT INTO audit_logs (
      actor_type,
      actor_reference,
      action,
      entity_type,
      entity_id,
      before_state,
      after_state,
      result,
      ip_address,
      created_at
    ) VALUES (
      COALESCE($1, 'operator'),
      COALESCE($2, 'operator'),
      $3,
      $4,
      $5,
      $6::jsonb,
      $7::jsonb,
      COALESCE($8, 'success'),
      $9,
      now()
    ) RETURNING *;
  `;

  const res = await query<AuditLogEntry>(sql, [
    input.actor_type || 'operator',
    input.actor_reference || 'operator',
    input.action,
    input.entity_type,
    input.entity_id,
    input.before_state ? JSON.stringify(input.before_state) : null,
    input.after_state ? JSON.stringify(input.after_state) : null,
    input.result || 'success',
    input.ip_address || null,
  ]);

  return res.rows[0];
}

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  entity_type?: string;
  action?: string;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (options?.entity_type) {
    conditions.push(`entity_type = $${paramIdx}`);
    params.push(options.entity_type);
    paramIdx++;
  }

  if (options?.action) {
    conditions.push(`action ILIKE $${paramIdx}`);
    params.push(`%${options.action}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT count(*)::int AS total FROM audit_logs ${whereClause};`;
  const countRes = await query<{ total: number }>(countSql, params);
  const total = Number(countRes.rows[0]?.total) || 0;

  const logsSql = `
    SELECT *
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;
  params.push(limit, offset);

  const logsRes = await query<AuditLogEntry>(logsSql, params);

  return {
    logs: logsRes.rows,
    total,
  };
}
