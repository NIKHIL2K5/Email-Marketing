'use client';

import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Eye,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  Save,
  Loader2,
  X,
  Code,
  Sparkles,
} from 'lucide-react';
import { DbTemplate, DbTemplateVersion } from '@/lib/db';

interface TemplatesClientProps {
  initialTemplates: DbTemplate[];
}

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const [templates, setTemplates] = useState<DbTemplate[]>(initialTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<DbTemplate | null>(initialTemplates[0] || null);

  // Editor states
  const [subject, setSubject] = useState(selectedTemplate?.current_version?.subject || '');
  const [htmlContent, setHtmlContent] = useState(selectedTemplate?.current_version?.html_content || '');
  const [textContent, setTextContent] = useState(selectedTemplate?.current_version?.text_content || '');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Preview test variables
  const [previewVars, setPreviewVars] = useState({
    first_name: 'Sarah',
    company: 'Acme Innovations',
    title: 'VP of Technology',
    industry: 'Enterprise Software',
  });

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');

  // Status banners & loading
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSelectTemplate = (t: DbTemplate) => {
    setSelectedTemplate(t);
    setSubject(t.current_version?.subject || '');
    setHtmlContent(t.current_version?.html_content || '');
    setTextContent(t.current_version?.text_content || '');
    setBanner(null);
  };

  const handleSaveVersion = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          html_content: htmlContent,
          text_content: textContent,
          variables: ['first_name', 'company', 'title', 'industry'],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBanner({ type: 'success', message: `Published Version ${data.version.version_number} successfully!` });
        // Refresh template list
        const refreshRes = await fetch('/api/templates');
        if (refreshRes.ok) {
          const freshTemplates = await refreshRes.json();
          setTemplates(freshTemplates);
          const updated = freshTemplates.find((x: DbTemplate) => x.id === selectedTemplate.id);
          if (updated) setSelectedTemplate(updated);
        }
      } else {
        setBanner({ type: 'error', message: data.error || 'Failed to save new version' });
      }
    } catch {
      setBanner({ type: 'error', message: 'Network error saving version' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName,
          template_key: newTemplateKey,
          description: newTemplateDesc,
          subject: newTemplateSubject,
          html_content: '<p>Hi {{first_name}},</p><p>Your message here...</p>',
          text_content: 'Hi {{first_name}},\n\nYour message here...',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setNewTemplateName('');
        setNewTemplateKey('');
        setNewTemplateDesc('');
        setNewTemplateSubject('');

        const refreshRes = await fetch('/api/templates');
        if (refreshRes.ok) {
          const freshTemplates = await refreshRes.json();
          setTemplates(freshTemplates);
          setSelectedTemplate(data.template);
          setSubject(data.template.current_version?.subject || '');
          setHtmlContent(data.template.current_version?.html_content || '');
          setTextContent(data.template.current_version?.text_content || '');
        }
      } else {
        alert(data.error || 'Failed to create template');
      }
    } catch {
      alert('Network error creating template');
    } finally {
      setIsCreating(false);
    }
  };

  // Live variable replacement for preview
  const interpolate = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, previewVars.first_name)
      .replace(/\{\{company\}\}/g, previewVars.company)
      .replace(/\{\{title\}\}/g, previewVars.title)
      .replace(/\{\{industry\}\}/g, previewVars.industry);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Email Template Management
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Author and version email outreach content with variable interpolation and live preview.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Template</span>
        </button>
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-xs ${
            banner.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-300'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span className="font-medium">{banner.message}</span>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Template List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
            Available Templates ({templates.length})
          </div>

          <div className="space-y-2">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`rounded-xl border p-4 cursor-pointer transition ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-50/80 shadow-xs dark:border-zinc-100 dark:bg-zinc-800/50'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tpl.name}</span>
                    <span className="rounded bg-zinc-200/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      v{tpl.current_version?.version_number || 1}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">{tpl.template_key}</p>
                  {tpl.description && (
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {tpl.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Template Editor & Preview */}
        <div className="lg:col-span-8 space-y-4">
          {selectedTemplate ? (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70 overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('editor')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'editor'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Editor</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'preview'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Live Preview</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveVersion}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer transition"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{isSaving ? 'Publishing...' : 'Publish New Version'}</span>
                </button>
              </div>

              {/* Editor Tab */}
              {activeTab === 'editor' && (
                <div className="p-6 space-y-4 text-xs">
                  {/* Subject Line */}
                  <div className="space-y-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Subject Line <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Quick question regarding operations at {{company}}"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  {/* HTML Content */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                        HTML Content
                      </label>
                      <span className="text-[11px] text-zinc-400 font-mono">Supports HTML tags</span>
                    </div>
                    <textarea
                      rows={9}
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 p-3 font-mono text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  {/* Plain Text Content */}
                  <div className="space-y-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Plain Text Fallback
                    </label>
                    <textarea
                      rows={5}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 p-3 font-mono text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {/* Live Preview Tab */}
              {activeTab === 'preview' && (
                <div className="p-6 space-y-4">
                  {/* Test Variable Toggles */}
                  <div className="rounded-lg bg-zinc-50 p-3.5 border border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      <span>Test Variable Values</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="first_name"
                        value={previewVars.first_name}
                        onChange={(e) => setPreviewVars({ ...previewVars, first_name: e.target.value })}
                        className="rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <input
                        type="text"
                        placeholder="company"
                        value={previewVars.company}
                        onChange={(e) => setPreviewVars({ ...previewVars, company: e.target.value })}
                        className="rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <input
                        type="text"
                        placeholder="title"
                        value={previewVars.title}
                        onChange={(e) => setPreviewVars({ ...previewVars, title: e.target.value })}
                        className="rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <input
                        type="text"
                        placeholder="industry"
                        value={previewVars.industry}
                        onChange={(e) => setPreviewVars({ ...previewVars, industry: e.target.value })}
                        className="rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>
                  </div>

                  {/* Rendered Email Card */}
                  <div className="rounded-xl border border-zinc-300 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
                    <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800 text-xs">
                      <span className="text-zinc-400">Subject: </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {interpolate(subject)}
                      </span>
                    </div>
                    <div
                      className="prose prose-xs dark:prose-invert max-w-none text-xs text-zinc-800 dark:text-zinc-200"
                      dangerouslySetInnerHTML={{ __html: interpolate(htmlContent) }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-400 dark:border-zinc-800">
              Select or create a template to begin authoring.
            </div>
          )}
        </div>
      </div>

      {/* New Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Create Email Template</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => {
                    setNewTemplateName(e.target.value);
                    setNewTemplateKey(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                    );
                  }}
                  placeholder="e.g. Founder Outreach Sequence"
                  className="w-full rounded-lg border border-zinc-200 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Template Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateKey}
                  onChange={(e) => setNewTemplateKey(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 font-mono dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Initial Subject Line <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateSubject}
                  onChange={(e) => setNewTemplateSubject(e.target.value)}
                  placeholder="e.g. Quick intro for {{company}}"
                  className="w-full rounded-lg border border-zinc-200 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">Description</label>
                <textarea
                  rows={2}
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="Notes on target persona, tone, or strategy..."
                  className="w-full rounded-lg border border-zinc-200 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isCreating ? 'Creating...' : 'Create Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
