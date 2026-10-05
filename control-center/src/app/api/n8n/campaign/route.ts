import { NextRequest, NextResponse } from 'next/server';
import { getN8nCampaignContext } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || undefined;

    const context = await getN8nCampaignContext(id);
    if (!context) {
      return NextResponse.json({ error: 'No campaigns found in PostgreSQL' }, { status: 404 });
    }

    return NextResponse.json(context);
  } catch (error) {
    console.error('[api/n8n/campaign:error]', error);
    return NextResponse.json({ error: 'Failed to retrieve campaign context' }, { status: 500 });
  }
}
