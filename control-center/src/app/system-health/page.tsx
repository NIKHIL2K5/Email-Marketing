import React from 'react';
import { getDetailedSystemHealth, getAutomationRuns } from '@/lib/db';
import { SystemHealthClient } from '@/components/health/SystemHealthClient';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const [healthData, automationRuns] = await Promise.all([
    getDetailedSystemHealth(),
    getAutomationRuns(15),
  ]);

  return (
    <SystemHealthClient
      services={healthData.services}
      queueDepth={healthData.queueDepth}
      activeWorkers={healthData.activeWorkers}
      staleSendingSends={healthData.staleSendingSends}
      integrity={healthData.integrity}
      automationRuns={automationRuns}
    />
  );
}
