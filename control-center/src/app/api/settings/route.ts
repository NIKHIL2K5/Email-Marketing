import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSendingLimits, updateGlobalSendingLimits, updateGlobalSendMode } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const limits = await getGlobalSendingLimits();
    return NextResponse.json({ limits });
  } catch (error) {
    console.error('[api/settings:GET]', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const operator = getAuthenticatedOperator(request);
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Payload required' }, { status: 400 });
    }

    if (body.send_mode) {
      const result = await updateGlobalSendMode(body.send_mode, operator.username || 'operator');
      return NextResponse.json(result);
    }

    if (
      body.emails_per_minute !== undefined ||
      body.emails_per_hour !== undefined ||
      body.emails_per_day !== undefined ||
      body.max_concurrency !== undefined
    ) {
      const updated = await updateGlobalSendingLimits(
        {
          emails_per_minute: parseInt(body.emails_per_minute, 10),
          emails_per_hour: parseInt(body.emails_per_hour, 10),
          emails_per_day: parseInt(body.emails_per_day, 10),
          max_concurrency: parseInt(body.max_concurrency, 10),
          enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
        },
        operator.username || 'operator'
      );
      return NextResponse.json({ limits: updated });
    }

    return NextResponse.json({ error: 'No valid settings provided to update' }, { status: 400 });
  } catch (error: any) {
    console.error('[api/settings:PATCH]', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
