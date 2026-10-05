import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, createTemplate } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = await getTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error('[api/templates:GET:error]', error);
    return NextResponse.json(
      { error: 'Failed to load email templates from database' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!body.subject || !body.subject.trim()) {
      return NextResponse.json({ error: 'Subject line is required' }, { status: 400 });
    }

    const templateKey =
      body.template_key?.trim() ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);

    const template = await createTemplate({
      name: body.name.trim(),
      template_key: templateKey,
      description: body.description?.trim(),
      subject: body.subject.trim(),
      html_content: body.html_content,
      text_content: body.text_content,
      variables: body.variables || ['first_name', 'company'],
      created_by: body.created_by || 'operator',
    });

    return NextResponse.json({ message: 'Template created successfully', template }, { status: 201 });
  } catch (error) {
    console.error('[api/templates:POST:error]', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
