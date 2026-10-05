import { NextRequest, NextResponse } from 'next/server';
import { runN8nPreflight } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const preflight = await runN8nPreflight(campaignId);
    return NextResponse.json(preflight);
  } catch (error) {
    console.error('[api/n8n/preflight:error]', error);
    return NextResponse.json({ error: 'Failed to run preflight verification' }, { status: 500 });
  }
}
