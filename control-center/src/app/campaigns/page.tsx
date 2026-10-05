import React from 'react';
import { getCampaigns } from '@/lib/db';
import { CampaignListClient } from '@/components/campaigns/CampaignListClient';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return <CampaignListClient initialCampaigns={campaigns} />;
}
