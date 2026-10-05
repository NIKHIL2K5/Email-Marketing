import { NextRequest, NextResponse } from 'next/server';
import { recordAutomationRun, recordAuditLog } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const configuredSecret = process.env.N8N_EXECUTION_WEBHOOK_SECRET;

if (!configuredSecret) {
  return NextResponse.json(
    { error: 'N8N execution webhook secret is not configured' },
    { status: 500 }
  );
}

  const headerSecret =
    request.headers.get('x-n8n-webhook-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const bodySecret = payload && typeof payload === 'object' ? (payload.secret as string) : null;
  const providedSecret = headerSecret || bodySecret;

  if (!providedSecret || providedSecret !== configuredSecret) {
    console.warn(`[webhooks/n8n/run-update] Unauthorized update attempt from IP ${ip}`);
    await recordAuditLog({
      actor_type: 'webhook_caller',
      actor_reference: ip,
      action: 'n8n_run_update_rejected',
      entity_type: 'security_event',
      entity_id: 'n8n_webhook',
      after_state: { reason: 'Unauthorized: invalid or missing n8n secret' },
      result: 'unauthorized',
      ip_address: ip,
    }).catch(console.error);

    return NextResponse.json({ error: 'Unauthorized: Invalid webhook secret' }, { status: 401 });
  }

  if (!payload || !payload.workflow_name) {
    return NextResponse.json({ error: 'workflow_name is required' }, { status: 400 });
  }

  try {
    const statusVal: 'running' | 'failed' | 'success' =
      payload.status === 'running' || payload.status === 'failed' ? payload.status : 'success';

    const run = await recordAutomationRun({
      workflow_name: String(payload.workflow_name),
      workflow_execution_id: (payload.execution_id as string) || (payload.workflow_execution_id as string),
      status: statusVal,
      started_at: payload.started_at as string,
      completed_at: (payload.completed_at as string) || new Date().toISOString(),
      error_message: (payload.error_message as string) || undefined,
      input_data: (payload.input_data as Record<string, unknown>) || null,
      output_data: ((payload.output_data || payload.metrics) as Record<string, unknown>) || null,
    });


    await recordAuditLog({
      actor_type: 'n8n_executor',
      actor_reference: String(payload.execution_id || 'n8n'),
      action: 'n8n_workflow_updated',
      entity_type: 'automation_run',
      entity_id: String(run.id),
      after_state: {
        workflow: payload.workflow_name,
        status: payload.status,
      },
      result: 'success',
      ip_address: ip,
    }).catch(console.error);

    return NextResponse.json({ received: true, run_id: run.id });
  } catch (error) {
    console.error('[api/webhooks/n8n/run-update:error]', error);
    return NextResponse.json({ error: 'Failed to record n8n workflow update' }, { status: 500 });
  }
}
