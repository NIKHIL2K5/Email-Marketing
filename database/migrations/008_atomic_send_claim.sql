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
BEGIN
  SELECT campaign_key
  INTO v_campaign_key
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      FALSE,
      'campaign_not_found'::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      NULL::INTEGER;
    RETURN;
  END IF;

  SELECT *
  INTO v_permission
  FROM check_send_permission(
    p_campaign_id,
    p_at
  );

  IF NOT v_permission.allowed THEN
    RETURN QUERY
    SELECT
      FALSE,
      v_permission.reason,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      NULL::INTEGER;
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
    SELECT
      FALSE,
      'no_queued_recipient'::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      NULL::INTEGER;
    RETURN;
  END IF;

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

COMMIT;
