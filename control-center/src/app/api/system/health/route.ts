import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await getSystemHealth();
    return NextResponse.json({
      status: health.find((h) => h.id === 'postgres')?.status === 'healthy' ? 'operational' : 'degraded',
      services: health,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/system/health:error]', error);
    return NextResponse.json(
      { error: 'Unable to check system health' },
      { status: 500 }
    );
  }
}
