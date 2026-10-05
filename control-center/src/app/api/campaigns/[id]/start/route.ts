import { NextRequest, NextResponse } from 'next/server';
import { startCampaign, ConflictError } from '@/lib/db';

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

    const updated = await startCampaign(id);
    return NextResponse.json({
      message: 'Campaign marked as running in database',
      campaign: updated,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[api/campaigns/[id]/start:error]', error);
    return NextResponse.json(
      { error: 'Failed to start campaign' },
      { status: 500 }
    );
  }
}
