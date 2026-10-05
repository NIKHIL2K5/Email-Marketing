import React from 'react';
import { getDashboardData } from '@/lib/db';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TopMetricsGrid } from '@/components/dashboard/TopMetricsGrid';
import { SendingCapacityCard } from '@/components/dashboard/SendingCapacityCard';
import { CampaignsTable } from '@/components/dashboard/CampaignsTable';
import { RecentActivityTable } from '@/components/dashboard/RecentActivityTable';
import { SystemHealthGrid } from '@/components/dashboard/SystemHealthGrid';
import { ContactHealthCard } from '@/components/dashboard/ContactHealthCard';
import { MetricItem, CampaignSummary } from '@/types';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let dbData;
  let loadError: string | null = null;

  try {
    dbData = await getDashboardData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Database query failed';
  }

  // Explicit error state if PostgreSQL fails - NEVER silently fall back to mock data
  if (loadError || !dbData) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div className="rounded-xl border border-rose-300 bg-rose-50/60 p-6 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-base font-bold">
                PostgreSQL Connection Error
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                The Control Center was unable to retrieve live telemetry from the authoritative database.
              </p>
              <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3 font-mono text-xs text-rose-800 dark:text-rose-300">
                {loadError}
              </div>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                Ensure container <code className="font-mono font-bold">email-postgres</code> is running on port 5432 and credentials in <code className="font-mono">.env.local</code> are valid.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format real database metrics into the 6 dashboard metric cards
  const eligiblePct =
    dbData.metrics.totalContacts > 0
      ? ((dbData.metrics.eligibleContacts / dbData.metrics.totalContacts) * 100).toFixed(1)
      : '0';

  const metrics: MetricItem[] = [
    {
      id: 'total-contacts',
      title: 'Total Contacts',
      value: dbData.metrics.totalContacts,
      supportingText: 'All contacts in the database',
      iconName: 'users',
      trend: {
        text: 'PostgreSQL contacts',
        variant: 'neutral',
      },
    },
    {
      id: 'eligible-contacts',
      title: 'Eligible Contacts',
      value: dbData.metrics.eligibleContacts,
      supportingText: 'Currently eligible to receive email',
      iconName: 'user-check',
      trend: {
        text: `${eligiblePct}% eligible`,
        variant: 'success',
      },
    },
    {
      id: 'sent-today',
      title: 'Sent Today',
      value: dbData.metrics.emailsSentToday,
      supportingText: 'Emails successfully sent today',
      iconName: 'send',
      trend: {
        text: 'Real dispatch',
        variant: 'neutral',
      },
    },
    {
      id: 'remaining-today',
      title: 'Remaining Today',
      value: dbData.metrics.emailsRemainingToday,
      supportingText: 'Remaining provider/day capacity',
      iconName: 'calendar',
      trend: {
        text: 'Under cap',
        variant: 'warning',
      },
    },
    {
      id: 'active-campaigns',
      title: 'Active Campaigns',
      value: dbData.metrics.activeCampaigns,
      supportingText: 'Currently running',
      iconName: 'flame',
      trend: {
        text: `${dbData.metrics.activeCampaigns} running`,
        variant: dbData.metrics.activeCampaigns > 0 ? 'success' : 'neutral',
      },
    },
    {
      id: 'failed-sends',
      title: 'Failed Sends',
      value: dbData.metrics.failedSends,
      supportingText: 'Requires attention',
      iconName: 'alert-triangle',
      trend: {
        text: dbData.metrics.failedSends > 0 ? `${dbData.metrics.failedSends} errors` : '0 errors',
        variant: dbData.metrics.failedSends > 0 ? 'danger' : 'neutral',
      },
    },
  ];

  // Cast campaigns safely to CampaignSummary[]
  const campaignSummaries: CampaignSummary[] = dbData.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    key: c.key,
    description: c.description,
    status: c.status as CampaignSummary['status'],
    maxRecipients: c.maxRecipients,
    sent: c.sent,
    remaining: c.remaining,
    dailyLimit: c.dailyLimit,
    progressPercentage: c.progressPercentage,
    lastActivity: c.lastActivity,
  }));

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <DashboardHeader />

      {/* 2. TOP METRIC CARDS (6 cards backed by real DB) */}
      <TopMetricsGrid metrics={metrics} />

      {/* 3. SENDING CAPACITY CARD */}
      <SendingCapacityCard capacity={dbData.sendingCapacity} />

      {/* 4. ACTIVE CAMPAIGNS TABLE */}
      <CampaignsTable campaigns={campaignSummaries} />

      {/* 5. SENDING ACTIVITY */}
      <RecentActivityTable events={dbData.recentActivity} />

      {/* 6. SYSTEM HEALTH */}
      <SystemHealthGrid services={dbData.systemHealth} />

      {/* 7. CONTACT HEALTH */}
      <ContactHealthCard data={dbData.contactHealth} />
    </div>
  );
}
