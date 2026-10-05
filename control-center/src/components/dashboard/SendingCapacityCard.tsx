import React from 'react';
import { SendingCapacity } from '@/types';
import { Gauge, ShieldCheck, Info } from 'lucide-react';

interface SendingCapacityCardProps {
  capacity: SendingCapacity;
}

export function SendingCapacityCard({ capacity }: SendingCapacityCardProps) {
  const {
    sentToday,
    remainingToday,
    capacityLimit,
    percentage,
    globalLimit,
    campaignLimit,
    providerLimit,
    effectiveLimit,
    providerName,
  } = capacity;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Today&apos;s Sending Capacity
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Active daily quota consumption across provider &amp; campaign envelopes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {providerName}
          </span>
        </div>
      </div>

      {/* Main Gauge & Visual Progress */}
      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {sentToday}
            </span>
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              / {capacityLimit} sent
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{remainingToday}</span> remaining
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {percentage}% used
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Today's Sending Capacity"
          className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Limit Breakdown Matrix */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Global Limit</div>
          <div className="mt-1 font-mono text-base font-bold text-zinc-800 dark:text-zinc-200">
            {globalLimit} <span className="text-xs font-normal text-zinc-400">/ day</span>
          </div>
          <div className="text-[10px] text-zinc-400">System ceiling</div>
        </div>

        <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Campaign Limit</div>
          <div className="mt-1 font-mono text-base font-bold text-zinc-800 dark:text-zinc-200">
            {campaignLimit} <span className="text-xs font-normal text-zinc-400">/ day</span>
          </div>
          <div className="text-[10px] text-zinc-400">Target sequence cap</div>
        </div>

        <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Provider Limit</div>
          <div className="mt-1 font-mono text-base font-bold text-zinc-800 dark:text-zinc-200">
            {providerLimit} <span className="text-xs font-normal text-zinc-400">/ day</span>
          </div>
          <div className="text-[10px] text-zinc-400">Brevo tier limit</div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span>Effective Limit</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-800 dark:text-emerald-300">
            {effectiveLimit} <span className="text-xs font-normal text-emerald-600/80 dark:text-emerald-400/80">/ day</span>
          </div>
          <div className="text-[10px] font-medium text-emerald-600/90 dark:text-emerald-400/90">
            Lowest applicable limit
          </div>
        </div>
      </div>

      {/* Explanatory callout */}
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-zinc-50 p-2.5 text-[11px] text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
        <Info className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
        <span>
          <strong>Effective Limit Rule:</strong> Enforces the lowest applicable threshold (min of Global {globalLimit}, Campaign {campaignLimit}, Provider {providerLimit} = <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{effectiveLimit}/day</strong>). Outbound send queue will automatically halt when effective daily limit is reached.
        </span>
      </div>
    </div>
  );
}
