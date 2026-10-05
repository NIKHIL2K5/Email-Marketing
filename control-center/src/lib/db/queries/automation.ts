import { query } from '../client';
import { DbAutomationRun } from '../types';

export async function getAutomationRuns(limit = 20): Promise<DbAutomationRun[]> {
  const sql = `
    SELECT
      id::text,
      workflow_name,
      workflow_execution_id,
      status,
      started_at::text,
      completed_at::text,
      error_message,
      input_data,
      output_data,
      created_at::text
    FROM automation_runs
    ORDER BY created_at DESC
    LIMIT $1;
  `;

  const res = await query(sql, [limit]);

  return res.rows.map((row) => ({
    id: row.id,
    workflow_name: row.workflow_name,
    workflow_execution_id: row.workflow_execution_id,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error_message: row.error_message,
    input_data: row.input_data,
    output_data: row.output_data,
    created_at: row.created_at,
  }));
}

export interface RecordAutomationRunInput {
  workflow_name: string;
  workflow_execution_id?: string;
  status: 'running' | 'success' | 'failed';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  input_data?: unknown;
  output_data?: unknown;
}

export async function recordAutomationRun(data: RecordAutomationRunInput): Promise<DbAutomationRun> {
  const sql = `
    INSERT INTO automation_runs (
      workflow_name,
      workflow_execution_id,
      status,
      started_at,
      completed_at,
      error_message,
      input_data,
      output_data,
      created_at
    )
    VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5::timestamptz, $6, $7::jsonb, $8::jsonb, now())
    RETURNING
      id::text,
      workflow_name,
      workflow_execution_id,
      status,
      started_at::text,
      completed_at::text,
      error_message,
      input_data,
      output_data,
      created_at::text;
  `;

  const res = await query(sql, [
    data.workflow_name,
    data.workflow_execution_id || null,
    data.status,
    data.started_at || null,
    data.completed_at || null,
    data.error_message || null,
    data.input_data ? JSON.stringify(data.input_data) : null,
    data.output_data ? JSON.stringify(data.output_data) : null,
  ]);

  const row = res.rows[0];
  return {
    id: row.id,
    workflow_name: row.workflow_name,
    workflow_execution_id: row.workflow_execution_id,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error_message: row.error_message,
    input_data: row.input_data,
    output_data: row.output_data,
    created_at: row.created_at,
  };
}
