import { NextRequest, NextResponse } from 'next/server';
import { assignAudienceToCampaign, getAudiences } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

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

    const audiences = await getAudiences();
    return NextResponse.json({ audiences });
  } catch (error) {
    console.error('[api/campaigns/[id]/assign-audience:GET:error]', error);
    return NextResponse.json({ error: 'Failed to fetch audiences' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    const operator = getAuthenticatedOperator(request);
    const body = await request.json().catch(() => ({}));
    let audienceId = body.audienceId || body.audience_id;

    if (!audienceId) {
      const audiences = await getAudiences();
      if (audiences.length > 0) {
        audienceId = audiences[0].id;
      } else {
        return NextResponse.json(
          { error: 'No audience specified and no existing audiences found' },
          { status: 400 }
        );
      }
    }

    const result = await assignAudienceToCampaign({
      campaignId: id,
      audienceId: String(audienceId),
      operator: operator.username || 'operator',
    });

    return NextResponse.json({
      message: `Successfully bound audience snapshot (v${result.version}) with ${result.recipientsAssigned} recipients`,
      ...result,
    });
  } catch (error) {
    console.error('[api/campaigns/[id]/assign-audience:POST:error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign audience to campaign' },
      { status: 500 }
    );
  }
}
