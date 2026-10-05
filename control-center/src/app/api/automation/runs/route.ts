import { NextRequest, NextResponse } from 'next/server';
import { getAutomationRuns, recordAutomationRun } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const runs = await getAutomationRuns(limit);
    return NextResponse.json(runs);
  } catch (error) {
    console.error('[api/automation/runs:GET:error]', error);
    return NextResponse.json({ error: 'Failed to load automation runs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.workflow_name) {
      return NextResponse.json({ error: 'workflow_name is required' }, { status: 400 });
    }

    const run = await recordAutomationRun({
      workflow_name: body.workflow_name,
      workflow_execution_id: body.workflow_execution_id,
      status: body.status || 'running',
      started_at: body.started_at,
      completed_at: body.completed_at,
      error_message: body.error_message,
      input_data: body.input_data,
      output_data: body.output_data,
    });

    return NextResponse.json({ message: 'Automation run logged', run }, { status: 201 });
  } catch (error) {
    console.error('[api/automation/runs:POST:error]', error);
    return NextResponse.json({ error: 'Failed to record automation run' }, { status: 500 });
  }
}
