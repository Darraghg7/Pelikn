-- ============================================================================
-- 129: staff_notification_preferences — create it for real (063 never ran live)
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR, BEFORE deploying the repo's       ║
-- ║  send-push edge function (it reads this table and returns 500 on any      ║
-- ║  typed push while the table is missing). Prereq: 091 (has_venue_access).  ║
-- ║  ROLLBACK: 129_rollback.sql.                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Probed 26 Sep 2026 with the anon key: the table answers PGRST205 (does not
-- exist) and both RPCs answer PGRST202 (not found). So Settings →
-- Notifications could never load or save preferences — every toggle showed
-- "on" and reverted with an error when changed.
--
-- This is 063 with one change: 063's read policy was USING (true), which 091
-- would have scoped had the table existed then. Reads here are venue-scoped.
-- The client only touches the table through the two SECURITY DEFINER RPCs
-- below, and send-push uses the service role, so neither needs the policy;
-- it only stops the anon key reading other venues' rows. No write policies:
-- writes go through save_staff_notification_preference only.
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_notification_preferences (
  staff_id          uuid        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  venue_id          uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  notification_type text        NOT NULL,
  enabled           boolean     NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, venue_id, notification_type)
);

ALTER TABLE staff_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS staff_notification_preferences_lookup_idx
  ON staff_notification_preferences (venue_id, notification_type, enabled);

DROP POLICY IF EXISTS "staff_notification_preferences_read" ON staff_notification_preferences;
DROP POLICY IF EXISTS "staff_notification_preferences_select" ON staff_notification_preferences;
CREATE POLICY "staff_notification_preferences_select"
  ON staff_notification_preferences FOR SELECT
  USING (has_venue_access(venue_id));

CREATE OR REPLACE FUNCTION get_staff_notification_preferences(
  p_session_token uuid
)
RETURNS TABLE(notification_type text, enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.notification_type, p.enabled
  FROM staff_notification_preferences p
  JOIN staff_sessions ss
    ON ss.staff_id = p.staff_id
   AND ss.venue_id = p.venue_id
  WHERE ss.token      = p_session_token
    AND ss.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION save_staff_notification_preference(
  p_session_token     uuid,
  p_notification_type text,
  p_enabled           boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_venue_id uuid;
BEGIN
  SELECT ss.staff_id, ss.venue_id
    INTO v_staff_id, v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token      = p_session_token
    AND ss.expires_at > now()
    AND s.is_active   = true;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO staff_notification_preferences (
    staff_id, venue_id, notification_type, enabled, updated_at
  )
  VALUES (v_staff_id, v_venue_id, p_notification_type, p_enabled, now())
  ON CONFLICT (staff_id, venue_id, notification_type)
  DO UPDATE SET
    enabled    = EXCLUDED.enabled,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_staff_notification_preferences(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_staff_notification_preference(uuid, text, boolean) TO anon, authenticated;

-- PostgREST caches the schema; make the new functions callable immediately.
NOTIFY pgrst, 'reload schema';
