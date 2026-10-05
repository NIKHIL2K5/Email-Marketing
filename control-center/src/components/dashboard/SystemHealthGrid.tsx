import React from 'react';
import { ServiceHealth } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Database, Workflow, Send, Globe, Server, CheckCircle2 } from 'lucide-react';

interface SystemHealthGridProps {
  services: ServiceHealth[];
}

export function SystemHealthGrid({ services }: SystemHealthGridProps) {
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
        return Server;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Infrastructure Health</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Authoritative datastore, orchestration pipeline, mailing daemon, and external SMTP relay
          </p>
        </div>
        <div className="text-[11px] font-mono text-zinc-400">
          <span>Target Stack: email-platform</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = getIcon(service.id);

          return (
            <div
              key={service.id}
              className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {service.name}
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {service.description}
                    </p>
                  </div>
                </div>
                <StatusBadge status={service.status} label={service.statusText} size="sm" />
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                <span>Last checked:</span>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">
                  {service.lastChecked}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
