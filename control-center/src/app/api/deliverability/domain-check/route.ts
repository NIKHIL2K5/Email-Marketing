import { NextRequest, NextResponse } from 'next/server';
import { checkDomainReadiness } from '@/lib/dns';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let domain = searchParams.get('domain');

    if (!domain) {
      // Find from active campaigns
      const cRes = await query<{ from_email: string }>(
        'SELECT from_email FROM campaigns ORDER BY updated_at DESC LIMIT 1;'
      );
      if (cRes.rows.length > 0 && cRes.rows[0].from_email.includes('@')) {
        domain = cRes.rows[0].from_email.split('@')[1];
      } else {
        domain = 'firstclient.io';
      }
    }

    const readiness = await checkDomainReadiness(domain);
    return NextResponse.json(readiness);
  } catch (error: any) {
    console.error('[api/deliverability/domain-check:GET]', error);
    return NextResponse.json({ error: error.message || 'DNS check failed' }, { status: 500 });
  }
}
