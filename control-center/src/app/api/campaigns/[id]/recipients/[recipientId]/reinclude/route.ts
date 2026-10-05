import { NextRequest, NextResponse } from 'next/server';
import { reincludeCampaignRecipient } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  try {
    const { id, recipientId } = await params;
    const operator = getAuthenticatedOperator(request);

    const result = await reincludeCampaignRecipient(
      id,
      recipientId,
      operator.username || 'operator'
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api/campaigns/[id]/recipients/[recipientId]/reinclude:POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to re-include recipient in campaign' },
      { status: 500 }
    );
  }
}
