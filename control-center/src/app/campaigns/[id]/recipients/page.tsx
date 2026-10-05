import React from 'react';
import { notFound } from 'next/navigation';
import { getCampaignById, getCampaignRecipients } from '@/lib/db';
import { CampaignRecipientsClient } from '@/components/campaigns/CampaignRecipientsClient';

export const dynamic = 'force-dynamic';

export default async function CampaignRecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string }>;
}) {
  const { id } = await params;
  const sParams = await searchParams;

  if (!id || id.trim().length === 0) {
    notFound();
  }

  const campaign = await getCampaignById(id);
  if (!campaign) {
    notFound();
  }

  const page = parseInt(sParams.page || '1', 10);
  const pageSize = parseInt(sParams.pageSize || '50', 10);
  const search = sParams.search || '';

  const data = await getCampaignRecipients(id, page, pageSize, search);

  return (
    <CampaignRecipientsClient
      campaignId={campaign.id}
      campaignName={campaign.name}
      campaignKey={campaign.campaign_key}
      initialRecipients={data.recipients}
      initialTotal={data.total}
      initialPage={data.page}
      initialPageSize={data.pageSize}
      initialTotalPages={data.totalPages}
      initialSearch={search}
    />
  );
}
