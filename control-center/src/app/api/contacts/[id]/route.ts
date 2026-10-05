import { NextRequest, NextResponse } from 'next/server';
import { getContactById, setContactBlockStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Contact ID parameter is required' },
        { status: 400 }
      );
    }

    const contact = await getContactById(id);
    if (!contact) {
      return NextResponse.json(
        { error: `Contact not found with ID ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('[api/contacts/[id]:error]', error);
    return NextResponse.json(
      { error: 'Unable to load contact operational profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Contact ID parameter is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const block = body.block !== undefined
      ? Boolean(body.block)
      : body.is_blocked !== undefined
      ? Boolean(body.is_blocked)
      : body.blocked !== undefined
      ? Boolean(body.blocked)
      : true;
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : block ? 'Blocked manually by operator' : 'Unblocked manually by operator';

    const result = await setContactBlockStatus(id, block, reason);

    return NextResponse.json({
      success: true,
      message: block ? 'Contact marked as blocked' : 'Contact marked as eligible',
      data: result,
    });
  } catch (error) {
    console.error('[api/contacts/[id]:PATCH:error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact block status' },
      { status: 500 }
    );
  }
}
