import React from 'react';
import { getContacts, getDashboardData, getCampaigns } from '@/lib/db';
import { ContactDirectoryClient } from '@/components/contacts/ContactDirectoryClient';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const [contactsData, dashboardData, campaigns] = await Promise.all([
    getContacts({ page: 1, pageSize: 50 }),
    getDashboardData(),
    getCampaigns(),
  ]);

  return (
    <ContactDirectoryClient
      initialContacts={contactsData.contacts}
      initialTotal={contactsData.total}
      initialPage={contactsData.page}
      initialPageSize={contactsData.pageSize}
      initialTotalPages={contactsData.totalPages}
      initialContactHealth={dashboardData.contactHealth}
      campaigns={campaigns}
    />
  );
}
