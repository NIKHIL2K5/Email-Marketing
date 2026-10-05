import { NextRequest, NextResponse } from 'next/server';
import { getN8nRecipients } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('page_size') || '25', 10);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const eligibility = searchParams.get('eligibility') || undefined;
    const consent = searchParams.get('consent') || undefined;
    const suppression = searchParams.get('suppression') || undefined;
    const country = searchParams.get('country') || undefined;

    const result = await getN8nRecipients({
      campaignId,
      page,
      pageSize,
      search,
      status,
      eligibility,
      consent,
      suppression,
      country,
    });

    return NextResponse.json({
      success: true,
      data: {
        recipients: result.recipients,
        totalCount: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
      ...result,
    });
  } catch (error) {
    console.error('[api/n8n/recipients:error]', error);
    return NextResponse.json({ error: 'Failed to retrieve recipient directory' }, { status: 500 });
  }
}
