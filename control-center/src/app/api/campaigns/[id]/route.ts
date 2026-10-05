import { NextRequest, NextResponse } from 'next/server';
import { getCampaignById, updateCampaign, deleteCampaign, ConflictError } from '@/lib/db';
import { validateCampaignInput } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campaign ID parameter is required' },
        { status: 400 }
      );
    }

    const campaign = await getCampaignById(id);
    if (!campaign) {
      return NextResponse.json(
        { error: `Campaign not found with ID ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...campaign, campaign });
  } catch (error) {
    console.error('[api/campaigns/[id]:GET:error]', error);
    return NextResponse.json(
      { error: 'Unable to load campaign details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campaign ID parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate inputs
    const { errors } = validateCampaignInput(body);
    // Ignore missing required fields on partial PATCH if they aren't provided
    const filteredErrors: Record<string, string> = {};
    for (const key of Object.keys(errors)) {
      if (body[key] !== undefined) {
        filteredErrors[key] = errors[key];
      }
    }

    if (Object.keys(filteredErrors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: filteredErrors },
        { status: 400 }
      );
    }

    const updated = await updateCampaign(id, body);
    return NextResponse.json({ message: 'Campaign updated successfully', campaign: updated });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('[api/campaigns/[id]:PATCH:error]', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campaign ID parameter is required' },
        { status: 400 }
      );
    }

    const result = await deleteCampaign(id);
    return NextResponse.json({
      success: true,
      message: `Campaign "${result.name}" (#${result.campaignId}) deleted successfully`,
      data: result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete campaign';
    const status = msg.includes('not found') ? 404 : msg.includes('Cannot delete') ? 400 : 500;
    if (status >= 500) {
      console.error('[api/campaigns/[id]:DELETE:error]', error);
    } else {
      console.warn(`[api/campaigns/[id]:DELETE:warn] status ${status}: ${msg}`);
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
