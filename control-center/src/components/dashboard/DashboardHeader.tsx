'use client';

import React, { useState } from 'react';
import { RefreshCw, Calendar } from 'lucide-react';

interface DashboardHeaderProps {
  onRefresh?: () => void;
}

export function DashboardHeader({ onRefresh }: DashboardHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('Just now');

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) {
      onRefresh();
    }
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 600);
  };

  // Static formatted date for SSR consistency
  const currentDateDisplay = 'Saturday, Oct 3, 2026';

  return (
    <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 dark:border-zinc-800/80 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Monitor campaigns, contacts, sending limits and delivery health.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Date / Time Indicator */}
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-medium">{currentDateDisplay}</span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="font-mono text-[11px] text-zinc-400">Updated: {lastRefreshed}</span>
        </div>

        {/* Interactive Refresh Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-zinc-400"
          aria-label="Refresh telemetry data"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isRefreshing ? 'animate-spin text-zinc-900 dark:text-white' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}
