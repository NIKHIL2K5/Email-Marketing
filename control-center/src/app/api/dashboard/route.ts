import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/dashboard:error]', error);
    return NextResponse.json(
      { error: 'Unable to load dashboard telemetry from database' },
      { status: 500 }
    );
  }
}
