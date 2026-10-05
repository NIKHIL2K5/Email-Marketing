'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  AlertTriangle,
  Save,
  Layers,
  ChevronRight,
  Database,
  Building,
  Globe,
  Tag,
  RefreshCw,
} from 'lucide-react';
import type { Audience, AudienceRules, AudiencePreviewResult } from '@/lib/db/queries/audience';

interface AudienceBuilderClientProps {
  initialAudiences: Audience[];
}

const AVAILABLE_FIELDS = [
  { value: 'industry', label: 'Industry', category: 'Company' },
  { value: 'company', label: 'Company Name', category: 'Company' },
  { value: 'employees', label: 'Company Size / Employees', category: 'Company' },
  { value: 'country', label: 'Country', category: 'Location' },
  { value: 'state', label: 'State / Region', category: 'Location' },
  { value: 'city', label: 'City', category: 'Location' },
  { value: 'seniority', label: 'Seniority', category: 'Contact' },
  { value: 'departments', label: 'Department', category: 'Contact' },
  { value: 'eligibility_status', label: 'Eligibility Status', category: 'Compliance' },
  { value: 'consent_status', label: 'Consent Status', category: 'Compliance' },
  { value: 'suppression_status', label: 'Suppression Status', category: 'Compliance' },
  { value: 'bounce_status', label: 'Bounce Status', category: 'Compliance' },
  { value: 'complaint_status', label: 'Complaint Status', category: 'Compliance' },
  { value: 'email_validation_status', label: 'Email Validation Status', category: 'Compliance' },
  { value: 'search', label: 'Search Keyword (Email/Name/Company)', category: 'General' },
];

const AVAILABLE_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'in', label: 'is in (comma-separated)' },
  { value: 'not_in', label: 'is not in (comma-separated)' },
  { value: 'is_empty', label: 'is empty / null' },
  { value: 'is_not_empty', label: 'is not empty' },
];

