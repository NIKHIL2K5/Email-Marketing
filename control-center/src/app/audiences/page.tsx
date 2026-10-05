import React from 'react';
import { getAudiences } from '@/lib/db';
import { AudienceBuilderClient } from '@/components/audiences/AudienceBuilderClient';

export const dynamic = 'force-dynamic';

export default async function AudiencesPage() {
  const audiences = await getAudiences();

  return (
    <div className="space-y-6">
      <AudienceBuilderClient initialAudiences={audiences} />
    </div>
  );
}
