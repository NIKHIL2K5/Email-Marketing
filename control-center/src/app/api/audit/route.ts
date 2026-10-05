import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const entity_type = searchParams.get('entity_type') || undefined;
    const action = searchParams.get('action') || undefined;

    const data = await getAuditLogs({ limit, offset, entity_type, action });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[api/audit:GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
