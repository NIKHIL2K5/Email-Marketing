import { NextRequest, NextResponse } from 'next/server';
import {
  createExecutionRequest,
  getExecutionRequest,
  getActiveExecutionRequest,
  runServerDurableWorker,
  query,
} from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const operator = getAuthenticatedOperator(request);
    const body = await request.json().catch(() => null);

    const campaignIdRaw = body?.campaign_id || body?.campaignId;
    if (!campaignIdRaw) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const campaignId = String(campaignIdRaw);
    const limit = body.limit ? parseInt(body.limit, 10) : 1000;
    const webhookUrl = body.webhook_url || body.webhookUrl || undefined;

    const req = await createExecutionRequest({
      campaign_id: campaignId,
      requested_by: operator.username || 'operator',
      requested_action: body.action || 'batch_execute',
      batch_limit: limit,
    });

    // Start background durable runner asynchronously
    if (req.status === 'pending') {
      setTimeout(() => {
        runServerDurableWorker(req.execution_id, webhookUrl).catch((err) =>
          console.error('[durable_worker:error]', err)
        );
      }, 50);
    }

    return NextResponse.json({ success: true, execution: req });
  } catch (error: any) {
    console.error('[api/n8n/dispatch:POST]', error);
    return NextResponse.json({ error: error.message || 'Dispatch failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');
    const campaignId = searchParams.get('campaignId');

    if (executionId) {
      const req = await getExecutionRequest(executionId);
      return NextResponse.json({ execution: req });
    }

    if (campaignId) {
      const active = await getActiveExecutionRequest(campaignId);
      return NextResponse.json({ execution: active });
    }

    // List recent requests
    const res = await query('SELECT * FROM execution_requests ORDER BY created_at DESC LIMIT 10;');
    return NextResponse.json({ executions: res.rows });
  } catch (error: any) {
    console.error('[api/n8n/dispatch:GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to get dispatch' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');
    if (!executionId) {
      return NextResponse.json({ error: 'executionId required' }, { status: 400 });
    }

    await query(
      `UPDATE execution_requests
       SET status = 'cancelled',
           completed_at = now(),
           updated_at = now()
       WHERE execution_id = $1 AND status IN ('pending', 'running');`,
      [executionId]
    );

    return NextResponse.json({ success: true, cancelled: true });
  } catch (error: any) {
    console.error('[api/n8n/dispatch:DELETE]', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel dispatch' }, { status: 500 });
  }
}
