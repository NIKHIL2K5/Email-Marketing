import { NextRequest, NextResponse } from 'next/server';
import { createTemplateVersion, syncTemplateVersionToListmonk } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.subject || !body.subject.trim()) {
      return NextResponse.json({ error: 'Subject is required for template version' }, { status: 400 });
    }

    const version = await createTemplateVersion({
      template_id: id,
      subject: body.subject.trim(),
      html_content: body.html_content,
      text_content: body.text_content,
      variables: body.variables || ['first_name', 'company'],
      created_by: body.created_by || 'operator',
      set_as_current: body.set_as_current !== false,
    });

    // Synchronize to Listmonk immediately after successful database creation
    try {
      const syncResult = await syncTemplateVersionToListmonk(version.id);

      return NextResponse.json(
        {
          message: 'New template version published and synchronized to Listmonk',
          version: {
            ...version,
            listmonk_template_id: syncResult.listmonk_template_id,
          },
          listmonk: syncResult.template,
        },
        { status: 201 }
      );
    } catch (syncError) {
      const safeMessage =
        syncError instanceof Error
          ? syncError.message
          : 'Listmonk template synchronization error';

      console.error('[api/templates/[id]/versions:sync-error]', safeMessage);

      // Preserve PostgreSQL version while notifying caller of Listmonk sync failure
      return NextResponse.json(
        {
          error: `Template version created in Control Center, but Listmonk synchronization failed: ${safeMessage}`,
          version,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('[api/templates/[id]/versions:error]', error);
    return NextResponse.json({ error: 'Failed to create template version' }, { status: 500 });
  }
}
