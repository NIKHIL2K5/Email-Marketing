BEGIN;

-- ============================================================
-- 004 SENDING CONTROL HARDENING
-- ============================================================

-- ------------------------------------------------------------
-- 1. Validate sending limit scopes
-- ------------------------------------------------------------

ALTER TABLE sending_limits
  DROP CONSTRAINT IF EXISTS sending_limits_scope_type_valid;

ALTER TABLE sending_limits
  ADD CONSTRAINT sending_limits_scope_type_valid
  CHECK (
    scope_type IN ('global', 'provider', 'campaign')
  );


-- ------------------------------------------------------------
-- 2. Validate rate-usage windows
-- ------------------------------------------------------------

ALTER TABLE sending_rate_usage
  DROP CONSTRAINT IF EXISTS sending_rate_usage_window_type_valid;

ALTER TABLE sending_rate_usage
  ADD CONSTRAINT sending_rate_usage_window_type_valid
  CHECK (
    window_type IN ('minute', 'hour', 'day')
  );


-- ------------------------------------------------------------
-- 3. Prevent impossible zero-limit configurations
--    NULL means "not configured".
-- ------------------------------------------------------------

ALTER TABLE sending_limits
  DROP CONSTRAINT IF EXISTS sending_limits_at_least_one_limit;

ALTER TABLE sending_limits
  ADD CONSTRAINT sending_limits_at_least_one_limit
  CHECK (
    emails_per_minute IS NOT NULL
    OR emails_per_hour IS NOT NULL
    OR emails_per_day IS NOT NULL
    OR max_concurrency IS NOT NULL
  );


