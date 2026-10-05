import {
  getN8nStatus,
  getN8nCampaignContext,
  getN8nExecutions,
  N8nCampaignContext,
  N8nServiceStatus,
} from '@/lib/db/queries/n8n';
import { N8nConsoleClient, ExecutionRecord } from '@/components/n8n/N8nConsoleClient';

export const dynamic = 'force-dynamic';

export default async function N8nPage() {
  // Fetch initial telemetry server-side
  let serviceStatus: N8nServiceStatus;
  let campaignContext: N8nCampaignContext | null = null;
  let executions: ExecutionRecord[] = [];

  try {
    serviceStatus = await getN8nStatus();
  } catch (error) {
    console.error('Failed to query n8n service status:', error);
    serviceStatus = {
      n8nStatus: 'DISCONNECTED' as const,
      workflowName: 'Production Send Executor',
      workflowStatus: 'Unavailable' as const,
      webhookUrl: 'Unavailable',
      webhookStatus: 'Unavailable' as const,
      listmonkStatus: 'Unavailable' as const,
      listmonkUrl: 'Unavailable',
      lastExecutionAt: null,
      currentExecutionStatus: 'IDLE' as const,
      lastExecutionResult: 'Unavailable' as const,
      lastExecutionDurationMs: null,
      lastSuccessfulExecutionAt: null,
      lastFailedExecutionAt: null,
      nextScheduledExecution: null,
      diagnostics: 'Database or n8n service unreachable: ' + (error instanceof Error ? error.message : String(error)),
    };
  }

  try {
    campaignContext = await getN8nCampaignContext();
  } catch (error) {
    console.error('Failed to query n8n campaign context:', error);
  }

  try {
    executions = await getN8nExecutions(20);
  } catch (error) {
    console.error('Failed to query n8n executions:', error);
  }

  return (
    <N8nConsoleClient
      initialStatus={serviceStatus}
      initialContext={campaignContext}
      initialExecutions={executions as any}
    />
  );
}
