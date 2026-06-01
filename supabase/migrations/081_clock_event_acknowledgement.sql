-- 081: Staff alert acknowledgement + disciplinary log
-- Adds acknowledgement tracking to clock_events and a separate
-- disciplinary log table for 4th-strike escalations.

ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_reason    text;

CREATE TABLE IF NOT EXISTS staff_disciplinary_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id        uuid        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  clock_event_id  uuid        REFERENCES clock_events(id)    ON DELETE SET NULL,
  offence_type    text        NOT NULL CHECK (offence_type IN ('late_clock_in', 'break_overrun')),
  strike_number   int         NOT NULL,
  mins_over       int         NOT NULL,
  alert_reason    text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_log_staff   ON staff_disciplinary_log(staff_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_disciplinary_log_venue   ON staff_disciplinary_log(venue_id, occurred_at DESC);

-- RPC: acknowledge a clock-in or break alert
-- Called by staff after reading the modal. Writes acknowledged_at + reason,
-- and on 4th strike inserts a disciplinary log row.
CREATE OR REPLACE FUNCTION acknowledge_clock_alert(
  p_clock_event_id  uuid,
  p_alert_reason    text      DEFAULT NULL,
  p_strike_number   int       DEFAULT NULL,
  p_mins_over       int       DEFAULT NULL,
  p_offence_type    text      DEFAULT NULL,
  p_is_disciplinary boolean   DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id  uuid;
  v_venue_id  uuid;
BEGIN
  UPDATE clock_events
     SET acknowledged_at = now(),
         alert_reason    = p_alert_reason
   WHERE id = p_clock_event_id
  RETURNING staff_id, venue_id INTO v_staff_id, v_venue_id;

  IF p_is_disciplinary AND v_staff_id IS NOT NULL THEN
    INSERT INTO staff_disciplinary_log
      (venue_id, staff_id, clock_event_id, offence_type, strike_number, mins_over, alert_reason, occurred_at)
    VALUES
      (v_venue_id, v_staff_id, p_clock_event_id, p_offence_type, p_strike_number, p_mins_over, p_alert_reason, now());
  END IF;
END;
$$;
