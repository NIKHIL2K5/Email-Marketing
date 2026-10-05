import { NextRequest, NextResponse } from 'next/server';
import { pauseCampaign, ConflictError } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Campaign ID parameter is required' }, { status: 400 });
    }

    const updated = await pauseCampaign(id);
    return NextResponse.json({
      message: 'Campaign paused successfully',
      campaign: updated,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[api/campaigns/[id]/pause:error]', error);
    return NextResponse.json(
      { error: 'Failed to pause campaign' },
      { status: 500 }
    );
  }
}
