import net from 'net';
import { query } from '../client';
import { ServiceHealth } from '@/types';

export interface DatabaseIntegrityMetric {
  objectName: string;
  rowCount: number;
}

export interface DetailedSystemHealth {
  services: ServiceHealth[];
  queueDepth: number;
  activeWorkers: number;
  staleSendingSends: number;
  integrity: DatabaseIntegrityMetric[];
}

async function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ connected: true, latencyMs });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ connected: false, latencyMs: Date.now() - start, error: err.message });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ connected: false, latencyMs: timeoutMs, error: 'Connection timed out' });
    });
  });
}

import { resolveServiceUrl } from '@/lib/runtime';

export async function getDetailedSystemHealth(): Promise<DetailedSystemHealth> {
  const rawN8nUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
  const rawLmUrl = process.env.LISTMONK_BASE_URL || 'http://localhost:9000';
  const n8nBaseUrl = resolveServiceUrl(rawN8nUrl, 'n8n', 5678);
  const listmonkBaseUrl = resolveServiceUrl(rawLmUrl, 'listmonk', 9000);
  const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

  // 1. Probe PostgreSQL
  const pgStart = Date.now();
  let pgHealthy = false;
  let pgLatency = 0;
  let pgDetail = '';
  let queueDepth = 0;
  let activeWorkers = 0;
  let staleSendingSends = 0;
  let integrity: DatabaseIntegrityMetric[] = [];

  try {
    const [pgRes, queueRes, workerRes, staleRes, integrityRes] = await Promise.allSettled([
      query<{ db_name: string; server_time: string }>(
        'SELECT current_database() AS db_name, now()::text AS server_time;'
      ),
      query<{ count: number }>('SELECT count(*)::int AS count FROM v_send_queue;'),
      query<{ count: number }>("SELECT count(*)::int AS count FROM automation_runs WHERE status = 'running';"),
      query<{ count: number }>(
        "SELECT count(*)::int AS count FROM campaign_recipients WHERE status = 'sending' AND updated_at < now() - interval '1 hour';"
      ),
      query<{ object_name: string; row_count: number }>(
        'SELECT object_name, row_count::int FROM v_database_integrity ORDER BY object_name;'
      ),
    ]);

    pgLatency = Date.now() - pgStart;

    if (pgRes.status === 'fulfilled' && pgRes.value.rows.length > 0) {
      pgHealthy = true;
      pgDetail = `Connected to database "${pgRes.value.rows[0].db_name}". Pool active with latency ${pgLatency}ms.`;
    } else {
      pgHealthy = false;
      pgDetail = pgRes.status === 'rejected' ? pgRes.reason.message : 'Database query returned empty';
    }

    queueDepth = queueRes.status === 'fulfilled' ? Number(queueRes.value.rows[0]?.count) || 0 : 0;
    activeWorkers = workerRes.status === 'fulfilled' ? Number(workerRes.value.rows[0]?.count) || 0 : 0;
    staleSendingSends = staleRes.status === 'fulfilled' ? Number(staleRes.value.rows[0]?.count) || 0 : 0;
    integrity =
      integrityRes.status === 'fulfilled'
        ? integrityRes.value.rows.map((r) => ({
            objectName: r.object_name,
            rowCount: Number(r.row_count) || 0,
          }))
        : [];
  } catch (err: any) {
    pgHealthy = false;
    pgLatency = Date.now() - pgStart;
    pgDetail = err.message || 'PostgreSQL connection failed';
  }

  // 2. Probe n8n
  const n8nStart = Date.now();
  let n8nHealthy = false;
  let n8nLatency = 0;
  let n8nDetail = '';
  try {
    const n8nRes = await fetch(`${n8nBaseUrl}/healthz`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    n8nLatency = Date.now() - n8nStart;
    if (n8nRes.ok) {
      n8nHealthy = true;
      n8nDetail = `Connected to n8n (/healthz OK in ${n8nLatency}ms).`;
    } else {
      n8nHealthy = false;
      n8nDetail = `n8n returned HTTP status ${n8nRes.status} in ${n8nLatency}ms.`;
    }
  } catch (err: any) {
    n8nLatency = Date.now() - n8nStart;
    n8nHealthy = false;
    n8nDetail = `Cannot reach n8n on ${n8nBaseUrl}: ${err.message}`;
  }

  // 3. Probe Listmonk
  const lmStart = Date.now();
  let lmHealthy = false;
  let lmLatency = 0;
  let lmDetail = '';
  try {
    const lmRes = await fetch(listmonkBaseUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    lmLatency = Date.now() - lmStart;
    if (lmRes.status >= 200 && lmRes.status < 500) {
      lmHealthy = true;
      lmDetail = `Listmonk mailing engine responsive (HTTP ${lmRes.status} in ${lmLatency}ms).`;
    } else {
      lmHealthy = false;
      lmDetail = `Listmonk returned HTTP status ${lmRes.status} in ${lmLatency}ms.`;
    }
  } catch (err: any) {
    lmLatency = Date.now() - lmStart;
    lmHealthy = false;
    lmDetail = `Cannot reach Listmonk on ${listmonkBaseUrl}: ${err.message}`;
  }

  // 4. Probe Brevo SMTP Relay
  const brevoProbe = await probeTcp(smtpHost, smtpPort, 3500);
  const brevoHealthy = brevoProbe.connected;
  const brevoDetail = brevoProbe.connected
    ? `TCP socket handshake to ${smtpHost}:${smtpPort} succeeded in ${brevoProbe.latencyMs}ms.`
    : `SMTP connection failed to ${smtpHost}:${smtpPort}: ${brevoProbe.error || 'Connection refused'}`;

  const services: ServiceHealth[] = [
    {
      id: 'postgres',
      name: 'PostgreSQL',
      status: pgHealthy ? 'healthy' : 'unavailable',
      statusText: pgHealthy ? 'Healthy' : 'Down',
      description: 'Source-of-truth database',
      lastChecked: 'Just now',
      role: 'Primary Datastore',
      host: `${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5433'} (${process.env.PGDATABASE || 'contacts'})`,
      latencyMs: pgLatency,
      detail: pgDetail,
    },
    {
      id: 'n8n',
      name: 'n8n Workflow Engine',
      status: n8nHealthy ? 'healthy' : 'unavailable',
      statusText: n8nHealthy ? 'Healthy' : 'Down',
      description: 'Automation & dispatch scheduler',
      lastChecked: 'Just now',
      role: 'Orchestration Engine',
      host: `${n8nBaseUrl} (email-n8n)`,
      latencyMs: n8nLatency,
      detail: n8nDetail,
    },
    {
      id: 'listmonk',
      name: 'Listmonk Core',
      status: lmHealthy ? 'healthy' : 'unavailable',
      statusText: lmHealthy ? 'Healthy' : 'Down',
      description: 'Delivery engine and transactional template sender',
      lastChecked: 'Just now',
      role: 'Mailing Engine',
      host: `${listmonkBaseUrl} (email-listmonk)`,
      latencyMs: lmLatency,
      detail: lmDetail,
    },
    {
      id: 'brevo',
      name: 'Brevo SMTP Relay',
      status: brevoHealthy ? 'healthy' : 'warning',
      statusText: brevoHealthy ? 'Healthy' : 'Degraded',
      description: 'Outbound SMTP transport provider',
      lastChecked: 'Just now',
      role: 'Transport Layer',
      host: `${smtpHost}:${smtpPort}`,
      latencyMs: brevoProbe.latencyMs,
      detail: brevoDetail,
    },

  ];

  return {
    services,
    queueDepth,
    activeWorkers,
    staleSendingSends,
    integrity,
  };
}

export async function getSystemHealth(): Promise<ServiceHealth[]> {
  const detailed = await getDetailedSystemHealth();
  return detailed.services;
}
