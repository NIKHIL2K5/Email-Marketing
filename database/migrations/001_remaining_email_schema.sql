BEGIN;

-- =========================================================
-- 1. SEND ATTEMPTS
-- =========================================================

CREATE TABLE IF NOT EXISTS send_attempts (
    id BIGSERIAL PRIMARY KEY,
    campaign_recipient_id BIGINT NOT NULL
        REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    provider TEXT,
    provider_message_id TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    smtp_response_code TEXT,
    provider_response TEXT,
    error_type TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT send_attempts_attempt_number_positive
        CHECK (attempt_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS
    send_attempts_recipient_attempt_unique
ON send_attempts (campaign_recipient_id, attempt_number);

CREATE INDEX IF NOT EXISTS
    send_attempts_status_retry_idx
ON send_attempts (status, next_retry_at);

CREATE INDEX IF NOT EXISTS
    send_attempts_recipient_idx
ON send_attempts (campaign_recipient_id);


-- =========================================================
-- 2. DELIVERY EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS delivery_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_recipient_id BIGINT
        REFERENCES campaign_recipients(id) ON DELETE SET NULL,
    contact_id BIGINT
        REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_id BIGINT
        REFERENCES campaigns(id) ON DELETE SET NULL,
    email_normalized TEXT NOT NULL,
    event_type TEXT NOT NULL,
    provider TEXT,
    provider_event_id TEXT,
    provider_message_id TEXT,
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
    delivery_events_provider_event_unique
ON delivery_events (provider, provider_event_id)
WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    delivery_events_contact_idx
ON delivery_events (contact_id, event_at);

CREATE INDEX IF NOT EXISTS
    delivery_events_campaign_idx
ON delivery_events (campaign_id, event_at);

CREATE INDEX IF NOT EXISTS
    delivery_events_type_idx
ON delivery_events (event_type, event_at);


-- =========================================================
-- 3. UNSUBSCRIBE EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS unsubscribe_events (
    id BIGSERIAL PRIMARY KEY,
    email_normalized TEXT NOT NULL,
    contact_id BIGINT
        REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_id BIGINT
        REFERENCES campaigns(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    unsubscribe_events_email_idx
ON unsubscribe_events (email_normalized, occurred_at);

CREATE INDEX IF NOT EXISTS
    unsubscribe_events_contact_idx
ON unsubscribe_events (contact_id, occurred_at);


-- =========================================================
-- 4. CONSENT RECORDS
-- =========================================================

CREATE TABLE IF NOT EXISTS consent_records (
    id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT NOT NULL
        REFERENCES contacts(id) ON DELETE CASCADE,
    email_normalized TEXT NOT NULL,
    consent_status TEXT NOT NULL,
    consent_source TEXT NOT NULL,
    consent_method TEXT,
    consent_text_version TEXT,
    consent_recorded_at TIMESTAMPTZ NOT NULL,
    withdrawn_at TIMESTAMPTZ,
    evidence_reference TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    consent_records_contact_idx
ON consent_records (contact_id, consent_recorded_at);

CREATE INDEX IF NOT EXISTS
    consent_records_email_idx
ON consent_records (email_normalized, consent_recorded_at);


-- =========================================================
-- 5. CAMPAIGN EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS campaign_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL
        REFERENCES campaigns(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_type TEXT,
    actor_reference TEXT,
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    campaign_events_campaign_idx
ON campaign_events (campaign_id, event_at);

CREATE INDEX IF NOT EXISTS
    campaign_events_type_idx
ON campaign_events (event_type, event_at);


-- =========================================================
-- 6. SENDING LIMITS
-- =========================================================

CREATE TABLE IF NOT EXISTS sending_limits (
    id BIGSERIAL PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    emails_per_minute INTEGER,
    emails_per_hour INTEGER,
    emails_per_day INTEGER,
    max_concurrency INTEGER,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sending_limits_scope_unique
        UNIQUE (scope_type, scope_key)
);

CREATE INDEX IF NOT EXISTS
    sending_limits_enabled_idx
ON sending_limits (enabled);


-- =========================================================
-- 7. SENDING RATE USAGE
-- =========================================================

CREATE TABLE IF NOT EXISTS sending_rate_usage (
    id BIGSERIAL PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    window_type TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    sent_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sending_rate_usage_unique
        UNIQUE (
            scope_type,
            scope_key,
            window_type,
            window_start
        ),

    CONSTRAINT sending_rate_usage_count_nonnegative
        CHECK (sent_count >= 0)
);

CREATE INDEX IF NOT EXISTS
    sending_rate_usage_lookup_idx
ON sending_rate_usage (
    scope_type,
    scope_key,
    window_type,
    window_start
);


-- =========================================================
-- 8. AUTOMATION RUNS
-- =========================================================

CREATE TABLE IF NOT EXISTS automation_runs (
    id BIGSERIAL PRIMARY KEY,
    workflow_name TEXT NOT NULL,
    workflow_execution_id TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    input_data JSONB,
    output_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
    automation_runs_execution_unique
ON automation_runs (workflow_execution_id)
WHERE workflow_execution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    automation_runs_workflow_idx
ON automation_runs (workflow_name, started_at);


-- =========================================================
-- 9. PROVIDER ACCOUNTS
-- =========================================================

CREATE TABLE IF NOT EXISTS provider_accounts (
    id BIGSERIAL PRIMARY KEY,
    provider_name TEXT NOT NULL,
    account_key TEXT NOT NULL UNIQUE,
    provider_type TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    provider_accounts_enabled_idx
ON provider_accounts (enabled);


-- =========================================================
-- 10. PROVIDER EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS provider_events (
    id BIGSERIAL PRIMARY KEY,
    provider_account_id BIGINT
        REFERENCES provider_accounts(id) ON DELETE SET NULL,
    provider_name TEXT NOT NULL,
    provider_event_id TEXT,
    event_type TEXT NOT NULL,
    provider_message_id TEXT,
    email_normalized TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
    provider_events_provider_event_unique
ON provider_events (provider_name, provider_event_id)
WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    provider_events_unprocessed_idx
ON provider_events (processed, received_at);

CREATE INDEX IF NOT EXISTS
    provider_events_message_idx
ON provider_events (provider_message_id);


-- =========================================================
-- 11. EMAIL TEMPLATES
-- =========================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id BIGSERIAL PRIMARY KEY,
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    current_version_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    email_templates_status_idx
ON email_templates (status);


-- =========================================================
-- 12. TEMPLATE VERSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS template_versions (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL
        REFERENCES email_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    variables JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT template_versions_unique
        UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS
    template_versions_template_idx
ON template_versions (template_id, version_number DESC);


-- =========================================================
-- FINISH
-- =========================================================

COMMIT;