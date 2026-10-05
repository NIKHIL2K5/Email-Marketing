BEGIN;

CREATE TABLE IF NOT EXISTS listmonk_subscriber_map (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL UNIQUE
    REFERENCES contacts(id) ON DELETE CASCADE,
  listmonk_subscriber_id BIGINT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      sync_status IN (
        'active',
        'blocked',
        'unsubscribed',
        'error'
      )
    ),
  last_synced_at TIMESTAMPTZ,
  last_sync_hash TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listmonk_subscriber_map_status
  ON listmonk_subscriber_map(sync_status);

CREATE INDEX IF NOT EXISTS idx_listmonk_subscriber_map_email
  ON listmonk_subscriber_map(email_normalized);

CREATE OR REPLACE FUNCTION set_listmonk_subscriber_map_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listmonk_subscriber_map_updated_at
ON listmonk_subscriber_map;

CREATE TRIGGER trg_listmonk_subscriber_map_updated_at
BEFORE UPDATE ON listmonk_subscriber_map
FOR EACH ROW
EXECUTE FUNCTION set_listmonk_subscriber_map_updated_at();

COMMIT;