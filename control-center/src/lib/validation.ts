export interface CreateCampaignInput {
  name: string;
  campaign_key: string;
  description?: string;
  subject: string;
  from_name?: string;
  from_email: string;
  reply_to?: string;
  scheduled_at?: string | null;
  start_mode?: 'draft' | 'schedule' | 'start_now';
  batch_size?: number;
  emails_per_minute?: number;
  emails_per_hour?: number;
  emails_per_day?: number;
  max_concurrency?: number;
  max_retries?: number;
  retry_backoff_seconds?: number;
  max_recipients?: number | null;
  template_id?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  subject?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  scheduled_at?: string | null;
  batch_size?: number;
  emails_per_minute?: number;
  emails_per_hour?: number;
  emails_per_day?: number;
  max_concurrency?: number;
  max_retries?: number;
  retry_backoff_seconds?: number;
  max_recipients?: number | null;
  template_id?: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY_REGEX = /^[a-zA-Z0-9_-]{2,64}$/;

export function validateCampaignInput(data: Partial<CreateCampaignInput>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Required: name
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Campaign name is required';
  } else if (data.name.trim().length > 255) {
    errors.name = 'Campaign name must be under 255 characters';
  }

  // Required: campaign_key
  if (!data.campaign_key || data.campaign_key.trim().length === 0) {
    errors.campaign_key = 'Campaign key is required';
  } else if (!KEY_REGEX.test(data.campaign_key.trim())) {
    errors.campaign_key =
      'Campaign key must be 2-64 alphanumeric characters, underscores, or hyphens (no spaces)';
  }

  // Required: subject
  if (!data.subject || data.subject.trim().length === 0) {
    errors.subject = 'Email subject line is required';
  } else if (data.subject.trim().length > 255) {
    errors.subject = 'Subject line must be under 255 characters';
  }

  // Required: from_email
  if (!data.from_email || data.from_email.trim().length === 0) {
    errors.from_email = 'From email is required';
  } else if (!EMAIL_REGEX.test(data.from_email.trim())) {
    errors.from_email = 'Please provide a valid sender email address';
  }

  // Optional: reply_to
  if (data.reply_to && data.reply_to.trim().length > 0) {
    if (!EMAIL_REGEX.test(data.reply_to.trim())) {
      errors.reply_to = 'Reply-To must be a valid email address';
    }
  }

  // Numeric checks
  if (data.batch_size !== undefined) {
    const val = Number(data.batch_size);
    if (!Number.isInteger(val) || val <= 0) {
      errors.batch_size = 'Batch size must be a positive integer';
    }
  }

  if (data.emails_per_minute !== undefined && data.emails_per_minute !== null) {
    const val = Number(data.emails_per_minute);
    if (!Number.isInteger(val) || val < 0) {
      errors.emails_per_minute = 'Emails per minute must be non-negative';
    }
  }

  if (data.emails_per_hour !== undefined && data.emails_per_hour !== null) {
    const val = Number(data.emails_per_hour);
    if (!Number.isInteger(val) || val < 0) {
      errors.emails_per_hour = 'Emails per hour must be non-negative';
    }
  }

  if (data.emails_per_day !== undefined && data.emails_per_day !== null) {
    const val = Number(data.emails_per_day);
    if (!Number.isInteger(val) || val < 0) {
      errors.emails_per_day = 'Emails per day must be non-negative';
    }
  }

  if (data.max_concurrency !== undefined) {
    const val = Number(data.max_concurrency);
    if (!Number.isInteger(val) || val <= 0) {
      errors.max_concurrency = 'Maximum concurrency must be at least 1';
    }
  }

  if (data.max_retries !== undefined) {
    const val = Number(data.max_retries);
    if (!Number.isInteger(val) || val < 0) {
      errors.max_retries = 'Maximum retries must be non-negative';
    }
  }

  if (data.retry_backoff_seconds !== undefined) {
    const val = Number(data.retry_backoff_seconds);
    if (!Number.isInteger(val) || val < 0) {
      errors.retry_backoff_seconds = 'Retry backoff seconds must be non-negative';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
