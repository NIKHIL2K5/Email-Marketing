import { NextRequest, NextResponse } from 'next/server';
import { scheduleCampaign, ConflictError } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Campaign ID parameter is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.scheduled_at) {
      return NextResponse.json(
        { error: 'Scheduled time (scheduled_at) is required' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(body.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduled_at date/time format' },
        { status: 400 }
      );
    }

    const updated = await scheduleCampaign(id, scheduledDate.toISOString());
    return NextResponse.json({
      message: 'Campaign scheduled successfully',
      campaign: updated,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[api/campaigns/[id]/schedule:error]', error);
    return NextResponse.json(
      { error: 'Failed to schedule campaign' },
      { status: 500 }
    );
  }
}
