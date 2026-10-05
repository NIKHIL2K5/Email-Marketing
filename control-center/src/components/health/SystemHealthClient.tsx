'use client';

import React from 'react';
import {
  Activity,
  ShieldCheck,
  Layers,
  Database,
  Clock,
  Terminal,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { ServiceHealth } from '@/types';
import { DatabaseIntegrityMetric, DbAutomationRun } from '@/lib/db';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { SystemStatusCards } from '@/components/dashboard/SystemStatusCards';

interface SystemHealthClientProps {
  services: ServiceHealth[];
  queueDepth: number;
  activeWorkers: number;
  staleSendingSends: number;
  integrity: DatabaseIntegrityMetric[];
  automationRuns: DbAutomationRun[];
}

export function SystemHealthClient({
  services,
  queueDepth,
  activeWorkers,
  staleSendingSends,
  integrity,
  automationRuns,
}: SystemHealthClientProps) {
  const pgService = services.find((s) => s.id === 'postgres');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
          System Health & Execution Control
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Telemetry across PostgreSQL database, n8n workflow scheduler, Listmonk, and Brevo relay.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Queue Depth"
          value={queueDepth}
          subtext="Recipients in PostgreSQL v_send_queue"
          icon={Layers}
          badge={{ text: queueDepth > 0 ? 'Active Queue' : 'Queue Empty', variant: 'neutral' }}
        />
        <MetricCard
          label="Active Sending Workers"
          value={activeWorkers}
          subtext="n8n workflow instances executing"
          icon={Activity}
          badge={{ text: activeWorkers > 0 ? `${activeWorkers} Active` : 'Standby', variant: 'success' }}
        />
        <MetricCard
          label="Stale In-Flight Sends"
          value={staleSendingSends}
          subtext="Sending states older than 1 hour"
          icon={ShieldCheck}
          badge={{ text: staleSendingSends === 0 ? '0 Stale' : `${staleSendingSends} Stale`, variant: staleSendingSends > 0 ? 'danger' : 'success' }}
        />
        <MetricCard
          label="PostgreSQL Latency"
          value={`${pgService?.latencyMs || 0}ms`}
          subtext="Query round-trip time"
          icon={Database}
          badge={{ text: 'Connected', variant: 'success' }}
        />
      </div>

      {/* Services Grid */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
          Infrastructure Services Status
        </div>
        <SystemStatusCards services={services} />
      </div>

      {/* Database Integrity & Automation Runs Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PostgreSQL Database Integrity */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Database Table Row Counts (v_database_integrity)
              </h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-72 overflow-y-auto">
            {integrity.length === 0 ? (
              <p className="p-4 text-xs text-zinc-400">No integrity data available.</p>
            ) : (
              integrity.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{item.objectName}</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.rowCount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* n8n Automation Runs Execution Log */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                n8n Workflow Execution Log
              </h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-72 overflow-y-auto">
            {automationRuns.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No automation runs logged yet. Runs dispatched by n8n or campaigns will appear here.
              </div>
            ) : (
              automationRuns.map((run) => (
                <div key={run.id} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {run.workflow_name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                        run.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : run.status === 'running'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono">ID: {run.workflow_execution_id || run.id}</span>
                    <span>{new Date(run.started_at).toLocaleTimeString()}</span>
                  </div>
                  {run.error_message && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{run.error_message}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
