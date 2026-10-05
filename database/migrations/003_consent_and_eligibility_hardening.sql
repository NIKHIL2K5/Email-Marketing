BEGIN;

-- ============================================================
-- 003: CONSENT + ELIGIBILITY HARDENING
-- ============================================================

-- ------------------------------------------------------------
-- 1. Synchronize the current consent state into
--    contact_email_status.
--
-- consent_records is the source of truth.
-- The latest consent record wins.
-- A withdrawn latest record is treated as withdrawn.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_contact_consent_status(
    p_contact_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
    v_consent_status TEXT;
BEGIN

    SELECT COALESCE(
        (
            SELECT
                CASE
                    WHEN cr.withdrawn_at IS NOT NULL
                        THEN 'withdrawn'
                    ELSE cr.consent_status
                END
            FROM consent_records cr
            WHERE cr.contact_id = p_contact_id
            ORDER BY cr.consent_recorded_at DESC, cr.id DESC
            LIMIT 1
        ),
        'unknown'
    )
    INTO v_consent_status;

    UPDATE contact_email_status
    SET
        consent_status = v_consent_status,
        updated_at = NOW()
    WHERE contact_id = p_contact_id;

END;
$function$;


-- ------------------------------------------------------------
-- 2. Refresh eligibility.
--
-- First synchronize consent.
-- Then run the existing eligibility evaluator.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_contact_eligibility(
    p_contact_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
    v_eligible BOOLEAN;
    v_reason TEXT;
BEGIN

    PERFORM sync_contact_consent_status(p_contact_id);

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
$function$;


-- ------------------------------------------------------------
-- 3. Bulk eligibility refresh.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_all_contact_eligibility()
RETURNS BIGINT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_count BIGINT;
BEGIN

    SELECT COUNT(*)
    INTO v_count
    FROM contacts;

    UPDATE contact_email_status ces
    SET
        consent_status = COALESCE(
            (
                SELECT
                    CASE
                        WHEN cr.withdrawn_at IS NOT NULL
                            THEN 'withdrawn'
                        ELSE cr.consent_status
                    END
                FROM consent_records cr
                WHERE cr.contact_id = ces.contact_id
                ORDER BY cr.consent_recorded_at DESC, cr.id DESC
                LIMIT 1
            ),
            'unknown'
        ),
        updated_at = NOW();

    UPDATE contact_email_status ces
    SET
        eligibility_status = result.eligibility_status,
        eligibility_reason = result.eligibility_reason,
        last_evaluated_at = NOW(),
        updated_at = NOW()
    FROM (
        SELECT
            c.id AS contact_id,
            CASE
                WHEN e.eligible THEN 'eligible'
                ELSE 'blocked'
            END AS eligibility_status,
            e.reason AS eligibility_reason
        FROM contacts c
        CROSS JOIN LATERAL evaluate_contact_eligibility(c.id) e
    ) result
    WHERE ces.contact_id = result.contact_id;

    RETURN v_count;

END;
$function$;


-- ------------------------------------------------------------
-- 4. Automatically refresh consent + eligibility whenever
--    a consent record is inserted or updated.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION consent_record_sync_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN

    PERFORM refresh_contact_eligibility(NEW.contact_id);

    RETURN NEW;

END;
$function$;


DROP TRIGGER IF EXISTS consent_record_sync
ON consent_records;

CREATE TRIGGER consent_record_sync
AFTER INSERT OR UPDATE
ON consent_records
FOR EACH ROW
EXECUTE FUNCTION consent_record_sync_trigger();


-- ------------------------------------------------------------
-- 5. Refresh all existing contacts.
-- ------------------------------------------------------------

SELECT refresh_all_contact_eligibility();


COMMIT;
