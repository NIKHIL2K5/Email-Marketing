import React from 'react';
import { getAuditLogs } from '@/lib/db';
import { AuditLogClient } from '@/components/audit/AuditLogClient';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const { logs, total } = await getAuditLogs({ limit: 100 });

  return <AuditLogClient initialLogs={logs} total={total} />;
}
