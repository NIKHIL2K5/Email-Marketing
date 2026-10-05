'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Save,
  Clock,
  Sliders,
  Mail,
  Users,
  FileText,
  ShieldCheck,
  Rocket,
  Lock,
  Loader2,
  Database,
  Building,
  Radio,
  Eye,
  Check,
} from 'lucide-react';
import type { Audience } from '@/lib/db/queries/audience';

interface TemplateOption {
  id: string;
  name: string;
  current_version_id?: string;
  current_version?: {
    id: string;
    version_number: number;
    subject: string;
    html_content: string | null;
  };
}

const STEPS = [
  { step: 1, title: 'Details', label: 'Campaign Details' },
  { step: 2, title: 'Audience', label: 'Audience Selection' },
  { step: 3, title: 'Template', label: 'Template & Version' },
  { step: 4, title: 'Sender', label: 'Sender Identity' },
  { step: 5, title: 'Limits', label: 'Sending Limits & Cap' },
  { step: 6, title: 'Schedule', label: 'Schedule Configuration' },
  { step: 7, title: 'Pre-flight', label: 'Pre-flight Verification' },
  { step: 8, title: 'Launch', label: 'Authoritative Launch' },
];

export default function GuidedCampaignBuilderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // STEP 1: Details
  const [name, setName] = useState('');
  const [campaignKey, setCampaignKey] = useState('');
  const [description, setDescription] = useState('');
  const [sendMode, setSendMode] = useState<'test' | 'real'>('test');

  // STEP 2: Audience
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [selectedAudienceId, setSelectedAudienceId] = useState('');
  const [isLoadingAudiences, setIsLoadingAudiences] = useState(false);

  // STEP 3: Template
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [subject, setSubject] = useState('');

  // STEP 4: Sender
  const [fromName, setFromName] = useState('First Client Team');
  const [fromEmail, setFromEmail] = useState('outreach@firstclient.io');
  const [replyTo, setReplyTo] = useState('replies@firstclient.io');

  // STEP 5: Limits & Caps
  const [batchSize, setBatchSize] = useState('50');
  const [emailsPerMinute, setEmailsPerMinute] = useState('5');
  const [emailsPerHour, setEmailsPerHour] = useState('60');
  const [emailsPerDay, setEmailsPerDay] = useState('300');
  const [maxConcurrency, setMaxConcurrency] = useState('1');
  const [maxRetries, setMaxRetries] = useState('3');
  const [retryBackoffSeconds, setRetryBackoffSeconds] = useState('300');
  const [maxRecipients, setMaxRecipients] = useState('250');

  // STEP 6: Schedule
  const [scheduleMode, setScheduleMode] = useState<'draft' | 'schedule' | 'start_now'>('draft');
  const [scheduledAt, setScheduledAt] = useState('');

  // STEP 7: Pre-flight state
  const [preflightChecks, setPreflightChecks] = useState<
    Array<{ id: string; name: string; status: 'PASS' | 'WARNING' | 'BLOCKED'; message: string }>
  >([]);
  const [isPreflightValidating, setIsPreflightValidating] = useState(false);
  const [canLaunch, setCanLaunch] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Load audiences and templates on mount
  useEffect(() => {
    setIsLoadingAudiences(true);
    fetch('/api/audiences')
      .then((res) => res.json())
      .then((data) => {
        if (data.audiences && Array.isArray(data.audiences)) {
          setAudiences(data.audiences);
          if (data.audiences.length > 0) {
            setSelectedAudienceId(data.audiences[0].id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingAudiences(false));

    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data);
          if (data.length > 0) {
            setSelectedTemplateId(data[0].id);
            if (data[0].current_version) {
              setSelectedVersionId(data[0].current_version.id);
              setSubject(data[0].current_version.subject || '');
            }
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    const key = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    setCampaignKey(key);
  };

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const chosen = templates.find((t) => t.id === tplId);
    if (chosen?.current_version) {
      setSelectedVersionId(chosen.current_version.id);
      setSubject(chosen.current_version.subject || '');
    }
  };

  // Run comprehensive Step 7 Pre-flight check
  const runPreflightValidation = async () => {
    setIsPreflightValidating(true);
    const checks: Array<{ id: string; name: string; status: 'PASS' | 'WARNING' | 'BLOCKED'; message: string }> = [];

    // 1. Campaign Details
    if (!name.trim() || !campaignKey.trim()) {
      checks.push({
        id: 'campaign_valid',
        name: 'Campaign Configuration',
        status: 'BLOCKED',
        message: 'Campaign name and key are required.',
      });
    } else {
      checks.push({
        id: 'campaign_valid',
        name: 'Campaign Configuration',
        status: 'PASS',
        message: `Valid identity: "${name}" (${campaignKey}).`,
      });
    }

    // 2. Audience Selected
    const aud = audiences.find((a) => a.id === selectedAudienceId);
    if (!aud) {
      checks.push({
        id: 'audience_selected',
        name: 'Audience Selected',
        status: 'BLOCKED',
        message: 'No audience entity selected.',
      });
    } else {
      checks.push({
        id: 'audience_selected',
        name: 'Audience Selected',
        status: 'PASS',
        message: `Selected: "${aud.name}" (v${aud.version}).`,
      });
      checks.push({
        id: 'recipients_available',
        name: 'Eligible Recipients Available',
        status: aud.eligible_count > 0 ? 'PASS' : 'BLOCKED',
        message: `${aud.eligible_count.toLocaleString()} eligible contacts available in audience envelope.`,
      });
    }

    // 3. Template Exists & Locked
    if (!selectedTemplateId || !selectedVersionId) {
      checks.push({
        id: 'template_exists',
        name: 'Template & Version Locked',
        status: 'BLOCKED',
        message: 'An immutable template version must be selected.',
      });
    } else {
      checks.push({
        id: 'template_exists',
        name: 'Template & Version Locked',
        status: 'PASS',
        message: `Locked to version ID #${selectedVersionId}. Content cannot silently mutate.`,
      });
    }

    // 4. Subject & Sender
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!subject.trim()) {
      checks.push({ id: 'subject_valid', name: 'Email Subject', status: 'BLOCKED', message: 'Subject line is blank.' });
    } else {
      checks.push({ id: 'subject_valid', name: 'Email Subject', status: 'PASS', message: `Subject: "${subject}"` });
    }

    if (!fromEmail || !emailRegex.test(fromEmail)) {
      checks.push({ id: 'sender_valid', name: 'Sender Identity', status: 'BLOCKED', message: 'Invalid sender email format.' });
    } else {
      checks.push({ id: 'sender_valid', name: 'Sender Identity', status: 'PASS', message: `Sender: "${fromName}" <${fromEmail}>.` });
    }

    if (replyTo && !emailRegex.test(replyTo)) {
      checks.push({ id: 'reply_to_valid', name: 'Reply-To Routing', status: 'WARNING', message: 'Invalid reply-to email format.' });
    } else {
      checks.push({ id: 'reply_to_valid', name: 'Reply-To Routing', status: 'PASS', message: `Reply routing to ${replyTo || fromEmail}.` });
    }

    // 5. Rate Limits & Max Recipients
    const cap = parseInt(maxRecipients, 10);
    if (!cap || cap <= 0) {
      checks.push({ id: 'max_recipients_valid', name: 'Maximum Recipient Cap', status: 'WARNING', message: 'No lifetime recipient cap specified.' });
    } else {
      checks.push({ id: 'max_recipients_valid', name: 'Maximum Recipient Cap', status: 'PASS', message: `Authoritative DB cap enforced at ${cap} recipients.` });
    }

    // 6. Send Mode
    checks.push({
      id: 'send_mode_valid',
      name: 'Send Mode Safety Gate',
      status: sendMode === 'real' ? 'WARNING' : 'PASS',
      message: sendMode === 'real' ? 'REAL mode selected: Live outbound emails will be delivered!' : 'TEST mode: Safe sandbox delivery.',
    });

    // 7. System Health Probe
    try {
      const hRes = await fetch('/api/health');
      const healthData = await hRes.json();
      const services = healthData.services || [];
      const pg = services.find((s: any) => s.id === 'postgres');
      const n8n = services.find((s: any) => s.id === 'n8n');
      const lm = services.find((s: any) => s.id === 'listmonk');

      checks.push({
        id: 'database_available',
        name: 'PostgreSQL Datastore',
        status: pg?.status === 'healthy' ? 'PASS' : 'BLOCKED',
        message: pg?.detail || 'PostgreSQL connected.',
      });

      checks.push({
        id: 'n8n_available',
        name: 'n8n Automation Engine',
        status: n8n?.status === 'healthy' || n8n?.status === 'connected' ? 'PASS' : 'WARNING',
        message: n8n?.detail || 'n8n responsive.',
      });

      checks.push({
        id: 'listmonk_available',
        name: 'Listmonk Mailing Engine',
        status: lm?.status === 'healthy' || lm?.status === 'connected' ? 'PASS' : 'WARNING',
        message: lm?.detail || 'Listmonk responsive.',
      });
    } catch {
      checks.push({
        id: 'services_probe',
        name: 'Infrastructure Health Probe',
        status: 'WARNING',
        message: 'Could not complete background infrastructure health probe.',
      });
    }

    setPreflightChecks(checks);
    const hasBlocked = checks.some((c) => c.status === 'BLOCKED');
    setCanLaunch(!hasBlocked);
    setIsPreflightValidating(false);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!name.trim() || !campaignKey.trim()) {
        setErrorBanner('Campaign Name and Key are required.');
        return;
      }
    }
    setErrorBanner(null);
    if (currentStep === 6) {
      runPreflightValidation();
    }
    setCurrentStep((prev) => Math.min(8, prev + 1));
  };

  const handlePrevStep = () => {
    setErrorBanner(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleLaunchCampaign = async () => {
    if (!canLaunch || isSubmitting) return;

    if (sendMode === 'real') {
      const ok = confirm('FINAL CONFIRMATION: Launch this campaign in REAL production sending mode?');
      if (!ok) return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      // 1. Create campaign
      const campPayload = {
        name: name.trim(),
        campaign_key: campaignKey.trim(),
        description: description.trim() || undefined,
        subject: subject.trim(),
        from_name: fromName.trim() || undefined,
        from_email: fromEmail.trim(),
        reply_to: replyTo.trim() || undefined,
        batch_size: parseInt(batchSize, 10),
        emails_per_minute: parseInt(emailsPerMinute, 10),
        emails_per_hour: parseInt(emailsPerHour, 10),
        emails_per_day: parseInt(emailsPerDay, 10),
        max_concurrency: parseInt(maxConcurrency, 10),
        max_retries: parseInt(maxRetries, 10),
        retry_backoff_seconds: parseInt(retryBackoffSeconds, 10),
        max_recipients: maxRecipients ? parseInt(maxRecipients, 10) : null,
        template_id: selectedTemplateId || null,
        template_version_id: selectedVersionId || null,
        send_mode: sendMode,
        scheduled_at: scheduleMode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
        start_mode: scheduleMode,
      };

      const cRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campPayload),
      });

      const cData = await cRes.json();
      if (!cRes.ok || !cData.campaign) {
        throw new Error(cData.error || 'Failed to create campaign entity');
      }

      const campaignId = cData.campaign.id;

      // 2. Assign audience snapshot
      if (selectedAudienceId) {
        const aRes = await fetch(`/api/campaigns/${campaignId}/assign-audience`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audienceId: selectedAudienceId }),
        });
        if (!aRes.ok) {
          console.warn('Audience snapshot failed to bind');
        }
      }

      // Success -> navigate to campaign detail
      router.push(`/campaigns/${campaignId}`);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to launch campaign');
      setIsSubmitting(false);
    }
  };

  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/campaigns"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Guided 8-Step Campaign Builder
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Configure, bind snapshot, lock immutable template, verify safety gates, and launch.
          </p>
        </div>
      </div>

      {/* Wizard Progress Bar */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center justify-between min-w-[650px] border-b border-zinc-200 pb-3 dark:border-zinc-800">
          {STEPS.map((s) => (
            <div
              key={s.step}
              onClick={() => {
                if (s.step < currentStep) setCurrentStep(s.step);
              }}
              className={`flex items-center gap-2 cursor-pointer ${
                s.step === currentStep
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : s.step < currentStep
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-zinc-400 font-normal'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono font-bold ${
                  s.step === currentStep
                    ? 'bg-indigo-600 text-white'
                    : s.step < currentStep
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                }`}
              >
                {s.step < currentStep ? '✓' : s.step}
              </div>
              <span className="text-xs">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {errorBanner && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          ✕ {errorBanner}
        </div>
      )}

      {/* Step Panels */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 min-h-[380px]">
        {/* STEP 1: Campaign Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 1: Campaign Details & Operational Mode
            </h2>
            <p className="text-xs text-zinc-500">
              Define the campaign identity and operational dispatch safety mode.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. October Outbound - SaaS Founders"
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Campaign Key (Authoritative Slug) *
                </label>
                <input
                  type="text"
                  value={campaignKey}
                  onChange={(e) => setCampaignKey(e.target.value)}
                  placeholder="october-outbound-saas"
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Description / Operational Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Targeting verified founders in software & internet"
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Send Mode
                </label>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setSendMode('test')}
                    className={`cursor-pointer rounded border p-3 ${
                      sendMode === 'test'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-blue-700 dark:text-blue-400">TEST / SIMULATION</div>
                    <div className="text-[11px] text-zinc-500">Executes full pipeline safely with test routing.</div>
                  </div>

                  <div
                    onClick={() => setSendMode('real')}
                    className={`cursor-pointer rounded border p-3 ${
                      sendMode === 'real'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-emerald-700 dark:text-emerald-400">REAL / PRODUCTION</div>
                    <div className="text-[11px] text-zinc-500">Delivers genuine emails via Brevo SMTP relay.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Audience */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 2: Audience Definition & Deterministic Snapshot Binding
            </h2>
            <p className="text-xs text-zinc-500">
              Select an authoritative audience. A point-in-time snapshot will be permanently bound to this campaign.
            </p>

            {isLoadingAudiences ? (
              <div className="py-8 text-center text-xs text-zinc-500">Loading audience definitions...</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {audiences.map((aud) => (
                    <div
                      key={aud.id}
                      onClick={() => setSelectedAudienceId(aud.id)}
                      className={`cursor-pointer rounded-lg border p-4 transition ${
                        selectedAudienceId === aud.id
                          ? 'border-indigo-600 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/30'
                          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{aud.name}</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono font-bold dark:bg-zinc-800">
                          v{aud.version}
                        </span>
                      </div>
                      {aud.description && (
                        <p className="mt-1 text-[11px] text-zinc-500 truncate">{aud.description}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between text-[11px] border-t border-zinc-100 pt-2 dark:border-zinc-800">
                        <span className="text-emerald-600 font-semibold">
                          {(aud.eligible_count || 0).toLocaleString()} eligible
                        </span>
                        <span className="text-zinc-400">{(aud.total_matching || 0).toLocaleString()} matching</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedAudience && (
                  <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400">
                    ✓ Selected audience <strong>{selectedAudience.name}</strong> will create snapshot #
                    {selectedAudience.version} with {selectedAudience.eligible_count} candidate recipients.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Template & Immutable Version */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 3: Template & Immutable Version Locking
            </h2>
            <p className="text-xs text-zinc-500">
              Select the email template. The specific version will be locked to this campaign upon launch.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Select Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Current: v{t.current_version?.version_number || 1})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Subject Line Header *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Quick question regarding operations at {{company}}"
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {selectedTemplate?.current_version?.html_content && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Template Content Preview
                  </label>
                  <div className="max-h-40 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 whitespace-pre-wrap">
                    {selectedTemplate.current_version.html_content}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Sender */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 4: Sender Identity & Domain Alignment
            </h2>
            <p className="text-xs text-zinc-500">
              Specify the sender name, email address, and reply-to routing.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  From Name
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  From Email *
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Reply-To Email
                </label>
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Limits & Cap */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 5: Sending Controls & Authoritative Recipient Cap
            </h2>
            <p className="text-xs text-zinc-500">
              PostgreSQL strictly enforces these rate parameters and lifetime recipient limits.
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Emails / Minute
                </label>
                <input
                  type="number"
                  value={emailsPerMinute}
                  onChange={(e) => setEmailsPerMinute(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Emails / Hour
                </label>
                <input
                  type="number"
                  value={emailsPerHour}
                  onChange={(e) => setEmailsPerHour(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Emails / Day
                </label>
                <input
                  type="number"
                  value={emailsPerDay}
                  onChange={(e) => setEmailsPerDay(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Max Lifetime Cap *
                </label>
                <input
                  type="number"
                  value={maxRecipients}
                  onChange={(e) => setMaxRecipients(e.target.value)}
                  className="mt-1 w-full rounded border border-indigo-400 bg-white px-3 py-2 font-mono text-xs font-bold text-indigo-700 dark:bg-zinc-800 dark:text-indigo-300"
                />
              </div>
            </div>

            <div className="rounded bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400">
              💡 <strong>PostgreSQL Enforced:</strong> The database send slot procedure will hard-stop
              dispatching once {maxRecipients || 'N/A'} recipients are reached, regardless of how many times
              n8n triggers or how many parallel cycles are executed.
            </div>
          </div>
        )}

        {/* STEP 6: Schedule */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 6: Schedule & Dispatch Lifecycle
            </h2>
            <p className="text-xs text-zinc-500">
              Choose how and when this campaign transitions to active execution.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
              <div
                onClick={() => setScheduleMode('draft')}
                className={`cursor-pointer rounded-lg border p-4 ${
                  scheduleMode === 'draft' ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800' : 'border-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-zinc-800 dark:text-zinc-200">Save as Draft</div>
                <div className="mt-1 text-[11px] text-zinc-500">Review in console before scheduling.</div>
              </div>

              <div
                onClick={() => setScheduleMode('schedule')}
                className={`cursor-pointer rounded-lg border p-4 ${
                  scheduleMode === 'schedule' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-indigo-700 dark:text-indigo-400">Schedule at Date/Time</div>
                <div className="mt-1 text-[11px] text-zinc-500">n8n cron will execute when due.</div>
              </div>

              <div
                onClick={() => setScheduleMode('start_now')}
                className={`cursor-pointer rounded-lg border p-4 ${
                  scheduleMode === 'start_now' ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-emerald-700 dark:text-emerald-400">Start Immediately</div>
                <div className="mt-1 text-[11px] text-zinc-500">Transitions to RUNNING immediately upon launch.</div>
              </div>
            </div>

            {scheduleMode === 'schedule' && (
              <div className="pt-2 max-w-sm">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Target Launch Timestamp *
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 7: Pre-flight Verification */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Step 7: Pre-flight Gate Verification
                </h2>
                <p className="text-xs text-zinc-500">
                  Authoritative pre-launch checks. Campaign cannot be launched if any BLOCKED condition exists.
                </p>
              </div>

              <button
                onClick={runPreflightValidation}
                disabled={isPreflightValidating}
                className="inline-flex items-center gap-1 rounded bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Re-check Gates
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {preflightChecks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50/60 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/40"
                >
                  <div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{chk.name}: </span>
                    <span className="text-zinc-600 dark:text-zinc-400">{chk.message}</span>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                      chk.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : chk.status === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {chk.status}
                  </span>
                </div>
              ))}
            </div>

            <div
              className={`rounded-lg p-3 text-xs font-semibold ${
                canLaunch
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {canLaunch
                ? '✓ All critical safety gates PASSED. Ready for authoritative launch.'
                : '✕ BLOCKED condition detected. Review above requirements before launching.'}
            </div>
          </div>
        )}

        {/* STEP 8: Authoritative Launch */}
        {currentStep === 8 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Step 8: Final Review & Launch
            </h2>
            <p className="text-xs text-zinc-500">
              Review configuration summary. Clicking launch writes records to PostgreSQL and creates the immutable bindings.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div>
                <span className="text-zinc-400">Campaign:</span>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name} ({campaignKey})</div>
              </div>
              <div>
                <span className="text-zinc-400">Audience:</span>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedAudience?.name || 'Master Master Audience'}
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Template Version:</span>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedTemplate?.name || 'Direct Outreach'} (v{selectedTemplate?.current_version?.version_number || 1})
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Sender Identity:</span>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {fromName} &lt;{fromEmail}&gt;
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Lifetime Recipient Cap:</span>
                <div className="font-bold text-indigo-600 dark:text-indigo-400">{maxRecipients || 'Unlimited'} recipients</div>
              </div>
              <div>
                <span className="text-zinc-400">Send Mode:</span>
                <div className="font-bold uppercase text-zinc-800 dark:text-zinc-200">{sendMode}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={!canLaunch || isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                <span>{isSubmitting ? 'Creating...' : 'Launch Campaign'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons (Prev / Next) */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>

        {currentStep < 8 && (
          <button
            type="button"
            onClick={handleNextStep}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Next Step
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