export function AudienceBuilderClient({ initialAudiences }: AudienceBuilderClientProps) {
  const [audiences, setAudiences] = useState<Audience[]>(initialAudiences);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<AudienceRules>({
    combinator: 'AND',
    groups: [
      {
        combinator: 'AND',
        conditions: [
          { field: 'eligibility_status', operator: 'equals', value: 'eligible' },
        ],
      },
    ],
  });

  // Preview State
  const [preview, setPreview] = useState<AudiencePreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Trigger live preview when rules change
  useEffect(() => {
    if (!isCreating && !editingId) return;

    const timer = setTimeout(() => {
      fetchPreview(rules);
    }, 400);

    return () => clearTimeout(timer);
  }, [rules, isCreating, editingId]);

  const fetchPreview = async (rulesToTest: AudienceRules) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch('/api/audiences/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: rulesToTest }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to preview audience');
      }
      setPreview(data.preview);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleAddGroup = () => {
    setRules((prev) => ({
      ...prev,
      groups: [
        ...prev.groups,
        {
          combinator: 'AND',
          conditions: [{ field: 'industry', operator: 'contains', value: '' }],
        },
      ],
    }));
  };

  const handleRemoveGroup = (groupIndex: number) => {
    setRules((prev) => ({
      ...prev,
      groups: prev.groups.filter((_, idx) => idx !== groupIndex),
    }));
  };

  const handleAddCondition = (groupIndex: number) => {
    setRules((prev) => {
      const newGroups = [...prev.groups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        conditions: [
          ...newGroups[groupIndex].conditions,
          { field: 'country', operator: 'equals', value: '' },
        ],
      };
      return { ...prev, groups: newGroups };
    });
  };

  const handleRemoveCondition = (groupIndex: number, condIndex: number) => {
    setRules((prev) => {
      const newGroups = [...prev.groups];
      const filtered = newGroups[groupIndex].conditions.filter((_, idx) => idx !== condIndex);
      if (filtered.length === 0) {
        return {
          ...prev,
          groups: prev.groups.filter((_, idx) => idx !== groupIndex),
        };
      }
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        conditions: filtered,
      };
      return { ...prev, groups: newGroups };
    });
  };

  const handleConditionChange = (
    groupIndex: number,
    condIndex: number,
    patch: Partial<{ field: any; operator: any; value: string }>
  ) => {
    setRules((prev) => {
      const newGroups = [...prev.groups];
      const newConditions = [...newGroups[groupIndex].conditions];
      newConditions[condIndex] = { ...newConditions[condIndex], ...patch };
      newGroups[groupIndex] = { ...newGroups[groupIndex], conditions: newConditions };
      return { ...prev, groups: newGroups };
    });
  };

  const handleGroupCombinatorChange = (groupIndex: number, combinator: 'AND' | 'OR') => {
    setRules((prev) => {
      const newGroups = [...prev.groups];
      newGroups[groupIndex] = { ...newGroups[groupIndex], combinator };
      return { ...prev, groups: newGroups };
    });
  };

  const handleSaveAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError('Audience name is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    try {
      const url = editingId ? `/api/audiences/${editingId}` : '/api/audiences';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          rules,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save audience');
      }

      setSuccessMessage(
        editingId
          ? `Audience "${data.audience.name}" updated to v${data.audience.version}`
          : `Audience "${data.audience.name}" created successfully!`
      );

      // Refresh list
      const listRes = await fetch('/api/audiences');
      const listData = await listRes.json();
      if (listData.audiences) {
        setAudiences(listData.audiences);
      }

      setIsCreating(false);
      setEditingId(null);
      setName('');
      setDescription('');
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (aud: Audience) => {
    setEditingId(aud.id);
    setName(aud.name);
    setDescription(aud.description || '');
    setRules(
      aud.rules && aud.rules.groups?.length > 0
        ? aud.rules
        : {
            combinator: 'AND',
            groups: [
              {
                combinator: 'AND',
                conditions: [{ field: 'eligibility_status', operator: 'equals', value: 'eligible' }],
              },
            ],
          }
    );
    setIsCreating(true);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDelete = async (audId: string) => {
    if (!confirm('Are you sure you want to delete this audience definition?')) return;

    try {
      const res = await fetch(`/api/audiences/${audId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete audience');
      }
      setAudiences((prev) => prev.filter((a) => a.id !== audId));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top action header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Authoritative Audience Engine
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Define multi-condition AND/OR audience envelopes and bind immutable snapshots to campaigns
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isCreating && (
            <button
              onClick={() => {
                setEditingId(null);
                setName('');
                setDescription('');
                setRules({
                  combinator: 'AND',
                  groups: [
                    {
                      combinator: 'AND',
                      conditions: [
                        { field: 'eligibility_status', operator: 'equals', value: 'eligible' },
                      ],
                    },
                  ],
                });
                setIsCreating(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Create Audience
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ {successMessage}
        </div>
      )}

      {/* Audience Builder / Editor Form */}
      {isCreating && (
        <div className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm dark:border-indigo-900/50 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {editingId ? 'Edit Audience Definition' : 'Build New Authoritative Audience'}
              </h2>
            </div>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveAudience} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Audience Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., US SaaS Tech Founders (Q4 Priority)"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Targeting verified founders in software & internet"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Filter Envelope Builder */}
            <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Filter Logic Envelope
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">Combine Groups with:</span>
                  <select
                    value={rules.combinator}
                    onChange={(e) =>
                      setRules((prev) => ({ ...prev, combinator: e.target.value as 'AND' | 'OR' }))
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <option value="AND">AND (All groups match)</option>
                    <option value="OR">OR (Any group matches)</option>
                  </select>
                </div>
              </div>

              {/* Rule Groups */}
              <div className="space-y-4">
                {rules.groups.map((group, groupIdx) => (
                  <div
                    key={groupIdx}
                    className="relative rounded-md border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        <span>Group {groupIdx + 1}: Match</span>
                        <select
                          value={group.combinator}
                          onChange={(e) =>
                            handleGroupCombinatorChange(groupIdx, e.target.value as 'AND' | 'OR')
                          }
                          className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-xs font-bold text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-indigo-400"
                        >
                          <option value="AND">ALL (AND)</option>
                          <option value="OR">ANY (OR)</option>
                        </select>
                        <span>of the following conditions:</span>
                      </div>

                      {rules.groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(groupIdx)}
                          className="text-zinc-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Conditions */}
                    <div className="space-y-2">
                      {group.conditions.map((cond, condIdx) => (
                        <div key={condIdx} className="flex flex-wrap items-center gap-2">
                          <select
                            value={cond.field}
                            onChange={(e) =>
                              handleConditionChange(groupIdx, condIdx, { field: e.target.value })
                            }
                            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            {AVAILABLE_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>

                          <select
                            value={cond.operator}
                            onChange={(e) =>
                              handleConditionChange(groupIdx, condIdx, { operator: e.target.value })
                            }
                            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            {AVAILABLE_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                            <input
                              type="text"
                              value={cond.value}
                              onChange={(e) =>
                                handleConditionChange(groupIdx, condIdx, { value: e.target.value })
                              }
                              placeholder="Value..."
                              className="flex-1 min-w-[140px] rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(groupIdx, condIdx)}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddCondition(groupIdx)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      <Plus className="h-3 w-3" />
                      Add Condition
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="inline-flex items-center gap-1.5 rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Filter Group (AND/OR)
                </button>
              </div>
            </div>

            {/* Real-time Preview Section */}
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    Authoritative Preview: Who Will Receive?
                  </span>
                  {isPreviewLoading && (
                    <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
                  )}
                </div>
              </div>

              {previewError && (
                <div className="text-xs text-rose-600 dark:text-rose-400">
                  Preview Error: {previewError}
                </div>
              )}

              {preview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    <div className="rounded border border-zinc-200 p-2.5 text-center dark:border-zinc-800">
                      <div className="text-xs text-zinc-500">Matching Contacts</div>
                      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {preview.totalMatching.toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded border border-emerald-200 bg-emerald-50/50 p-2.5 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Eligible Sendable
                      </div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
                        {preview.eligible.toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded border border-rose-200 bg-rose-50/50 p-2.5 text-center dark:border-rose-900 dark:bg-rose-950/20">
                      <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                        Blocked / Suppressed
                      </div>
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-300">
                        {(preview.blocked + preview.suppressed).toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded border border-amber-200 bg-amber-50/50 p-2.5 text-center dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Missing Consent
                      </div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-300">
                        {preview.missingConsent.toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded border border-zinc-200 p-2.5 text-center dark:border-zinc-800">
                      <div className="text-xs text-zinc-500">Unsub / Bounce</div>
                      <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {preview.unsubscribed} unsub · {preview.bounced} bnc
                      </div>
                    </div>
                  </div>

                  {/* Sample Contacts Preview */}
                  {preview.sampleContacts.length > 0 && (
                    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-2">Contact</th>
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">Location</th>
                            <th className="px-3 py-2">Eligibility</th>
                            <th className="px-3 py-2">Gate Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {preview.sampleContacts.slice(0, 5).map((c) => (
                            <tr key={c.id}>
                              <td className="px-3 py-2 font-mono">
                                <div>{c.email}</div>
                                <div className="text-[10px] text-zinc-500">
                                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div>{c.company || '—'}</div>
                                <div className="text-[10px] text-zinc-500">{c.industry || '—'}</div>
                              </td>
                              <td className="px-3 py-2 text-zinc-500">{c.country || '—'}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    c.eligibilityStatus === 'eligible'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}
                                >
                                  {c.eligibilityStatus === 'eligible' ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  {c.eligibilityStatus}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-zinc-500 max-w-[200px] truncate">
                                {c.eligibilityReason || 'Eligible'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {saveError && (
              <div className="rounded bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {saveError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : editingId ? 'Update Audience (v+1)' : 'Save Audience'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Audiences List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Persistent Audience Entities ({audiences.length})
        </h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {audiences.map((aud) => (
            <div
              key={aud.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      {aud.name}
                    </h3>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      v{aud.version}
                    </span>
                  </div>
                  {aud.description && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {aud.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(aud)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    title="Edit Audience"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(aud.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800"
                    title="Delete Audience"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center dark:border-zinc-800">
                <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/50">
                  <div className="text-[10px] text-zinc-500">Total Matching</div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {(aud.total_matching || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded bg-emerald-50/60 p-2 dark:bg-emerald-950/30">
                  <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Eligible
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                    {(aud.eligible_count || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded bg-rose-50/60 p-2 dark:bg-rose-950/30">
                  <div className="text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                    Blocked
                  </div>
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-300">
                    {(aud.blocked_count || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                <span>Updated: {new Date(aud.updated_at).toLocaleDateString()}</span>
                <span className="font-mono text-[10px]">ID: {aud.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
