-- ─────────────────────────────────────────────────────────────────────────────
-- Track manual hour edits by staff so managers receive a notification.
-- When a staff member corrects their own clock-in/out, the client calls
-- log_hour_edit() which records the event here.  useNotifications then
-- surfaces it in the manager bell.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hour_edit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL,
  staff_id    uuid        NOT NULL,
  staff_name  text,
  shift_date  date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for the manager notification query (last 7 days per venue)
CREATE INDEX IF NOT EXISTS hour_edit_log_venue_created
  ON hour_edit_log (venue_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER function so PIN-authenticated staff can insert the log row
-- even though they have no direct INSERT permission on the table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_hour_edit(p_clock_in_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venue_id   uuid;
  v_staff_id   uuid;
  v_staff_name text;
  v_shift_date date;
BEGIN
  SELECT ce.venue_id,
         ce.staff_id,
         s.name,
         ce.occurred_at::date
  INTO   v_venue_id, v_staff_id, v_staff_name, v_shift_date
  FROM   clock_events ce
  LEFT   JOIN staff s ON s.id = ce.staff_id
  WHERE  ce.id = p_clock_in_id;

  -- Bail out silently if the event isn't found
  IF v_venue_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO hour_edit_log (venue_id, staff_id, staff_name, shift_date)
  VALUES (v_venue_id, v_staff_id, v_staff_name, v_shift_date);
END;
$$;
