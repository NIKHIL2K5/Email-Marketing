'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Users,
  ShieldCheck,
  UserX,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Loader2,
  X,
  Building,
  Mail,
  MapPin,
  Calendar,
  Layers,
} from 'lucide-react';
import { DbContact, DbContactDetail, DbCampaignSummary } from '@/lib/db';
import { MetricCard } from '@/components/dashboard/MetricCard';

interface ContactDirectoryClientProps {
  initialContacts: DbContact[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialTotalPages: number;
  initialContactHealth: {
    total: number;
    eligible: number;
    blocked: number;
    suppressed: number;
    unsubscribed: number;
    hardBounced: number;
  };
  campaigns: DbCampaignSummary[];
}

export function ContactDirectoryClient({
  initialContacts,
  initialTotal,
  initialPage,
  initialPageSize,
  initialTotalPages,
  initialContactHealth,
  campaigns,
}: ContactDirectoryClientProps) {
  const [contacts, setContacts] = useState<DbContact[]>(initialContacts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Contact Inspector Drawer
  const [selectedContact, setSelectedContact] = useState<DbContactDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Audience Ingestion Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.campaign_id || '');
  const [assignLimit, setAssignLimit] = useState('500');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Contact Block / Unblock State
  const [togglingBlockId, setTogglingBlockId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggleBlock = async (contactId: string, block: boolean) => {
    setTogglingBlockId(contactId);
    setToastMessage(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update contact block status');

      // Optimistically update list
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? {
                ...c,
                eligibility_status: data.data.eligibility_status,
                eligibility_reason: data.data.eligibility_reason,
                suppression_status: data.data.suppression_status,
                emails_sent_count: data.data.emails_sent_count ?? c.emails_sent_count,
              }
            : c
        )
      );

      // If drawer is open for this contact, update drawer state as well
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact((prev) =>
          prev
            ? {
                ...prev,
                eligibility_status: data.data.eligibility_status,
                eligibility_reason: data.data.eligibility_reason,
                suppression_status: data.data.suppression_status,
                emails_sent_count: data.data.emails_sent_count ?? prev.emails_sent_count,
              }
            : null
        );
      }

      setToastMessage({
        type: 'success',
        text: block
          ? `Contact #${contactId} has been BLOCKED from all campaigns.`
          : `Contact #${contactId} has been UNBLOCKED and is now ELIGIBLE for sending!`,
      });
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error changing contact status',
      });
    } finally {
      setTogglingBlockId(null);
    }
  };

  const fetchContacts = async (p: number, s: string, filter: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));
      if (s.trim()) params.set('search', s.trim());
      if (filter && filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContacts(1, searchTerm, statusFilter);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchContacts(1, searchTerm, newStatus);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchContacts(newPage, searchTerm, statusFilter);
    }
  };

  const openContactDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedContact(data);
      }
    } catch (err) {
      console.error('Failed to fetch contact profile:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleAssignAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId) return;

    setIsAssigning(true);
    setAssignMessage(null);
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignId}/assign-audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: parseInt(assignLimit, 10) }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignMessage({
          type: 'success',
          text: data.message || `Successfully attached ${data.insertedCount} contacts!`,
        });
      } else {
        setAssignMessage({ type: 'error', text: data.error || 'Failed to attach audience' });
      }
    } catch (err) {
      setAssignMessage({ type: 'error', text: 'Network connection failed' });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Contacts & Audience Control
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Authoritative directory of {initialContactHealth.total.toLocaleString()} records from PostgreSQL.
          </p>
        </div>

        <button
          onClick={() => {
            setAssignMessage(null);
            setShowAssignModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer transition shrink-0"
        >
          <Layers className="h-4 w-4" />
          <span>Attach Audience to Campaign</span>
        </button>
      </div>

      {/* Action Notification Toast */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs font-medium ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Stored Contacts"
          value={initialContactHealth.total}
          subtext="In PostgreSQL contacts table"
          icon={Users}
          badge={{ text: 'Authoritative', variant: 'neutral' }}
        />
        <MetricCard
          label="Eligible Recipients"
          value={initialContactHealth.eligible}
          subtext={`${((initialContactHealth.eligible / (initialContactHealth.total || 1)) * 100).toFixed(1)}% ready to receive email`}
          icon={ShieldCheck}
          badge={{ text: 'Ready to send', variant: 'success' }}
        />
        <MetricCard
          label="Suppressed / Ineligible"
          value={initialContactHealth.suppressed + initialContactHealth.hardBounced}
          subtext="Hard bounced, opt-out, or blocked"
          icon={UserX}
          badge={{ text: 'Protected', variant: 'danger' }}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email, name, or company..."
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100"
            />
          </form>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'eligible', label: 'Eligible' },
              { id: 'blocked', label: 'Blocked' },
              { id: 'suppressed', label: 'Suppressed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleStatusChange(tab.id)}
                className={`rounded-lg px-3 py-1.5 font-medium transition cursor-pointer shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" suppressHydrationWarning>
            <thead className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-900/50" suppressHydrationWarning>
              <tr>
                <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Contact</th>
                <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Company & Title</th>
                <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Location</th>
                <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Eligibility</th>
                <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Emails Sent</th>
                <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Consent</th>
                <th className="py-3 px-4 text-right font-semibold text-zinc-600 dark:text-zinc-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800" suppressHydrationWarning>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-500 mb-2" />
                    <span>Loading authoritative contacts from PostgreSQL...</span>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No contacts matched your search query.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed Contact';
                  const isEligible = c.eligibility_status === 'eligible';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition group cursor-pointer"
                      onClick={() => openContactDetail(c.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                            {fullName}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            {c.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-zinc-800 dark:text-zinc-200">{c.company || '—'}</span>
                          <span className="text-[11px] text-zinc-400">{c.title || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                        {[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {isEligible ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-400 border border-rose-500/20">
                            <XCircle className="h-3 w-3" /> {c.eligibility_status || 'Blocked'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${
                          (c.emails_sent_count || 0) > 0
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          <Mail className="h-3 w-3" />
                          {c.emails_sent_count || 0} sent
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {c.consent_status || 'implied'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isEligible ? (
                            <button
                              onClick={() => handleToggleBlock(c.id, true)}
                              disabled={togglingBlockId === c.id}
                              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition cursor-pointer"
                              title="Block contact from receiving emails"
                            >
                              {togglingBlockId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                              Block
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleBlock(c.id, false)}
                              disabled={togglingBlockId === c.id}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                              title="Unblock contact and restore eligibility"
                            >
                              {togglingBlockId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                              Unblock
                            </button>
                          )}
                          <button
                            onClick={() => openContactDetail(c.id)}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 text-xs">
          <span className="text-zinc-500">
            Showing Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{page}</span> of{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages}</span> ({total.toLocaleString()} contacts)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Contact Profile Inspector Modal/Drawer */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {[selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ') ||
                      'Contact Profile'}
                  </h2>
                  <p className="font-mono text-xs text-zinc-500">{selectedContact.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-zinc-400">Company:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedContact.company || '—'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400">Title / Seniority:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {[selectedContact.title, selectedContact.seniority].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400">Industry:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedContact.industry || '—'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400">Location:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {[selectedContact.city, selectedContact.state, selectedContact.country]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400">Total Emails Sent:</span>
                <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                  {selectedContact.emails_sent_count || 0} emails sent
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400">Eligibility Status:</span>
                <p className={`font-semibold ${selectedContact.eligibility_status === 'eligible' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {selectedContact.eligibility_status === 'eligible' ? 'Eligible for Campaigns' : 'Blocked / Suppressed'}
                </p>
              </div>
              <div className="space-y-1 col-span-2">
                <span className="text-zinc-400">Eligibility Reason:</span>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {selectedContact.eligibility_reason || 'Verified opt-in consent and domain MX valid'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400">Data Quality:</span>
                <p className="font-mono text-zinc-800 dark:text-zinc-200">
                  {selectedContact.data_quality_status || 'verified'}
                </p>
              </div>
            </div>

            {/* Campaign Dispatch History */}
            <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Campaign Participation History
              </h3>
              {selectedContact.campaign_history && selectedContact.campaign_history.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {selectedContact.campaign_history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {h.campaign_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                          {h.status}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {h.sent_at ? new Date(h.sent_at).toLocaleDateString() : 'Queued'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No previous dispatches recorded for this contact.</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {selectedContact.eligibility_status === 'eligible' ? (
                <button
                  onClick={() => handleToggleBlock(selectedContact.id, true)}
                  disabled={togglingBlockId === selectedContact.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 transition cursor-pointer"
                >
                  {togglingBlockId === selectedContact.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserX className="h-3.5 w-3.5" />
                  )}
                  Block Contact (Mark Ineligible)
                </button>
              ) : (
                <button
                  onClick={() => handleToggleBlock(selectedContact.id, false)}
                  disabled={togglingBlockId === selectedContact.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition cursor-pointer"
                >
                  {togglingBlockId === selectedContact.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  Unblock Contact (Restore Eligibility)
                </button>
              )}
              <button
                onClick={() => setSelectedContact(null)}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach Audience Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Attach Audience to Campaign
                </h2>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {assignMessage && (
              <div
                className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                  assignMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:text-emerald-300'
                    : 'bg-rose-500/10 text-rose-800 border border-rose-500/20 dark:text-rose-300'
                }`}
              >
                {assignMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{assignMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleAssignAudience} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Target Campaign <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {campaigns.map((camp) => (
                    <option key={camp.campaign_id} value={camp.campaign_id}>
                      {camp.name} ({camp.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Maximum Contacts to Ingest
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={assignLimit}
                  onChange={(e) => setAssignLimit(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
                <p className="text-[11px] text-zinc-400">
                  Only eligible, non-suppressed contacts not already in this campaign will be attached.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isAssigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isAssigning ? 'Ingesting...' : 'Ingest Eligible Audience'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
