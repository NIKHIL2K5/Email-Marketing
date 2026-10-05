import { NextRequest, NextResponse } from 'next/server';
import { getAudienceById, updateAudience, deleteAudience } from '@/lib/db';
import { getAuthenticatedOperator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const audience = await getAudienceById(id);
    if (!audience) {
      return NextResponse.json({ error: 'Audience not found' }, { status: 404 });
    }
    return NextResponse.json({ audience });
  } catch (error) {
    console.error('[api/audiences/[id]:GET]', error);
    return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const operator = getAuthenticatedOperator(request);
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Payload required' }, { status: 400 });
    }

    const updated = await updateAudience(id, {
      name: body.name,
      description: body.description,
      rules: body.rules,
      operator: operator.username || 'operator',
    });

    return NextResponse.json({ audience: updated });
  } catch (error: any) {
    console.error('[api/audiences/[id]:PATCH]', error);
    return NextResponse.json({ error: error.message || 'Failed to update audience' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const operator = getAuthenticatedOperator(request);
    await deleteAudience(id, operator.username || 'operator');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/audiences/[id]:DELETE]', error);
    return NextResponse.json({ error: error.message || 'Failed to delete audience' }, { status: 500 });
  }
}
