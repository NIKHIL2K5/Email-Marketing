'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CampaignSummary } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Play, Pause, ExternalLink, ArrowRight, Layers } from 'lucide-react';

interface CampaignsTableProps {
  campaigns: CampaignSummary[];
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: string) => {
    router.push(`/campaigns/${id}`);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-500" />
            <span>Active Campaigns</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Current campaign execution state, delivery progress, and throttle ceilings
          </p>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <span>View all campaigns</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400">
              <th scope="col" className="px-6 py-3 font-semibold">Campaign</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Max Recipients</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Sent</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Remaining</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Daily Limit</th>
              <th scope="col" className="px-6 py-3 font-semibold min-w-[150px]">Progress</th>
              <th scope="col" className="px-4 py-3 font-semibold">Last Activity</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-zinc-500">
                  No active campaigns configured.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => {
                const isRunning = campaign.status.toUpperCase() === 'RUNNING';
                const isPaused = campaign.status.toUpperCase() === 'PAUSED';

                return (
                  <tr
                    key={campaign.id}
                    onClick={() => handleRowClick(campaign.id)}
                    className="group cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-850/60 transition-colors"
                  >
                    {/* Campaign Name & Key */}
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white transition-colors">
                          {campaign.name}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                          {campaign.key}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={campaign.status} size="sm" />
                    </td>

                    {/* Max Recipients */}
                    <td className="px-4 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {campaign.maxRecipients != null ? campaign.maxRecipients.toLocaleString() : '—'}
                    </td>

                    {/* Sent */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {campaign.sent.toLocaleString()}
                    </td>

                    {/* Remaining */}
                    <td className="px-4 py-3.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                      {campaign.remaining.toLocaleString()}
                    </td>

                    {/* Daily Limit */}
                    <td className="px-4 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {campaign.dailyLimit}/day
                    </td>

                    {/* Progress Bar & Percentage */}
                    <td className="px-6 py-3.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                          <span>{campaign.sent} {campaign.maxRecipients != null ? `/ ${campaign.maxRecipients}` : 'sent'}</span>
                          <span className="font-bold">{campaign.progressPercentage}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${Math.min(campaign.progressPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-medium">
                      {campaign.lastActivity}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isRunning && (
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Pause Campaign"
                            aria-label={`Pause ${campaign.name}`}
                          >
                            <Pause className="h-3 w-3" />
                          </button>
                        )}
                        {isPaused && (
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400 active:scale-95 transition cursor-pointer"
                            title="Resume Campaign"
                            aria-label={`Resume ${campaign.name}`}
                          >
                            <Play className="h-3 w-3" />
                          </button>
                        )}
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
                          title="View Details"
                          aria-label={`View details for ${campaign.name}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
