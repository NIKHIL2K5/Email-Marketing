import { NextRequest, NextResponse } from 'next/server';
import { getN8nExecutionById } from '@/lib/db/queries/n8n';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const execution = await getN8nExecutionById(id);

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: `Execution '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: execution,
    });
  } catch (error) {
    console.error('Error fetching execution by id:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch execution details',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
