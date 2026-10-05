import { NextRequest, NextResponse } from 'next/server';
import { excludeCampaignRecipient } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  try {
    const { id, recipientId } = await params;
    console.log('[exclude/route] Received params:', { id, recipientId });
    const operator = getAuthenticatedOperator(request);

    const result = await excludeCampaignRecipient(
      id,
      recipientId,
      operator.username || 'operator'
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api/campaigns/[id]/recipients/[recipientId]/exclude:POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to exclude recipient from campaign' },
      { status: 500 }
    );
  }
}
