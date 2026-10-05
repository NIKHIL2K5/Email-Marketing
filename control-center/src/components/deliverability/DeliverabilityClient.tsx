'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  MailCheck,
  AlertTriangle,
  XCircle,
  Copy,
  CheckCircle2,
  Filter,
  Radio,
  ExternalLink,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { DbDeliverabilityMetrics } from '@/lib/db';
import { MetricCard } from '@/components/dashboard/MetricCard';
import type { DomainDnsCheckResult } from '@/lib/dns';

interface DeliverabilityClientProps {
  metrics: DbDeliverabilityMetrics;
}

export function DeliverabilityClient({ metrics }: DeliverabilityClientProps) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('all');

  // Domain Readiness State
  const [domain, setDomain] = useState('firstclient.io');
  const [dnsCheck, setDnsCheck] = useState<DomainDnsCheckResult | null>(null);
  const [isDnsLoading, setIsDnsLoading] = useState(false);

  const totalSends = metrics.sent || 1;
  const deliveryPct = Math.min(100, Math.max(0, ((metrics.delivered || metrics.sent) / totalSends) * 100)).toFixed(1);
  const bouncePct = (((metrics.hardBounced + metrics.softBounced) / totalSends) * 100).toFixed(2);
  const complaintPct = ((metrics.complaints / totalSends) * 100).toFixed(2);

  const filteredEvents = metrics.recentEvents.filter((evt) => {
    if (filter === 'all') return true;
    return evt.status.toLowerCase() === filter.toLowerCase() || evt.event.toLowerCase() === filter.toLowerCase();
  });

  const fetchDnsCheck = async (targetDomain: string) => {
    setIsDnsLoading(true);
    try {
      const res = await fetch(`/api/deliverability/domain-check?domain=${encodeURIComponent(targetDomain)}`);
      const data = await res.json();
      setDnsCheck(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDnsLoading(false);
    }
  };

  useEffect(() => {
    fetchDnsCheck(domain);
  }, []);

  const handleCopyWebhookUrl = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/brevo?token=FirstClient_Brevo_Sec_2026_z78w` : '/api/webhooks/brevo';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderBadge = (status: 'verified' | 'missing' | 'invalid' | 'unknown') => {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> VERIFIED
        </span>
      );
    }
    if (status === 'missing') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3" /> MISSING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        <XCircle className="h-3 w-3" /> {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
          Deliverability & Reputation Guard
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Real-time telemetry for Brevo SMTP relay dispatch, bounce events, and sender-domain readiness.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Delivered Rate"
          value={`${deliveryPct}%`}
          subtext={`${metrics.delivered || metrics.sent} confirmed deliveries`}
          icon={MailCheck}
          badge={{ text: 'Optimal', variant: 'success' }}
        />
        <MetricCard
          label="Soft Bounces"
          value={metrics.softBounced}
          subtext="Temporary mailbox full or greylisting"
          icon={AlertTriangle}
          badge={{ text: `${bouncePct}% bounce`, variant: metrics.softBounced > 10 ? 'warning' : 'neutral' }}
        />
        <MetricCard
          label="Hard Bounces"
          value={metrics.hardBounced}
          subtext="Auto-suppressed permanent failures"
          icon={XCircle}
          badge={{ text: 'Auto-pruned', variant: metrics.hardBounced > 5 ? 'danger' : 'neutral' }}
        />
        <MetricCard
          label="Spam Complaints"
          value={metrics.complaints}
          subtext={`${complaintPct}% complaint rate`}
          icon={ShieldCheck}
          badge={{ text: 'Clean reputation', variant: 'success' }}
        />
      </div>

      {/* Domain Readiness Panel (Phase 16) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Sender Domain Authentication Readiness
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. firstclient.io"
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
            <button
              onClick={() => fetchDnsCheck(domain)}
              disabled={isDnsLoading}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <RefreshCw className={`h-3 w-3 ${isDnsLoading ? 'animate-spin' : ''}`} />
              Verify DNS
            </button>
          </div>
        </div>

        {dnsCheck && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {/* SPF */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">SPF Record</span>
                {renderBadge(dnsCheck.spf.status)}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                {dnsCheck.spf.details}
              </p>
              {dnsCheck.spf.record && (
                <div className="mt-2 truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                  {dnsCheck.spf.record}
                </div>
              )}
            </div>

            {/* DKIM */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">DKIM Key</span>
                {renderBadge(dnsCheck.dkim.status)}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                {dnsCheck.dkim.details}
              </p>
              {dnsCheck.dkim.record && (
                <div className="mt-2 truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                  {dnsCheck.dkim.record}
                </div>
              )}
            </div>

            {/* DMARC */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">DMARC Policy</span>
                {renderBadge(dnsCheck.dmarc.status)}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                {dnsCheck.dmarc.details}
              </p>
              {dnsCheck.dmarc.record && (
                <div className="mt-2 truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                  {dnsCheck.dmarc.record}
                </div>
              )}
            </div>

            {/* MX */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">MX Routing</span>
                {renderBadge(dnsCheck.mx.status)}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                {dnsCheck.mx.details}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Webhook Endpoint Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Authenticated Inbound Webhook Receiver
            </h2>
          </div>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Authenticated / Active
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Configure this URL in Brevo SMTP settings (Webhooks &gt; Transactional/Outbound) with token authentication to record real-time delivery and bounce events directly into PostgreSQL:
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 truncate">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/brevo?token=FirstClient_Brevo_Sec_2026_z78w` : '/api/webhooks/brevo?token=...'}
          </div>
          <button
            onClick={handleCopyWebhookUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Event Stream Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 overflow-hidden space-y-0">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Live Delivery & Dispatch Stream
            </h2>
          </div>

          <div className="flex items-center gap-1 text-xs">
            {['all', 'sent', 'delivered', 'failed'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer capitalize ${
                  filter === s
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="py-2.5 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Time</th>
                <th className="py-2.5 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Recipient</th>
                <th className="py-2.5 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Campaign</th>
                <th className="py-2.5 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Relay Provider</th>
                <th className="py-2.5 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400">
                    No delivery events recorded yet.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const isSuccess = ['SENT', 'DELIVERED'].includes(evt.status.toUpperCase());
                  return (
                    <tr key={evt.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-500">{evt.time}</td>
                      <td className="py-2.5 px-4 font-mono text-zinc-900 dark:text-zinc-100">{evt.recipient}</td>
                      <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">{evt.campaign}</td>
                      <td className="py-2.5 px-4 font-mono text-zinc-500">{evt.provider}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {evt.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