-- ------------------------------------------------------------
-- 4. Create a function to calculate current window starts
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION sending_window_start(
  p_window_type TEXT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_window_type
    WHEN 'minute' THEN
      RETURN date_trunc('minute', p_at);

    WHEN 'hour' THEN
      RETURN date_trunc('hour', p_at);

    WHEN 'day' THEN
      RETURN date_trunc('day', p_at);

    ELSE
      RAISE EXCEPTION 'Unsupported sending window type: %', p_window_type;
  END CASE;
END;
$$;


-- ------------------------------------------------------------
-- 5. Read current usage for a scope/window
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_sending_rate_usage(
  p_scope_type TEXT,
  p_scope_key TEXT,
  p_window_type TEXT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_sent_count INTEGER;
BEGIN
  v_window_start := sending_window_start(p_window_type, p_at);

  SELECT sent_count
  INTO v_sent_count
  FROM sending_rate_usage
  WHERE scope_type = p_scope_type
    AND scope_key = p_scope_key
    AND window_type = p_window_type
    AND window_start = v_window_start;

  RETURN COALESCE(v_sent_count, 0);
END;
$$;


-- ------------------------------------------------------------
-- 6. Record successful sending usage atomically
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_sending_usage(
  p_scope_type TEXT,
  p_scope_key TEXT,
  p_sent_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_type TEXT;
  v_window_start TIMESTAMPTZ;
BEGIN
  FOREACH v_window_type IN ARRAY ARRAY['minute', 'hour', 'day']
  LOOP
    v_window_start := sending_window_start(v_window_type, p_sent_at);

    INSERT INTO sending_rate_usage (
      scope_type,
      scope_key,
      window_type,
      window_start,
      sent_count,
      updated_at
    )
    VALUES (
      p_scope_type,
      p_scope_key,
      v_window_type,
      v_window_start,
      1,
      NOW()
    )
    ON CONFLICT (
      scope_type,
      scope_key,
      window_type,
      window_start
    )
    DO UPDATE
      SET sent_count = sending_rate_usage.sent_count + 1,
          updated_at = NOW();
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 7. Check whether a scope has exceeded its rate limits
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_sending_rate_limit(
  p_scope_type TEXT,
  p_scope_key TEXT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  minute_used INTEGER,
  minute_limit INTEGER,
  hour_used INTEGER,
  hour_limit INTEGER,
  day_used INTEGER,
  day_limit INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_limit sending_limits%ROWTYPE;
  v_minute_used INTEGER;
  v_hour_used INTEGER;
  v_day_used INTEGER;
BEGIN
  SELECT *
  INTO v_limit
  FROM sending_limits
  WHERE scope_type = p_scope_type
    AND scope_key = p_scope_key
    AND enabled = TRUE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      TRUE,
      'no_active_limit'::TEXT,
      0,
      NULL::INTEGER,
      0,
      NULL::INTEGER,
      0,
      NULL::INTEGER;
    RETURN;
  END IF;

  v_minute_used := get_sending_rate_usage(
    p_scope_type,
    p_scope_key,
    'minute',
    p_at
  );

  v_hour_used := get_sending_rate_usage(
    p_scope_type,
    p_scope_key,
    'hour',
    p_at
  );

  v_day_used := get_sending_rate_usage(
    p_scope_type,
    p_scope_key,
    'day',
    p_at
  );

  IF v_limit.emails_per_minute IS NOT NULL
     AND v_minute_used >= v_limit.emails_per_minute THEN

    RETURN QUERY
    SELECT
      FALSE,
      'minute_limit_reached'::TEXT,
      v_minute_used,
      v_limit.emails_per_minute,
      v_hour_used,
      v_limit.emails_per_hour,
      v_day_used,
      v_limit.emails_per_day;

    RETURN;
  END IF;

  IF v_limit.emails_per_hour IS NOT NULL
     AND v_hour_used >= v_limit.emails_per_hour THEN

    RETURN QUERY
    SELECT
      FALSE,
      'hour_limit_reached'::TEXT,
      v_minute_used,
      v_limit.emails_per_minute,
      v_hour_used,
      v_limit.emails_per_hour,
      v_day_used,
      v_limit.emails_per_day;

    RETURN;
  END IF;

  IF v_limit.emails_per_day IS NOT NULL
     AND v_day_used >= v_limit.emails_per_day THEN

    RETURN QUERY
    SELECT
      FALSE,
      'day_limit_reached'::TEXT,
      v_minute_used,
      v_limit.emails_per_minute,
      v_hour_used,
      v_limit.emails_per_hour,
      v_day_used,
      v_limit.emails_per_day;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    TRUE,
    'allowed'::TEXT,
    v_minute_used,
    v_limit.emails_per_minute,
    v_hour_used,
    v_limit.emails_per_hour,
    v_day_used,
    v_limit.emails_per_day;
END;
$$;


-- ------------------------------------------------------------
-- 8. Check campaign status before sending
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION campaign_send_allowed(
  p_campaign_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status
  INTO v_status
  FROM campaigns
  WHERE id = p_campaign_id;

  RETURN COALESCE(v_status IN ('scheduled', 'running'), FALSE);
END;
$$;


-- ------------------------------------------------------------
-- 9. Global send-permission check
--
-- Checks:
--   campaign state
--   global rate limits
--   campaign rate limits
--
-- Provider limits can be added when a real provider is
-- configured.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_send_permission(
  p_campaign_id BIGINT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_campaign_key TEXT;
  v_global_result RECORD;
  v_campaign_result RECORD;
BEGIN
  SELECT campaign_key
  INTO v_campaign_key
  FROM campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT FALSE, 'campaign_not_found'::TEXT;
    RETURN;
  END IF;

  IF NOT campaign_send_allowed(p_campaign_id) THEN
    RETURN QUERY
    SELECT FALSE, 'campaign_not_sendable'::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_global_result
  FROM check_sending_rate_limit(
    'global',
    'global',
    p_at
  );

  IF NOT v_global_result.allowed THEN
    RETURN QUERY
    SELECT FALSE, 'global_' || v_global_result.reason;
    RETURN;
  END IF;

  SELECT *
  INTO v_campaign_result
  FROM check_sending_rate_limit(
    'campaign',
    v_campaign_key,
    p_at
  );

  IF NOT v_campaign_result.allowed THEN
    RETURN QUERY
    SELECT FALSE, 'campaign_' || v_campaign_result.reason;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT TRUE, 'allowed'::TEXT;
END;
$$;


-- ------------------------------------------------------------
-- 10. Atomically reserve a send slot
--
-- This prevents concurrent workers from exceeding the
-- configured limits at the same time.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION reserve_send_slot(
  p_campaign_id BIGINT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_key TEXT;
  v_permission RECORD;
BEGIN
  SELECT campaign_key
  INTO v_campaign_key
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT FALSE, 'campaign_not_found'::TEXT;
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
    SELECT FALSE, v_permission.reason;
    RETURN;
  END IF;

  /*
    Reserve one unit of rate usage for global and campaign
    scopes. The actual provider send must only happen after
    this function returns allowed = true.
  */

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

  RETURN QUERY
  SELECT TRUE, 'reserved'::TEXT;
END;
$$;


-- ------------------------------------------------------------
-- 11. Create useful indexes for sending-control lookups
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS sending_limits_scope_enabled_idx
ON sending_limits(scope_type, scope_key, enabled);

CREATE INDEX IF NOT EXISTS sending_rate_usage_window_idx
ON sending_rate_usage(window_type, window_start);


-- ------------------------------------------------------------
-- 12. Seed the global safety limit
--
-- Conservative TEST environment values.
-- These do not send anything by themselves.
-- ------------------------------------------------------------

INSERT INTO sending_limits (
  scope_type,
  scope_key,
  emails_per_minute,
  emails_per_hour,
  emails_per_day,
  max_concurrency,
  enabled
)
VALUES (
  'global',
  'global',
  10,
  100,
  500,
  1,
  TRUE
)
ON CONFLICT (scope_type, scope_key)
DO UPDATE SET
  emails_per_minute = EXCLUDED.emails_per_minute,
  emails_per_hour = EXCLUDED.emails_per_hour,
  emails_per_day = EXCLUDED.emails_per_day,
  max_concurrency = EXCLUDED.max_concurrency,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();


COMMIT;
