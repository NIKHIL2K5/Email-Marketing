import React from 'react';
import { getGlobalSendingLimits, query } from '@/lib/db';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const limits = await getGlobalSendingLimits();

  // Read current send_mode from campaigns if any, or default to test
  const modeRes = await query<{ send_mode: string }>(
    `SELECT send_mode FROM campaigns ORDER BY updated_at DESC LIMIT 1;`
  );
  const currentSendMode = modeRes.rows[0]?.send_mode || 'test';

  return (
    <SettingsClient initialLimits={limits} initialSendMode={currentSendMode} />
  );
}
