import React from 'react';
import { MetricItem } from '@/types';
import { MetricCard } from './MetricCard';

interface TopMetricsGridProps {
  metrics: MetricItem[];
}

export function TopMetricsGrid({ metrics }: TopMetricsGridProps) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Operations Telemetry & Capacity
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} data={metric} />
        ))}
      </div>
    </div>
  );
}
