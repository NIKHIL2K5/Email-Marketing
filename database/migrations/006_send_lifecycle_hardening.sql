BEGIN;

-- ============================================================
-- 006 SEND LIFECYCLE HARDENING
-- ============================================================

-- ------------------------------------------------------------
-- 1. Reset the synthetic test recipient from our interrupted
--    claim test.
-- ------------------------------------------------------------

UPDATE campaign_recipients
SET
    status = 'queued',
    attempt_count = 0,
    sending_at = NULL,
    sent_at = NULL,
    failed_at = NULL,
    cancelled_at = NULL,
    last_error = NULL,
    provider_message_id = NULL,
    updated_at = NOW()
WHERE id = 296022
  AND campaign_id = 1
  AND contact_id = 49333;


-- ------------------------------------------------------------
-- 2. Remove any rate-usage rows created by the previous
--    reservation test.
--
--    The previous implementation counted a claim as usage.
--    We are correcting that model.
-- ------------------------------------------------------------

DELETE FROM sending_rate_usage
WHERE
    (scope_type = 'global' AND scope_key = 'global')
    OR
    (scope_type = 'campaign' AND scope_key = (
        SELECT campaign_key
        FROM campaigns
        WHERE id = 1
    ));


-- ------------------------------------------------------------
-- 3. Redefine claim_send_batch().
--
--    IMPORTANT:
--    Claiming a recipient does NOT consume rate usage.
--    Rate usage is recorded only after provider handoff.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_send_batch(
    p_campaign_id BIGINT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    recipient_id BIGINT,
    contact_id BIGINT,
    email_normalized TEXT,
    attempt_number INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_campaign_status TEXT;
    v_claim_limit INTEGER;
BEGIN

    IF p_limit IS NULL OR p_limit <= 0 THEN
        RAISE EXCEPTION 'p_limit must be greater than zero';
    END IF;

    /*
      Lock the campaign so concurrent workers cannot make
      conflicting campaign-state decisions.
    */
    SELECT status
    INTO v_campaign_status
    FROM campaigns
    WHERE id = p_campaign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign % does not exist', p_campaign_id;
    END IF;

    /*
      Only scheduled/running campaigns may claim recipients.
    */
    IF v_campaign_status NOT IN ('scheduled', 'running') THEN
        RETURN;
    END IF;

    v_claim_limit := LEAST(p_limit, 100);

    /*
      Claim only queued recipients.

      SKIP LOCKED allows multiple workers to operate safely
      without claiming the same recipient.
    */
    RETURN QUERY
    WITH candidates AS (
        SELECT cr.id
        FROM campaign_recipients cr
        WHERE cr.campaign_id = p_campaign_id
          AND cr.status = 'queued'
        ORDER BY cr.id
        FOR UPDATE SKIP LOCKED
        LIMIT v_claim_limit
    ),
    claimed AS (
        UPDATE campaign_recipients cr
        SET
            status = 'sending',
            sending_at = NOW(),
            attempt_count = cr.attempt_count + 1,
            updated_at = NOW()
        FROM candidates c
        WHERE cr.id = c.id
        RETURNING
            cr.id,
            cr.contact_id,
            cr.email_normalized,
            cr.attempt_count
    )
    SELECT
        claimed.id,
        claimed.contact_id,
        claimed.email_normalized,
        claimed.attempt_count
    FROM claimed
    ORDER BY claimed.id;

END;
$$;


-- ------------------------------------------------------------
-- 4. Harden create_send_attempt().
--
--    The recipient must already be in sending state.
-- ------------------------------------------------------------

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
    v_status TEXT;
BEGIN

    SELECT status
    INTO v_status
    FROM campaign_recipients
    WHERE id = p_campaign_recipient_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Campaign recipient % does not exist',
            p_campaign_recipient_id;
    END IF;

    IF v_status <> 'sending' THEN
        RAISE EXCEPTION
            'Campaign recipient % is not in sending state',
            p_campaign_recipient_id;
    END IF;

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
    RETURNING id
    INTO v_id;

    RETURN v_id;

END;
$$;


-- ------------------------------------------------------------
-- 5. Harden successful-send handling.
--
--    A successful provider handoff records actual usage.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_send_success(
    p_attempt_id BIGINT,
    p_provider_message_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_recipient_id BIGINT;
    v_campaign_id BIGINT;
    v_campaign_key TEXT;
    v_attempt_status TEXT;
    v_completed_at TIMESTAMPTZ;
BEGIN

    SELECT
        sa.campaign_recipient_id,
        sa.status,
        cr.campaign_id,
        c.campaign_key
    INTO
        v_recipient_id,
        v_attempt_status,
        v_campaign_id,
        v_campaign_key
    FROM send_attempts sa
    JOIN campaign_recipients cr
        ON cr.id = sa.campaign_recipient_id
    JOIN campaigns c
        ON c.id = cr.campaign_id
    WHERE sa.id = p_attempt_id
    FOR UPDATE OF sa, cr;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Send attempt % does not exist',
            p_attempt_id;
    END IF;

    IF v_attempt_status <> 'sending' THEN
        RAISE EXCEPTION
            'Send attempt % is not in sending state',
            p_attempt_id;
    END IF;

    v_completed_at := NOW();

    UPDATE send_attempts
    SET
        status = 'sent',
        provider_message_id = p_provider_message_id,
        completed_at = v_completed_at
    WHERE id = p_attempt_id;

    UPDATE campaign_recipients
    SET
        status = 'sent',
        sent_at = v_completed_at,
        provider_message_id = p_provider_message_id,
        updated_at = v_completed_at
    WHERE id = v_recipient_id;

    /*
      Record actual successful provider handoff.
    */
    PERFORM record_sending_usage(
        'global',
        'global',
        v_completed_at
    );

    PERFORM record_sending_usage(
        'campaign',
        v_campaign_key,
        v_completed_at
    );

END;
$$;


-- ------------------------------------------------------------
-- 6. Harden failure handling.
-- ------------------------------------------------------------

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
    v_retry BOOLEAN;
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
    WHERE sa.id = p_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Send attempt % does not exist',
            p_attempt_id;
    END IF;

    v_retry :=
        p_retry
        AND v_attempt_number <= v_max_retries;

    UPDATE send_attempts
    SET
        status = CASE
            WHEN v_retry THEN 'retrying'
            ELSE 'failed'
        END,
        error_type = p_error_type,
        error_message = p_error_message,
        next_retry_at = CASE
            WHEN v_retry THEN
                NOW()
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
        status = CASE
            WHEN v_retry THEN 'queued'
            ELSE 'failed'
        END,
        failed_at = CASE
            WHEN v_retry THEN NULL
            ELSE NOW()
        END,
        last_error = p_error_message,
        updated_at = NOW()
    WHERE id = v_recipient_id;

END;
$$;


-- ------------------------------------------------------------
-- 7. Remove obsolete test usage for TEST-001.
-- ------------------------------------------------------------

DELETE FROM sending_rate_usage
WHERE scope_type = 'campaign'
  AND scope_key = 'TEST-001';


COMMIT;
