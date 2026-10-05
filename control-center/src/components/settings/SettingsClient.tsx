'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Save,
  Radio,
  Power,
  Zap,
  RefreshCw,
} from 'lucide-react';
import type { GlobalSendingLimits } from '@/lib/db/queries/settings';

interface SettingsClientProps {
  initialLimits: GlobalSendingLimits;
  initialSendMode: string;
}

export function SettingsClient({ initialLimits, initialSendMode }: SettingsClientProps) {
  const [limits, setLimits] = useState<GlobalSendingLimits>(initialLimits);
  const [sendMode, setSendMode] = useState<string>(initialSendMode);

  // Form states
  const [minuteLimit, setMinuteLimit] = useState<number>(initialLimits.emails_per_minute);
  const [hourLimit, setHourLimit] = useState<number>(initialLimits.emails_per_hour);
  const [dayLimit, setDayLimit] = useState<number>(initialLimits.emails_per_day);
  const [concurrency, setConcurrency] = useState<number>(initialLimits.max_concurrency);

  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLimits(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails_per_minute: minuteLimit,
          emails_per_hour: hourLimit,
          emails_per_day: dayLimit,
          max_concurrency: concurrency,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update sending limits');
      }

      setLimits(data.limits);
      setStatusMessage('Global PostgreSQL sending limits updated and audited successfully.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSavingLimits(false);
    }
  };

  const handleSendModeChange = async (newMode: 'disabled' | 'test' | 'real') => {
    if (newMode === 'real') {
      const confirmed = confirm(
        'WARNING: You are about to enable REAL production sending mode. Real emails will be delivered via Brevo SMTP to actual recipients. Proceed?'
      );
      if (!confirmed) return;
    }

    setIsUpdatingMode(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_mode: newMode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update send mode');
      }

      setSendMode(data.sendMode);
      setStatusMessage(`System send mode updated to "${newMode.toUpperCase()}".`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsUpdatingMode(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
          System Settings & Operational Control
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Authoritative PostgreSQL global throttle limits, execution send mode, and provider health.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          ✕ {errorMessage}
        </div>
      )}

      {/* Global Send Mode Safety Control */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <Power className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Master Execution Send Mode
            </h2>
            <p className="text-xs text-zinc-500">
              PostgreSQL enforces this mode across all campaign dispatchers and n8n cycles.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* DISABLED */}
          <div
            onClick={() => handleSendModeChange('disabled')}
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              sendMode === 'disabled'
                ? 'border-zinc-900 bg-zinc-100/80 dark:border-zinc-100 dark:bg-zinc-800'
                : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                Disabled
              </span>
              <div
                className={`h-3 w-3 rounded-full ${
                  sendMode === 'disabled' ? 'bg-zinc-800 dark:bg-zinc-200' : 'border border-zinc-400'
                }`}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              All sending is completely blocked. No emails dispatched under any circumstances.
            </p>
          </div>

          {/* TEST */}
          <div
            onClick={() => handleSendModeChange('test')}
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              sendMode === 'test'
                ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Test / Simulation
              </span>
              <div
                className={`h-3 w-3 rounded-full ${
                  sendMode === 'test' ? 'bg-blue-600' : 'border border-zinc-400'
                }`}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Full workflow executes safely through n8n & Listmonk with test routing. Safe default.
            </p>
          </div>

          {/* REAL */}
          <div
            onClick={() => handleSendModeChange('real')}
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              sendMode === 'real'
                ? 'border-emerald-600 bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-950/30'
                : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Real / Production
              </span>
              <div
                className={`h-3 w-3 rounded-full ${
                  sendMode === 'real' ? 'bg-emerald-600' : 'border border-zinc-400'
                }`}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Production outbound delivery enabled. Emails sent to genuine contact addresses.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Global Sending Limits Form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Global Throttle Envelopes (PostgreSQL)
              </h2>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">
              Updated: {new Date(limits.updated_at).toLocaleTimeString()}
            </span>
          </div>

          <form onSubmit={handleSaveLimits} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                  Per-Minute Cap
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={minuteLimit}
                  onChange={(e) => setMinuteLimit(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                  Hourly Cap
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={hourLimit}
                  onChange={(e) => setHourLimit(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                  Daily Cap
                </label>
                <input
                  type="number"
                  min="1"
                  max="50000"
                  value={dayLimit}
                  onChange={(e) => setDayLimit(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                  Max Concurrency
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingLimits}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingLimits ? 'Saving...' : 'Save Global Limits'}
              </button>
            </div>
          </form>
        </div>

        {/* Provider Credentials Status (Infrastructure Protected) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <Shield className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Provider & Infrastructure Security
            </h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">SMTP Transport:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Brevo (Port 587 TLS)</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Mailing Engine:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Listmonk v6.2.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Orchestrator:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">n8n Automation Engine</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Credentials Boundary:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <Lock className="h-3 w-3" /> Server-side isolated (.env.local)
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-500">Browser Security Gate:</span>
              <span className="text-[11px] text-zinc-500">
                Zero client-side provider access / Zero exposed tokens
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
