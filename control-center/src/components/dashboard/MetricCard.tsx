import React from 'react';
import {
  Users,
  UserCheck,
  Send,
  Calendar,
  Flame,
  AlertTriangle,
  Shield,
  Layers,
  LucideIcon,
} from 'lucide-react';
import { MetricItem } from '@/types';

const iconMap: Record<string, LucideIcon> = {
  'users': Users,
  'user-check': UserCheck,
  'send': Send,
  'calendar': Calendar,
  'flame': Flame,
  'alert-triangle': AlertTriangle,
  'shield': Shield,
  'layers': Layers,
};

interface MetricCardProps {
  data?: MetricItem;
  // Fallbacks for direct props
  label?: string;
  value?: string | number;
  subtext?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant: 'neutral' | 'success' | 'warning' | 'danger';
  };
}

export function MetricCard({ data, label, value, subtext, icon, badge }: MetricCardProps) {
  const displayTitle = data ? data.title : label || '';
  const displayValue = data ? data.value : value ?? 0;
  const displaySubtext = data ? data.supportingText : subtext || '';
  const displayTrend = data?.trend || badge;

  const IconComponent = data ? (iconMap[data.iconName] || Users) : (icon || Users);

  const badgeStyles = {
    neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  };

  const formattedValue =
    typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs transition-all hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate pr-2">
          {displayTitle}
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" aria-hidden="true">
          <IconComponent className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl font-mono">
          {formattedValue}
        </span>
        {displayTrend && (
          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-tight ${
              badgeStyles[displayTrend.variant]
            }`}
          >
            {displayTrend.text}
          </span>
        )}
      </div>

      {displaySubtext && (
        <p className="mt-2 text-[11px] leading-tight text-zinc-400 dark:text-zinc-500 line-clamp-1">
          {displaySubtext}
        </p>
      )}
    </div>
  );
}
