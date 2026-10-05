import { NextRequest, NextResponse } from 'next/server';
import { getN8nStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const webhookUrl = request.nextUrl.searchParams.get('webhookUrl') || undefined;
    const status = await getN8nStatus(webhookUrl);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[api/n8n/status:error]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve n8n service telemetry' },
      { status: 500 }
    );
  }
}
