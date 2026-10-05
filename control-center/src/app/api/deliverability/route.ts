import { NextResponse } from 'next/server';
import { getDeliverabilityMetrics } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = await getDeliverabilityMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[api/deliverability:error]', error);
    return NextResponse.json(
      { error: 'Unable to load deliverability metrics from database' },
      { status: 500 }
    );
  }
}
