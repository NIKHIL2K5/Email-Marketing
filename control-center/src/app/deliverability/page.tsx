import React from 'react';
import { getDeliverabilityMetrics } from '@/lib/db';
import { DeliverabilityClient } from '@/components/deliverability/DeliverabilityClient';

export const dynamic = 'force-dynamic';

export default async function DeliverabilityPage() {
  const metrics = await getDeliverabilityMetrics();

  return <DeliverabilityClient metrics={metrics} />;
}
