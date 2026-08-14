-- 098: Track which manager acknowledged a late clock-in
-- clock_events.acknowledged_at/alert_reason (081) record the *staff member*
-- reading their own alert. This adds who, on the manager side, signed off on
-- it — either via the kiosk "hand to manager" PIN flow, or from the new
-- Team > Attendance today drill-down page.

ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES staff(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION acknowledge_clock_alert(
  p_clock_event_id  uuid,
  p_alert_reason    text      DEFAULT NULL,
  p_strike_number   int       DEFAULT NULL,
  p_mins_over       int       DEFAULT NULL,
  p_offence_type    text      DEFAULT NULL,
  p_is_disciplinary boolean   DEFAULT false,
  p_manager_id      uuid      DEFAULT NULL
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
  -- acknowledged_at is left untouched once set, so a later manager sign-off
  -- (acknowledged_by) can't clobber the staff member's original ack time.
  UPDATE clock_events
     SET acknowledged_at = COALESCE(acknowledged_at, now()),
         alert_reason    = COALESCE(p_alert_reason, alert_reason),
         acknowledged_by = COALESCE(p_manager_id, acknowledged_by)
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
