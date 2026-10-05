import { NextRequest, NextResponse } from 'next/server';
import { executeOneN8nCycle, runN8nPreflight } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const campaignId = String(body.campaign_id);
    const operator = request.headers.get('x-operator-identity') || 'local_operator';

    // 1. Run preflight checks - Never execute if a BLOCKED condition exists
    const preflight = await runN8nPreflight(campaignId);
    if (!preflight.canExecute) {
      const blockedChecks = preflight.checks
        .filter((c) => c.status === 'BLOCKED')
        .map((c) => `${c.name}: ${c.message}`)
        .join('; ');

      return NextResponse.json(
        {
          error: `Execution blocked by pre-flight safety gates: ${blockedChecks}`,
          checks: preflight.checks,
        },
        { status: 422 }
      );
    }

    // 2. Execute ONE controlled cycle with target webhook URL
    const webhookUrl = body.webhook_url || body.webhookUrl || undefined;
    const result = await executeOneN8nCycle(campaignId, operator, webhookUrl);

    return NextResponse.json(result, { status: result.status === 'SUCCESS' ? 200 : 200 });
  } catch (error) {
    console.error('[api/n8n/execute:error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    );
  }
}
