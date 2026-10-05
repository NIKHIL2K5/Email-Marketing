import React from 'react';
import { ContactHealth } from '@/types';
import { Users } from 'lucide-react';

interface ContactHealthCardProps {
  data: ContactHealth;
}

export function ContactHealthCard({ data }: ContactHealthCardProps) {
  const { total, eligible, blocked, suppressed, unsubscribed, hardBounced } = data;

  const items = [
    {
      label: 'Eligible',
      value: eligible,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      description: 'Active & verified to receive',
    },
    {
      label: 'Blocked',
      value: blocked,
      color: 'bg-amber-500',
      textColor: 'text-amber-700 dark:text-amber-400',
      description: 'Temporary suppression / rate caps',
    },
    {
      label: 'Suppressed',
      value: suppressed,
      color: 'bg-rose-500',
      textColor: 'text-rose-700 dark:text-rose-400',
      description: 'Manual exclusion list',
    },
    {
      label: 'Unsubscribed',
      value: unsubscribed,
      color: 'bg-zinc-400',
      textColor: 'text-zinc-700 dark:text-zinc-400',
      description: 'Opt-out requests registered',
    },
    {
      label: 'Hard bounced',
      value: hardBounced,
      color: 'bg-red-600',
      textColor: 'text-red-700 dark:text-red-400',
      description: 'Permanent failure / dead inbox',
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            <span>Contact Health &amp; Eligibility Distribution</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            PostgreSQL <code className="font-mono text-zinc-700 dark:text-zinc-300">contacts</code> repository partitioned by deliverability readiness
          </p>
        </div>
        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Total: <span className="font-mono font-bold">{total.toLocaleString()}</span> contacts
        </div>
      </div>

      {/* Horizontal Stacked Visualization Bar */}
      <div className="mt-5 space-y-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          {items.map((item) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div
                key={item.label}
                title={`${item.label}: ${item.value.toLocaleString()} (${pct.toFixed(1)}%)`}
                className={`${item.color} transition-all duration-300`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Compact Breakdown Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

          return (
            <div
              key={item.label}
              className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                  {item.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-mono text-base font-bold text-zinc-900 dark:text-zinc-50">
                  {item.value.toLocaleString()}
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {pct}%
                </span>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 line-clamp-1">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
