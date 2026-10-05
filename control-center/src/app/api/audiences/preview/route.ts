import { NextRequest, NextResponse } from 'next/server';
import { previewAudience } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.rules) {
      return NextResponse.json({ error: 'Audience rules object is required' }, { status: 400 });
    }

    const preview = await previewAudience(body.rules);
    return NextResponse.json({ preview });
  } catch (error: any) {
    console.error('[api/audiences/preview:POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to preview audience' }, { status: 500 });
  }
}
