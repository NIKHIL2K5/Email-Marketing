import React from 'react';
import { CampaignStatus, EventStatus, HealthStatus } from '@/types';

interface StatusBadgeProps {
  status: CampaignStatus | HealthStatus | EventStatus | 'success' | 'warning' | 'danger' | 'info';
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const displayLabel = label || status.toUpperCase();

  const styles: Record<string, string> = {
    // Campaign & Event statuses
    running: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 ring-1 ring-emerald-500/20',
    scheduled: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 ring-1 ring-sky-500/20',
    paused: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 ring-1 ring-amber-500/20',
    draft: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20 ring-1 ring-zinc-500/20',
    completed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 ring-1 ring-blue-500/20',
    cancelled: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 ring-1 ring-zinc-500/20',
    failed: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 ring-1 ring-rose-500/20',
    blocked: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 ring-1 ring-rose-500/20',
    pending: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20 ring-1 ring-zinc-500/20',

    // Health statuses
    healthy: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 ring-1 ring-emerald-500/20',
    connected: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 ring-1 ring-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 ring-1 ring-amber-500/20',
    unavailable: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 ring-1 ring-rose-500/20',
    unknown: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 ring-1 ring-zinc-500/20',

    // Generic semantic
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 ring-1 ring-emerald-500/20',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 ring-1 ring-rose-500/20',
    info: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 ring-1 ring-indigo-500/20',
  };

  const dotColors: Record<string, string> = {
    running: 'bg-emerald-500 animate-pulse',
    scheduled: 'bg-sky-500',
    paused: 'bg-amber-500',
    draft: 'bg-zinc-400',
    completed: 'bg-blue-500',
    cancelled: 'bg-zinc-500',
    failed: 'bg-rose-500',
    blocked: 'bg-rose-500',
    pending: 'bg-zinc-400',

    healthy: 'bg-emerald-500',
    connected: 'bg-emerald-500',
    warning: 'bg-amber-500',
    unavailable: 'bg-rose-500',
    unknown: 'bg-zinc-400',

    success: 'bg-emerald-500',
    danger: 'bg-rose-500',
    info: 'bg-indigo-500',
  };

  const styleClass = styles[normalized] || styles.draft;
  const dotColor = dotColors[normalized] || dotColors.draft;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider transition-colors ${sizeClass} ${styleClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
