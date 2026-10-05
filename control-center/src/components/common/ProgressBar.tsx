import React from 'react';

interface ProgressBarProps {
  current: number;
  max: number;
  label?: string;
  subLabel?: string;
  showPercentage?: boolean;
  colorScheme?: 'emerald' | 'indigo' | 'amber' | 'blue';
  size?: 'xs' | 'sm' | 'md';
}

export function ProgressBar({
  current,
  max,
  label,
  subLabel,
  showPercentage = true,
  colorScheme = 'emerald',
  size = 'sm',
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;

  const colorClasses = {
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
  };

  const heightClasses = {
    xs: 'h-1.5',
    sm: 'h-2',
    md: 'h-2.5',
  };

  return (
    <div className="w-full space-y-1">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{label || subLabel}</span>
          {showPercentage && <span className="font-mono font-medium">{percentage}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${heightClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[colorScheme]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
