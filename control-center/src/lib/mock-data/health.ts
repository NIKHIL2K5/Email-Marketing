import { ServiceHealth } from '@/types';

export const mockSystemHealth: ServiceHealth[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    status: 'healthy',
    statusText: 'Healthy',
    description: 'Source-of-truth database',
    lastChecked: 'Just now',
    role: 'Primary Datastore',
    host: 'email-postgres:5432 (contacts)',
    latencyMs: 3,
    detail: 'Connection pool active. All table integrity checks passing.',
  },
  {
    id: 'n8n',
    name: 'n8n',
    status: 'healthy',
    statusText: 'Healthy',
    description: 'Automation engine',
    lastChecked: 'Just now',
    role: 'Orchestration & Workflow Scheduler',
    host: 'localhost:5678 (email-platform)',
    latencyMs: 12,
    detail: 'Campaign trigger workflow active with 0 execution faults.',
  },
  {
    id: 'listmonk',
    name: 'Listmonk',
    status: 'healthy',
    statusText: 'Healthy',
    description: 'Email delivery engine',
    lastChecked: 'Just now',
    role: 'Mailing Engine',
    host: 'localhost:9000 (email-listmonk)',
    latencyMs: 16,
    detail: 'Delivery queue connected and processing within rate caps.',
  },
  {
    id: 'brevo',
    name: 'Brevo',
    status: 'connected',
    statusText: 'Connected',
    description: 'SMTP provider',
    lastChecked: 'Just now',
    role: 'External SMTP Relay',
    host: 'smtp-relay.brevo.com:587',
    latencyMs: 68,
    detail: 'TLS handshake verified. Provider reputation score 99/100.',
  },
];

// Alias for backwards compatibility
export const mockServiceHealth = mockSystemHealth;
