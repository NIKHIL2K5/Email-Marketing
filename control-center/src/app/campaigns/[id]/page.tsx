import React from 'react';
import { notFound } from 'next/navigation';
import { getCampaignById } from '@/lib/db';
import { CampaignDetailClient } from '@/components/campaigns/CampaignDetailClient';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || id.trim().length === 0) {
    notFound();
  }

  const campaign = await getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  return (
    <CampaignDetailClient
      initialCampaign={campaign as unknown as React.ComponentProps<typeof CampaignDetailClient>['initialCampaign']}
    />
  );
}
