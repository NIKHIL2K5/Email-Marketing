import { ServiceHealth } from '@/types';

export interface DbCampaign {
  id: string;
  campaign_key: string;
  name: string;
  description: string | null;
  status: string;
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  batch_size: number;
  emails_per_minute: number | null;
  emails_per_hour: number | null;
  emails_per_day: number | null;
  max_concurrency: number;
  max_retries: number;
  retry_backoff_seconds: number;
  max_recipients?: number | null;
  template_id?: string | null;
  template_name?: string | null;
  template_version_id?: string | null;
  template_version_number?: number | null;
  audience_id?: string | null;
  audience_version?: number | null;
  audience_snapshot_at?: string | null;
  send_mode?: string;
  created_at: string;
  updated_at: string;
}

export interface DbCampaignSummary {
  campaign_id: string;
  campaign_key: string;
  name: string;
  status: string;
  total_recipients: number;
  eligible: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  failed: number;
  blocked: number;
  cancelled: number;
  emails_per_day?: number | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  progress_percentage?: number;
  last_activity?: string;
}

export interface DbRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  email: string;
  status: string;
  attempt_count: number;
  eligibility_reason: string | null;
  queued_at: string | null;
  sending_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  cancelled_at?: string | null;
  last_error?: string | null;
  provider_message_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  title?: string | null;
  consent_status?: string | null;
  suppression_status?: string | null;
  unsubscribe_status?: string | null;
  bounce_status?: string | null;
  complaint_status?: string | null;
  eligibility_status?: string | null;
  created_at: string;
  updated_at: string;
}


export interface DbContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  email: string;
  city: string | null;
  state: string | null;
  country: string | null;
  created_at: string;
  eligibility_status?: string | null;
  eligibility_reason?: string | null;
  consent_status?: string | null;
  bounce_status?: string | null;
  complaint_status?: string | null;
  suppression_status?: string | null;
  emails_sent_count?: number;
  campaigns_count?: number;
}

export interface DbContactDetail extends DbContact {
  source_staging_id: string;
  company_name_for_emails: string | null;
  email_normalized: string;
  seniority: string | null;
  departments: string | null;
  industry: string | null;
  data_quality_status: string;
  email_validation_status: string;
  consent_source: string | null;
  consent_recorded_at: string | null;
  unsubscribe_status: string;
  eligibility_reason: string | null;
  last_evaluated_at: string | null;
  campaign_history?: Array<{
    campaign_id: string;
    campaign_name: string;
    status: string;
    sent_at: string | null;
  }>;
}

export interface DbDashboardData {
  metrics: {
    totalContacts: number;
    eligibleContacts: number;
    emailsSentToday: number;
    emailsRemainingToday: number;
    activeCampaigns: number;
    queuedRecipients: number;
    failedSends: number;
    suppressedContacts: number;
  };
  sendingCapacity: {
    sentToday: number;
    remainingToday: number;
    capacityLimit: number;
    percentage: number;
    globalLimit: number;
    campaignLimit: number;
    providerLimit: number;
    effectiveLimit: number;
    providerName: string;
    resetsAt?: string;
  };
  campaigns: Array<{
    id: string;
    name: string;
    key: string;
    description?: string;
    status: string;
    maxRecipients: number | null;
    sent: number;
    remaining: number;
    dailyLimit: number;
    progressPercentage: number;
    lastActivity: string;
  }>;
  recentActivity: Array<{
    id: string;
    time: string;
    recipient: string;
    campaign: string;
    event: string;
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'WARNING' | 'PENDING';
  }>;
  systemHealth: ServiceHealth[];
  contactHealth: {
    total: number;
    eligible: number;
    blocked: number;
    suppressed: number;
    unsubscribed: number;
    hardBounced: number;
  };
}

export interface DbDeliverabilityMetrics {
  sent: number;
  delivered: number;
  hardBounced: number;
  softBounced: number;
  complaints: number;
  unsubscribed: number;
  blocked: number;
  suppressed: number;
  recentEvents: Array<{
    id: string;
    time: string;
    recipient: string;
    campaign: string;
    provider: string;
    event: string;
    status: string;
  }>;
}

export interface DbTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  current_version?: DbTemplateVersion | null;
}

export interface DbTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  subject: string;
  html_content: string | null;
  text_content: string | null;
  variables: string[];
  created_by: string | null;
  created_at: string;
  listmonk_template_id?: number | null;
}

export interface DbAutomationRun {
  id: string;
  workflow_name: string;
  workflow_execution_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  input_data: unknown;
  output_data: unknown;
  created_at: string;
}

export interface DbPreflightCheck {
  id: string;
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  details?: string;
}

export interface DbPreflightResult {
  campaignId: string;
  campaignKey: string;
  canDispatch: boolean;
  score: number;
  checks: DbPreflightCheck[];
}
