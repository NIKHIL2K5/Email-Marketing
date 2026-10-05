export type CampaignStatus =
  | 'RUNNING'
  | 'SCHEDULED'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DRAFT'
  | 'running'
  | 'scheduled'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'draft';

export interface CampaignSummary {
  id: string;
  name: string;
  key: string;
  description?: string;
  status: CampaignStatus;
  maxRecipients: number | null;
  sent: number;
  remaining: number;
  dailyLimit: number;
  hourlyLimit?: number;
  perMinuteLimit?: number;
  progressPercentage: number;
  lastActivity: string;
}

export interface Campaign extends CampaignSummary {
  max_recipients: number | null;
  sent_count: number;
  remaining_count: number;
  queued_count: number;
  failed_count: number;
  blocked_count: number;
  emails_per_day: number;
  emails_per_hour: number;
  emails_per_minute: number;
  batch_size: number;
  created_at: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  today_sent: number;
  hour_sent: number;
  minute_sent: number;
}

export interface MetricItem {
  id: string;
  title: string;
  value: number | string;
  supportingText: string;
  iconName: 'users' | 'user-check' | 'send' | 'calendar' | 'flame' | 'alert-triangle' | 'shield' | 'layers';
  trend?: {
    text: string;
    variant: 'neutral' | 'success' | 'warning' | 'danger';
  };
}

export interface DashboardMetrics {
  totalContacts: number;
  eligibleContacts: number;
  emailsSentToday: number;
  emailsRemainingToday: number;
  activeCampaigns: number;
  queuedRecipients: number;
  failedSends: number;
  suppressedContacts: number;
}

export interface SendingCapacity {
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
}

export type EventStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'WARNING' | 'PENDING';

export interface ActivityEvent {
  id: string;
  time: string;
  recipient: string;
  campaign: string;
  event: string;
  status: EventStatus;
}

// Backward compatibility alias
export interface RecentEvent {
  id: string;
  timestamp: string;
  recipient: string;
  campaign: string;
  campaignKey: string;
  event: 'Sent' | 'Delivered' | 'Opened' | 'Clicked' | 'Bounced' | 'Suppressed';
  status: 'success' | 'warning' | 'danger' | 'info';
}

export type HealthStatus = 'healthy' | 'warning' | 'unavailable' | 'connected' | 'unknown';

export interface ServiceHealth {
  id: 'postgres' | 'n8n' | 'listmonk' | 'brevo';
  name: string;
  status: HealthStatus;
  statusText: string;
  description: string;
  lastChecked: string;
  role?: string;
  host?: string;
  latencyMs?: number;
  detail?: string;
}

export interface ContactHealth {
  total: number;
  eligible: number;
  blocked: number;
  suppressed: number;
  unsubscribed: number;
  hardBounced: number;
}
