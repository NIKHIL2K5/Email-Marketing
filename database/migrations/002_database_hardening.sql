BEGIN;

-- =========================================================
-- DATABASE HARDENING
-- First Client Email Platform
-- Migration: 002_database_hardening.sql
-- =========================================================


-- =========================================================
-- 1. GENERAL UPDATED_AT TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS campaigns_set_updated_at ON campaigns;

CREATE TRIGGER campaigns_set_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS contact_email_status_set_updated_at
ON contact_email_status;

CREATE TRIGGER contact_email_status_set_updated_at
BEFORE UPDATE ON contact_email_status
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS contact_suppressions_set_updated_at
ON contact_suppressions;

-- contact_suppressions does not have updated_at,
-- therefore no trigger is created for it.


DROP TRIGGER IF EXISTS sending_limits_set_updated_at
ON sending_limits;

CREATE TRIGGER sending_limits_set_updated_at
BEFORE UPDATE ON sending_limits
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS provider_accounts_set_updated_at
ON provider_accounts;

CREATE TRIGGER provider_accounts_set_updated_at
BEFORE UPDATE ON provider_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS email_templates_set_updated_at
ON email_templates;

CREATE TRIGGER email_templates_set_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS campaign_recipients_set_updated_at
ON campaign_recipients;

CREATE TRIGGER campaign_recipients_set_updated_at
BEFORE UPDATE ON campaign_recipients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 2. CAMPAIGN VALIDATION
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_batch_size_positive'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_batch_size_positive
        CHECK (batch_size > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_concurrency_positive'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_concurrency_positive
        CHECK (max_concurrency > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_max_retries_nonnegative'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_max_retries_nonnegative
        CHECK (max_retries >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_retry_backoff_nonnegative'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_retry_backoff_nonnegative
        CHECK (retry_backoff_seconds >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_email_limits_nonnegative'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_email_limits_nonnegative
        CHECK (
            COALESCE(emails_per_minute, 0) >= 0
            AND COALESCE(emails_per_hour, 0) >= 0
            AND COALESCE(emails_per_day, 0) >= 0
        );
    END IF;
END
$$;


-- =========================================================
-- 3. CAMPAIGN STATUS
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_status_valid'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_status_valid
        CHECK (
            status IN (
                'draft',
                'scheduled',
                'running',
                'paused',
                'completed',
                'cancelled',
                'failed'
            )
        );
    END IF;
END
$$;


-- =========================================================
-- 4. RECIPIENT STATUS
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaign_recipients_status_valid'
    ) THEN
        ALTER TABLE campaign_recipients
        ADD CONSTRAINT campaign_recipients_status_valid
        CHECK (
            status IN (
                'pending',
                'eligible',
                'blocked',
                'queued',
                'sending',
                'sent',
                'delivered',
                'failed',
                'cancelled'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaign_recipients_attempt_nonnegative'
    ) THEN
        ALTER TABLE campaign_recipients
        ADD CONSTRAINT campaign_recipients_attempt_nonnegative
        CHECK (attempt_count >= 0);
    END IF;
END
$$;


-- =========================================================
-- 5. SEND ATTEMPT VALIDATION
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'send_attempts_status_valid'
    ) THEN
        ALTER TABLE send_attempts
        ADD CONSTRAINT send_attempts_status_valid
        CHECK (
            status IN (
                'queued',
                'sending',
                'sent',
                'failed',
                'retrying',
                'cancelled'
            )
        );
    END IF;
END
$$;


-- =========================================================
-- 6. CONTACT EMAIL STATUS VALIDATION
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_email_status_consent_valid'
    ) THEN
        ALTER TABLE contact_email_status
        ADD CONSTRAINT contact_email_status_consent_valid
        CHECK (
            consent_status IN (
                'unknown',
                'granted',
                'legitimate_interest',
                'withdrawn',
                'denied'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_email_status_unsubscribe_valid'
    ) THEN
        ALTER TABLE contact_email_status
        ADD CONSTRAINT contact_email_status_unsubscribe_valid
        CHECK (
            unsubscribe_status IN (
                'not_unsubscribed',
                'unsubscribed'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_email_status_bounce_valid'
    ) THEN
        ALTER TABLE contact_email_status
        ADD CONSTRAINT contact_email_status_bounce_valid
        CHECK (
            bounce_status IN (
                'none',
                'soft',
                'hard',
                'permanent'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_email_status_complaint_valid'
    ) THEN
        ALTER TABLE contact_email_status
        ADD CONSTRAINT contact_email_status_complaint_valid
        CHECK (
            complaint_status IN (
                'none',
                'complained',
                'spam'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_email_status_suppression_valid'
    ) THEN
        ALTER TABLE contact_email_status
        ADD CONSTRAINT contact_email_status_suppression_valid
        CHECK (
            suppression_status IN (
                'not_suppressed',
                'suppressed',
                'blocked'
            )
        );
    END IF;
END
$$;


-- =========================================================
-- 7. SUPPRESSION VALIDATION
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_suppressions_type_valid'
    ) THEN
        ALTER TABLE contact_suppressions
        ADD CONSTRAINT contact_suppressions_type_valid
        CHECK (
            suppression_type IN (
                'unsubscribe',
                'hard_bounce',
                'complaint',
                'manual_block',
                'provider_block',
                'temporary_suppression'
            )
        );
    END IF;
END
$$;


-- =========================================================
-- 8. CONSENT VALIDATION
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'consent_records_status_valid'
    ) THEN
        ALTER TABLE consent_records
        ADD CONSTRAINT consent_records_status_valid
        CHECK (
            consent_status IN (
                'granted',
                'legitimate_interest',
                'withdrawn',
                'denied'
            )
        );
    END IF;
END
$$;


-- =========================================================
-- 9. SENDING LIMIT VALIDATION
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'sending_limits_values_valid'
    ) THEN
        ALTER TABLE sending_limits
        ADD CONSTRAINT sending_limits_values_valid
        CHECK (
            COALESCE(emails_per_minute, 0) >= 0
            AND COALESCE(emails_per_hour, 0) >= 0
            AND COALESCE(emails_per_day, 0) >= 0
            AND COALESCE(max_concurrency, 0) >= 0
        );
    END IF;
END
$$;


-- =========================================================
-- 10. EMAIL NORMALIZATION INDEX
-- =========================================================

CREATE INDEX IF NOT EXISTS
    contacts_email_normalized_idx
ON contacts (email_normalized);

CREATE INDEX IF NOT EXISTS
    contact_email_status_eligibility_idx
ON contact_email_status (eligibility_status);

CREATE INDEX IF NOT EXISTS
    contact_suppressions_email_active_idx
ON contact_suppressions (
    email_normalized,
    active,
    expires_at
);


-- =========================================================
-- 11. ELIGIBILITY ENGINE
-- =========================================================

CREATE OR REPLACE FUNCTION evaluate_contact_eligibility(
    p_contact_id BIGINT
)
RETURNS TABLE (
    eligible BOOLEAN,
    reason TEXT
)
LANGUAGE SQL
AS $$
    SELECT
        CASE
            WHEN c.email_normalized IS NULL
                OR c.email_normalized = ''
                THEN FALSE

            WHEN ces.consent_status NOT IN (
                'granted',
                'legitimate_interest'
            )
                THEN FALSE

            WHEN ces.unsubscribe_status = 'unsubscribed'
                THEN FALSE

            WHEN ces.bounce_status IN (
                'hard',
                'permanent'
            )
                THEN FALSE

            WHEN ces.complaint_status IN (
                'complained',
                'spam'
            )
                THEN FALSE

            WHEN ces.suppression_status IN (
                'suppressed',
                'blocked'
            )
                THEN FALSE

            WHEN EXISTS (
                SELECT 1
                FROM contact_suppressions cs
                WHERE cs.email_normalized = c.email_normalized
                  AND cs.active = TRUE
                  AND (
                      cs.expires_at IS NULL
                      OR cs.expires_at > NOW()
                  )
            )
                THEN FALSE

            ELSE TRUE
        END AS eligible,

        CASE
            WHEN c.email_normalized IS NULL
                OR c.email_normalized = ''
                THEN 'missing_email'

            WHEN ces.consent_status NOT IN (
                'granted',
                'legitimate_interest'
            )
                THEN 'no_valid_consent'

            WHEN ces.unsubscribe_status = 'unsubscribed'
                THEN 'unsubscribed'

            WHEN ces.bounce_status IN (
                'hard',
                'permanent'
            )
                THEN 'hard_bounce'

            WHEN ces.complaint_status IN (
                'complained',
                'spam'
            )
                THEN 'complaint'

            WHEN ces.suppression_status IN (
                'suppressed',
                'blocked'
            )
                THEN 'suppressed'

            WHEN EXISTS (
                SELECT 1
                FROM contact_suppressions cs
                WHERE cs.email_normalized = c.email_normalized
                  AND cs.active = TRUE
                  AND (
                      cs.expires_at IS NULL
                      OR cs.expires_at > NOW()
                  )
            )
                THEN 'suppression_table'

            ELSE 'eligible'
        END AS reason

    FROM contacts c
    JOIN contact_email_status ces
        ON ces.contact_id = c.id

    WHERE c.id = p_contact_id;
$$;


-- =========================================================
-- 12. REFRESH CONTACT ELIGIBILITY
-- =========================================================

CREATE OR REPLACE FUNCTION refresh_contact_eligibility(
    p_contact_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_eligible BOOLEAN;
    v_reason TEXT;
BEGIN

    SELECT eligible, reason
    INTO v_eligible, v_reason
    FROM evaluate_contact_eligibility(p_contact_id);

    UPDATE contact_email_status
    SET
        eligibility_status =
            CASE
                WHEN v_eligible THEN 'eligible'
                ELSE 'blocked'
            END,
        eligibility_reason = v_reason,
        last_evaluated_at = NOW(),
        updated_at = NOW()
    WHERE contact_id = p_contact_id;

END;
$$;


-- =========================================================
-- 13. REFRESH ALL CONTACT ELIGIBILITY
-- =========================================================

CREATE OR REPLACE FUNCTION refresh_all_contact_eligibility()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN

    UPDATE contact_email_status ces
    SET
        eligibility_status =
            CASE
                WHEN result.eligible THEN 'eligible'
                ELSE 'blocked'
            END,
        eligibility_reason = result.reason,
        last_evaluated_at = NOW(),
        updated_at = NOW()
    FROM (
        SELECT
            c.id AS contact_id,
            e.eligible,
            e.reason
        FROM contacts c
        CROSS JOIN LATERAL
            evaluate_contact_eligibility(c.id) e
    ) result
    WHERE ces.contact_id = result.contact_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;


-- =========================================================
-- 14. CREATE CAMPAIGN RECIPIENTS SAFELY
-- =========================================================

CREATE OR REPLACE FUNCTION populate_campaign_recipients(
    p_campaign_id BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN

    INSERT INTO campaign_recipients (
        campaign_id,
        contact_id,
        email_normalized,
        status,
        eligibility_reason
    )
    SELECT
        p_campaign_id,
        c.id,
        c.email_normalized,
        CASE
            WHEN e.eligible THEN 'eligible'
            ELSE 'blocked'
        END,
        e.reason
    FROM contacts c
    CROSS JOIN LATERAL
        evaluate_contact_eligibility(c.id) e
    ON CONFLICT (campaign_id, contact_id)
    DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;


-- =========================================================
-- 15. QUEUE ELIGIBLE RECIPIENTS
-- =========================================================

CREATE OR REPLACE FUNCTION queue_campaign_recipients(
    p_campaign_id BIGINT,
    p_limit INTEGER DEFAULT 1000
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN

    UPDATE campaign_recipients cr
    SET
        status = 'queued',
        queued_at = NOW(),
        updated_at = NOW()
    WHERE cr.id IN (
        SELECT id
        FROM campaign_recipients
        WHERE campaign_id = p_campaign_id
          AND status = 'eligible'
        ORDER BY id
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;


-- =========================================================
-- 16. CLAIM SEND QUEUE
-- =========================================================

CREATE OR REPLACE FUNCTION claim_send_queue(
    p_campaign_id BIGINT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    recipient_id BIGINT,
    contact_id BIGINT,
    email_normalized TEXT
)
LANGUAGE SQL
AS $$
    WITH claimed AS (
        SELECT cr.id
        FROM campaign_recipients cr
        WHERE cr.campaign_id = p_campaign_id
          AND cr.status = 'queued'
        ORDER BY cr.id
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE campaign_recipients cr
    SET
        status = 'sending',
        sending_at = NOW(),
        attempt_count = cr.attempt_count + 1,
        updated_at = NOW()
    FROM claimed
    WHERE cr.id = claimed.id
    RETURNING
        cr.id,
        cr.contact_id,
        cr.email_normalized;
$$;


-- =========================================================
-- 17. CREATE SEND ATTEMPT
-- =========================================================

CREATE OR REPLACE FUNCTION create_send_attempt(
    p_campaign_recipient_id BIGINT,
    p_provider TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_attempt_number INTEGER;
    v_id BIGINT;
BEGIN

    SELECT COALESCE(MAX(attempt_number), 0) + 1
    INTO v_attempt_number
    FROM send_attempts
    WHERE campaign_recipient_id = p_campaign_recipient_id;

    INSERT INTO send_attempts (
        campaign_recipient_id,
        attempt_number,
        status,
        provider,
        started_at
    )
    VALUES (
        p_campaign_recipient_id,
        v_attempt_number,
        'sending',
        p_provider,
        NOW()
    )
    RETURNING id INTO v_id;

    RETURN v_id;

END;
$$;


-- =========================================================
-- 18. RECORD SEND SUCCESS
-- =========================================================

CREATE OR REPLACE FUNCTION mark_send_success(
    p_attempt_id BIGINT,
    p_provider_message_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_recipient_id BIGINT;
BEGIN

    UPDATE send_attempts
    SET
        status = 'sent',
        provider_message_id = p_provider_message_id,
        completed_at = NOW()
    WHERE id = p_attempt_id
    RETURNING campaign_recipient_id
    INTO v_recipient_id;

    UPDATE campaign_recipients
    SET
        status = 'sent',
        sent_at = NOW(),
        provider_message_id = p_provider_message_id,
        updated_at = NOW()
    WHERE id = v_recipient_id;

END;
$$;


-- =========================================================
-- 19. RECORD SEND FAILURE
-- =========================================================

CREATE OR REPLACE FUNCTION mark_send_failure(
    p_attempt_id BIGINT,
    p_error_type TEXT,
    p_error_message TEXT,
    p_retry BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_recipient_id BIGINT;
    v_campaign_id BIGINT;
    v_attempt_number INTEGER;
    v_max_retries INTEGER;
BEGIN

    SELECT
        sa.campaign_recipient_id,
        sa.attempt_number,
        cr.campaign_id,
        c.max_retries
    INTO
        v_recipient_id,
        v_attempt_number,
        v_campaign_id,
        v_max_retries
    FROM send_attempts sa
    JOIN campaign_recipients cr
        ON cr.id = sa.campaign_recipient_id
    JOIN campaigns c
        ON c.id = cr.campaign_id
    WHERE sa.id = p_attempt_id;

    UPDATE send_attempts
    SET
        status =
            CASE
                WHEN p_retry
                 AND v_attempt_number <= v_max_retries
                THEN 'retrying'
                ELSE 'failed'
            END,
        error_type = p_error_type,
        error_message = p_error_message,
        next_retry_at =
            CASE
                WHEN p_retry
                 AND v_attempt_number <= v_max_retries
                THEN NOW()
                     + (
                         SELECT retry_backoff_seconds
                         FROM campaigns
                         WHERE id = v_campaign_id
                       ) * INTERVAL '1 second'
                ELSE NULL
            END,
        completed_at = NOW()
    WHERE id = p_attempt_id;

    UPDATE campaign_recipients
    SET
        status =
            CASE
                WHEN p_retry
                 AND v_attempt_number <= v_max_retries
                THEN 'queued'
                ELSE 'failed'
            END,
        failed_at =
            CASE
                WHEN p_retry
                 AND v_attempt_number <= v_max_retries
                THEN NULL
                ELSE NOW()
            END,
        last_error = p_error_message,
        updated_at = NOW()
    WHERE id = v_recipient_id;

END;
$$;


-- =========================================================
-- 20. OPERATIONAL VIEWS
-- =========================================================

CREATE OR REPLACE VIEW v_contact_eligibility AS
SELECT
    c.id AS contact_id,
    c.email,
    c.email_normalized,
    c.first_name,
    c.last_name,
    c.company,
    ces.email_validation_status,
    ces.consent_status,
    ces.unsubscribe_status,
    ces.bounce_status,
    ces.complaint_status,
    ces.suppression_status,
    ces.eligibility_status,
    ces.eligibility_reason,
    ces.last_evaluated_at
FROM contacts c
JOIN contact_email_status ces
    ON ces.contact_id = c.id;


CREATE OR REPLACE VIEW v_campaign_summary AS
SELECT
    c.id AS campaign_id,
    c.campaign_key,
    c.name,
    c.status,
    COUNT(cr.id) AS total_recipients,
    COUNT(*) FILTER (
        WHERE cr.status = 'eligible'
    ) AS eligible,
    COUNT(*) FILTER (
        WHERE cr.status = 'queued'
    ) AS queued,
    COUNT(*) FILTER (
        WHERE cr.status = 'sending'
    ) AS sending,
    COUNT(*) FILTER (
        WHERE cr.status = 'sent'
    ) AS sent,
    COUNT(*) FILTER (
        WHERE cr.status = 'delivered'
    ) AS delivered,
    COUNT(*) FILTER (
        WHERE cr.status = 'failed'
    ) AS failed,
    COUNT(*) FILTER (
        WHERE cr.status = 'blocked'
    ) AS blocked,
    COUNT(*) FILTER (
        WHERE cr.status = 'cancelled'
    ) AS cancelled
FROM campaigns c
LEFT JOIN campaign_recipients cr
    ON cr.campaign_id = c.id
GROUP BY
    c.id,
    c.campaign_key,
    c.name,
    c.status;


CREATE OR REPLACE VIEW v_send_queue AS
SELECT
    cr.id AS recipient_id,
    cr.campaign_id,
    cr.contact_id,
    cr.email_normalized,
    cr.status,
    cr.attempt_count,
    cr.queued_at,
    c.status AS campaign_status,
    c.batch_size,
    c.emails_per_minute,
    c.emails_per_hour,
    c.emails_per_day,
    c.max_concurrency,
    c.max_retries
FROM campaign_recipients cr
JOIN campaigns c
    ON c.id = cr.campaign_id
WHERE cr.status = 'queued'
  AND c.status = 'running';


CREATE OR REPLACE VIEW v_provider_event_queue AS
SELECT
    pe.id,
    pe.provider_name,
    pe.provider_event_id,
    pe.event_type,
    pe.provider_message_id,
    pe.email_normalized,
    pe.received_at,
    pe.event_at,
    pe.payload
FROM provider_events pe
WHERE pe.processed = FALSE
ORDER BY pe.received_at;


-- =========================================================
-- 21. INTEGRITY CHECK VIEW
-- =========================================================

CREATE OR REPLACE VIEW v_database_integrity AS

SELECT
    'contacts' AS object_name,
    COUNT(*)::BIGINT AS row_count
FROM contacts

UNION ALL

SELECT
    'campaigns',
    COUNT(*)::BIGINT
FROM campaigns

UNION ALL

SELECT
    'campaign_recipients',
    COUNT(*)::BIGINT
FROM campaign_recipients

UNION ALL

SELECT
    'send_attempts',
    COUNT(*)::BIGINT
FROM send_attempts

UNION ALL

SELECT
    'delivery_events',
    COUNT(*)::BIGINT
FROM delivery_events

UNION ALL

SELECT
    'consent_records',
    COUNT(*)::BIGINT
FROM consent_records

UNION ALL

SELECT
    'contact_suppressions',
    COUNT(*)::BIGINT
FROM contact_suppressions

UNION ALL

SELECT
    'provider_events',
    COUNT(*)::BIGINT
FROM provider_events;


-- =========================================================
-- 22. INITIAL ELIGIBILITY EVALUATION
-- =========================================================

SELECT refresh_all_contact_eligibility();


COMMIT;