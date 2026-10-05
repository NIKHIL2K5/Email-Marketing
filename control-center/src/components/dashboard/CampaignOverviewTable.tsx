'use client';

import React from 'react';
import Link from 'next/link';
import { Campaign } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Play, Pause, ExternalLink, ArrowRight } from 'lucide-react';

interface CampaignOverviewTableProps {
  campaigns: Campaign[];
}

export function CampaignOverviewTable({ campaigns }: CampaignOverviewTableProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Campaign Overview
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Active and configured outreach sequences with live execution counters
          </p>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <span>View all campaigns</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400">
              <th className="px-6 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Max Recipients</th>
              <th className="px-4 py-3 font-medium text-right">Sent</th>
              <th className="px-4 py-3 font-medium text-right">Remaining</th>
              <th className="px-4 py-3 font-medium text-right">Daily Limit</th>
              <th className="px-6 py-3 font-medium min-w-[140px]">Progress</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {campaigns.map((campaign) => {
              const maxRecipients = campaign.max_recipients ?? 0;
              const progressPercentage = maxRecipients > 0
                ? Math.round((campaign.sent_count / maxRecipients) * 100)
                : 0;

              return (
                <tr
                  key={campaign.id}
                  className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/40 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex flex-col">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {campaign.name}
                      </Link>
                      <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                        {campaign.key}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <StatusBadge status={campaign.status} size="sm" />
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {campaign.max_recipients != null ? campaign.max_recipients.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {campaign.sent_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                    {campaign.remaining_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {campaign.today_sent} / {campaign.emails_per_day}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>{campaign.sent_count} / {campaign.max_recipients != null ? campaign.max_recipients : '∞'}</span>
                        <span className="font-mono font-semibold">{progressPercentage}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {campaign.status === 'running' && (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          title="Pause Campaign"
                        >
                          <Pause className="h-3 w-3" />
                        </button>
                      )}
                      {campaign.status === 'paused' && (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                          title="Resume Campaign"
                        >
                          <Play className="h-3 w-3" />
                        </button>
                      )}
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        title="View Details"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
