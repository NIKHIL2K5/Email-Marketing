import { NextRequest, NextResponse } from 'next/server';
import { getCampaignRecipients } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campaign ID parameter is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '50', 10);

    if (isNaN(pageParam) || pageParam < 1) {
      return NextResponse.json(
        { error: 'Invalid page parameter: must be a positive integer' },
        { status: 400 }
      );
    }

    if (isNaN(pageSizeParam) || pageSizeParam < 1 || pageSizeParam > 100) {
      return NextResponse.json(
        { error: 'Invalid pageSize parameter: must be between 1 and 100' },
        { status: 400 }
      );
    }

    const search = searchParams.get('search') || undefined;

    const result = await getCampaignRecipients(id, pageParam, pageSizeParam, search);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/campaigns/[id]/recipients:error]', error);
    return NextResponse.json(
      { error: 'Unable to load campaign recipients' },
      { status: 500 }
    );
  }
}

import { excludeCampaignRecipient, reincludeCampaignRecipient } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || !body.recipientId) {
      return NextResponse.json({ error: 'recipientId is required' }, { status: 400 });
    }

    const operator = getAuthenticatedOperator(request);

    if (body.action === 'exclude') {
      const result = await excludeCampaignRecipient(
        id,
        String(body.recipientId),
        operator.username || 'operator'
      );
      return NextResponse.json(result);
    } else if (body.action === 'reinclude') {
      const result = await reincludeCampaignRecipient(
        id,
        String(body.recipientId),
        operator.username || 'operator'
      );
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Valid action (exclude or reinclude) is required' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[api/campaigns/[id]/recipients:POST:error]', error);
    return NextResponse.json(
      { error: error.message || 'Operation failed' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
