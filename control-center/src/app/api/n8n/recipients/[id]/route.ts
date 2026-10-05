import { NextRequest, NextResponse } from 'next/server';
import { getN8nRecipientDetail } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !id.trim()) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    const detail = await getN8nRecipientDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'Recipient record not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[api/n8n/recipients/[id]:error]', error);
    return NextResponse.json({ error: 'Failed to retrieve recipient profile' }, { status: 500 });
  }
}
