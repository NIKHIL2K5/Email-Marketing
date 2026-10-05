import React from 'react';
import { ActivityEvent } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Mail, Clock } from 'lucide-react';

interface RecentActivityTableProps {
  events: ActivityEvent[];
}

export function RecentActivityTable({ events }: RecentActivityTableProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Mail className="h-4 w-4 text-zinc-500" />
            <span>Recent Sending Activity</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Real-time feed of outbound dispatch, delivery confirmations, and suppression events
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
          <Clock className="h-3 w-3" />
          <span>Last 10 Events</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400">
              <th scope="col" className="px-6 py-3 font-semibold">Time</th>
              <th scope="col" className="px-4 py-3 font-semibold">Recipient</th>
              <th scope="col" className="px-4 py-3 font-semibold">Campaign</th>
              <th scope="col" className="px-4 py-3 font-semibold">Event</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {events.map((evt) => (
              <tr
                key={evt.id}
                className="hover:bg-zinc-50/70 dark:hover:bg-zinc-850/50 transition-colors"
              >
                <td className="px-6 py-3 font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {evt.time}
                </td>
                <td className="px-4 py-3 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                  {evt.recipient}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium">
                  {evt.campaign}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {evt.event}
                </td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <StatusBadge status={evt.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
