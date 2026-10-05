BEGIN;

CREATE OR REPLACE FUNCTION claim_one_send_slot(
  p_campaign_id BIGINT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  recipient_id BIGINT,
  contact_id BIGINT,
  email_normalized TEXT,
  attempt_number INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_key TEXT;
  v_permission RECORD;
  v_recipient RECORD;
  v_eligibility TEXT;
BEGIN
  SELECT campaign_key
  INTO v_campaign_key
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT FALSE, 'campaign_not_found'::TEXT,
           NULL::BIGINT, NULL::BIGINT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT *
  INTO v_permission
  FROM check_send_permission(p_campaign_id, p_at);

  IF NOT v_permission.allowed THEN
    RETURN QUERY
    SELECT FALSE, v_permission.reason,
           NULL::BIGINT, NULL::BIGINT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT
    cr.id,
    cr.contact_id,
    cr.email_normalized,
    cr.attempt_count + 1 AS next_attempt_number
  INTO v_recipient
  FROM campaign_recipients cr
  WHERE cr.campaign_id = p_campaign_id
    AND cr.status = 'queued'
  ORDER BY cr.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT FALSE, 'no_queued_recipient'::TEXT,
           NULL::BIGINT, NULL::BIGINT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT eligibility_status
  INTO v_eligibility
  FROM contact_email_status
  WHERE contact_id = v_recipient.contact_id;

  IF COALESCE(v_eligibility, 'blocked') <> 'eligible' THEN
    UPDATE campaign_recipients
    SET
      status = 'blocked',
      eligibility_reason = 'not_eligible_at_send_time',
      updated_at = p_at
    WHERE id = v_recipient.id;

    RETURN QUERY
    SELECT FALSE,
           'recipient_not_eligible'::TEXT,
           v_recipient.id,
           v_recipient.contact_id,
           v_recipient.email_normalized,
           v_recipient.next_attempt_number;
    RETURN;
  END IF;

  PERFORM record_sending_usage(
    'global',
    'global',
    p_at
  );

  PERFORM record_sending_usage(
    'campaign',
    v_campaign_key,
    p_at
  );

  UPDATE campaign_recipients
  SET
    status = 'sending',
    sending_at = p_at,
    attempt_count = attempt_count + 1,
    updated_at = p_at
  WHERE id = v_recipient.id;

  RETURN QUERY
  SELECT
    TRUE,
    'claimed'::TEXT,
    v_recipient.id,
    v_recipient.contact_id,
    v_recipient.email_normalized,
    v_recipient.next_attempt_number;
END;
$$;

CREATE OR REPLACE FUNCTION recover_stale_sending_recipients(
  p_stale_after INTERVAL DEFAULT INTERVAL '30 minutes',
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  recovered_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  WITH stale AS (
    SELECT
      cr.id,
      cr.attempt_count,
      c.max_retries
    FROM campaign_recipients cr
    JOIN campaigns c
      ON c.id = cr.campaign_id
    WHERE cr.status = 'sending'
      AND cr.sending_at IS NOT NULL
      AND cr.sending_at < p_now - p_stale_after
    FOR UPDATE OF cr SKIP LOCKED
  ),
  updated AS (
    UPDATE campaign_recipients cr
    SET
      status = CASE
        WHEN stale.attempt_count < stale.max_retries
          THEN 'queued'
        ELSE 'failed'
      END,
      failed_at = CASE
        WHEN stale.attempt_count < stale.max_retries
          THEN NULL
        ELSE p_now
      END,
      last_error = CASE
        WHEN stale.attempt_count < stale.max_retries
          THEN 'Recovered stale sending recipient for retry'
        ELSE 'Stale sending recipient exceeded retry limit'
      END,
      updated_at = p_now
    FROM stale
    WHERE cr.id = stale.id
    RETURNING cr.id
  )
  SELECT COUNT(*)
  INTO v_count
  FROM updated;

  RETURN QUERY
  SELECT v_count;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_campaign_if_complete(
  p_campaign_id BIGINT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining BIGINT;
  v_status TEXT;
BEGIN
  SELECT status
  INTO v_status
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND OR v_status NOT IN ('scheduled', 'running') THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*)
  INTO v_remaining
  FROM campaign_recipients
  WHERE campaign_id = p_campaign_id
    AND status IN ('queued', 'sending');

  IF v_remaining = 0 THEN
    UPDATE campaigns
    SET
      status = 'completed',
      updated_at = p_at
    WHERE id = p_campaign_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE INDEX IF NOT EXISTS campaign_recipients_send_queue_idx
ON campaign_recipients (campaign_id, status, id);

CREATE INDEX IF NOT EXISTS campaign_recipients_stale_sending_idx
ON campaign_recipients (status, sending_at)
WHERE status = 'sending';

COMMIT;
