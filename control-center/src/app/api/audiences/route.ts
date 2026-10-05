import { NextRequest, NextResponse } from 'next/server';
import { getAudiences, createAudience } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const audiences = await getAudiences();
    return NextResponse.json({ audiences });
  } catch (error) {
    console.error('[api/audiences:GET]', error);
    return NextResponse.json({ error: 'Failed to fetch audiences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = getAuthenticatedOperator(request);
    const body = await request.json().catch(() => null);

    if (!body || !body.name || !body.rules) {
      return NextResponse.json({ error: 'Audience name and rules are required' }, { status: 400 });
    }

    const audience = await createAudience({
      name: body.name,
      description: body.description,
      rules: body.rules,
      operator: operator.username || 'operator',
    });

    return NextResponse.json({ audience }, { status: 201 });
  } catch (error: any) {
    console.error('[api/audiences:POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create audience' }, { status: 500 });
  }
}
