-- ============================================================================
-- 063: Per-staff push notification preferences
--
-- Preferences default to enabled. A row exists only when a staff member has
-- explicitly changed a notification type.
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
CREATE POLICY "staff_notification_preferences_read"
  ON staff_notification_preferences FOR SELECT
  USING (true);

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
    staff_id,
    venue_id,
    notification_type,
    enabled,
    updated_at
  )
  VALUES (
    v_staff_id,
    v_venue_id,
    p_notification_type,
    p_enabled,
    now()
  )
  ON CONFLICT (staff_id, venue_id, notification_type)
  DO UPDATE SET
    enabled    = EXCLUDED.enabled,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_staff_notification_preferences(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_staff_notification_preference(uuid, text, boolean) TO anon, authenticated;
