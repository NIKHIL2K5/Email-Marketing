import { NextRequest, NextResponse } from 'next/server';
import { getN8nExecutions } from '@/lib/db/queries/n8n';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const executions = await getN8nExecutions(limit);

    return NextResponse.json({
      success: true,
      data: executions,
    });
  } catch (error) {
    console.error('Error fetching n8n executions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch n8n execution history',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
