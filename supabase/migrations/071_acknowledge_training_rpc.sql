-- Migration 071: RPC for staff to acknowledge training sign-offs
-- Uses SECURITY DEFINER so it runs as the function owner and bypasses RLS,
-- consistent with how other staff actions work (complete_task, etc.)

CREATE OR REPLACE FUNCTION acknowledge_training_sign_off(
  p_token       uuid,
  p_sign_off_id uuid,
  p_signature   text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id uuid;
  v_venue_id uuid;
BEGIN
  SELECT ss.staff_id, ss.venue_id
  INTO v_staff_id, v_venue_id
  FROM staff_sessions ss
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM training_sign_offs
    WHERE id = p_sign_off_id
      AND staff_id = v_staff_id
      AND venue_id = v_venue_id
  ) THEN
    RAISE EXCEPTION 'Training record not found';
  END IF;

  UPDATE training_sign_offs SET
    staff_acknowledged    = true,
    staff_acknowledged_at = now(),
    staff_signature       = p_signature
  WHERE id = p_sign_off_id;
END;
$$;
