import { NextRequest, NextResponse } from 'next/server';
import { runCampaignPreflight } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    const preflight = await runCampaignPreflight(id);
    return NextResponse.json(preflight);
  } catch (error) {
    console.error('[api/campaigns/[id]/preflight:error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute preflight checks' },
      { status: 500 }
    );
  }
}
