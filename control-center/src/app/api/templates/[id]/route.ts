import { NextRequest, NextResponse } from 'next/server';
import { getTemplateById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const template = await getTemplateById(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('[api/templates/[id]:error]', error);
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
  }
}
