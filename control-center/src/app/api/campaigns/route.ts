import { NextRequest, NextResponse } from 'next/server';
import { getCampaigns, createCampaign, ConflictError } from '@/lib/db';
import { validateCampaignInput } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    const campaigns = await getCampaigns({ search, status });
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('[api/campaigns:GET:error]', error);
    return NextResponse.json(
      { error: 'Unable to load campaigns from database' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { isValid, errors } = validateCampaignInput(body);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const campaign = await createCampaign(body);
    return NextResponse.json({ message: 'Campaign created successfully', campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[api/campaigns:POST:error]', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
