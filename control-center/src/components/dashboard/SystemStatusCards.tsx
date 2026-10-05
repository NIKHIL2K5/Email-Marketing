'use client';

import React from 'react';
import { ServiceHealth } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Database, Workflow, Send, Globe, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SystemStatusCardsProps {
  services: ServiceHealth[];
}

export function SystemStatusCards({ services }: SystemStatusCardsProps) {
  const getIcon = (id: ServiceHealth['id']) => {
    switch (id) {
      case 'postgres':
        return Database;
      case 'n8n':
        return Workflow;
      case 'listmonk':
        return Send;
      case 'brevo':
        return Globe;
      default:
        return Database;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Infrastructure Telemetry</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Realtime connectivity status of the 4-tier email sending stack
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Check Status</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = getIcon(service.id);

          return (
            <div
              key={service.id}
              className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {service.name}
                    </h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {service.role}
                    </p>
                  </div>
                </div>
                <StatusBadge status={service.status} size="sm" />
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                  <span>Host / Port:</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                    {service.host}
                  </span>
                </div>
                {service.latencyMs !== undefined && (
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Latency:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {service.latencyMs} ms
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 line-clamp-1">
                  {service.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
