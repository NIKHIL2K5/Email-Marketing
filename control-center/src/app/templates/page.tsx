import React from 'react';
import { getTemplates } from '@/lib/db';
import { TemplatesClient } from '@/components/templates/TemplatesClient';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return <TemplatesClient initialTemplates={templates} />;
}
