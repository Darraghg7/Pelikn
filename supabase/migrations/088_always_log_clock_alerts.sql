-- 088: Always log clock alerts to staff_disciplinary_log
-- Previously only 4th-strike events were logged. Now every late clock-in
-- and break overrun is recorded so all incidents appear in the HR section.

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

  IF v_staff_id IS NOT NULL THEN
    INSERT INTO staff_disciplinary_log
      (venue_id, staff_id, clock_event_id, offence_type, strike_number, mins_over, alert_reason, occurred_at)
    VALUES
      (v_venue_id, v_staff_id, p_clock_event_id, p_offence_type, p_strike_number, p_mins_over, p_alert_reason, now());
  END IF;
END;
$$;
