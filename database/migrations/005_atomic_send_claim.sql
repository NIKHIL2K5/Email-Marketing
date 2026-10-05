BEGIN;

-- ============================================================
-- 005 ATOMIC SEND CLAIM
-- ============================================================

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
  v_campaign_key TEXT;
  v_permission RECORD;
  v_claim_limit INTEGER;
BEGIN

  IF p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be greater than zero';
  END IF;

  /*
    Obtain the campaign lock first.

    This prevents two workers from simultaneously making
    conflicting decisions about the same campaign.
  */
  SELECT campaign_key
  INTO v_campaign_key
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % does not exist', p_campaign_id;
  END IF;

  /*
    Determine how many recipients can be claimed.

    The database currently uses the global rate limit as the
    hard safety boundary. We intentionally keep this conservative.
  */
  SELECT *
  INTO v_permission
  FROM check_send_permission(p_campaign_id);

  IF NOT v_permission.allowed THEN
    RETURN;
  END IF;

  v_claim_limit := LEAST(p_limit, 100);

  /*
    Claim queued recipients atomically.

    SKIP LOCKED allows multiple workers to operate safely
    without waiting on recipients another worker has already
    claimed.
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
      sending_at = COALESCE(cr.sending_at, NOW()),
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
-- Documentation comment
-- ------------------------------------------------------------

COMMENT ON FUNCTION claim_send_batch(BIGINT, INTEGER)
IS 'Atomically claims queued campaign recipients for sending after campaign and sending-control checks. Returns recipients marked sending.';


COMMIT;
