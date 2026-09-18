-- ============================================================================
-- 111: accept_closing_checklist RPC (Phase 3)
--
-- Records that a closer after the first has reviewed and confirmed a
-- department's closing checklist for today. Mirrors complete_duty_item
-- (066_duties.sql) — same staff_sessions token validation, same
-- SECURITY DEFINER + ON CONFLICT DO NOTHING shape.
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_closing_checklist(
  p_token         uuid,
  p_venue_slug    text,
  p_department_id uuid,
  p_session_date  date
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
  SELECT ss.staff_id, v.id
    INTO v_staff_id, v_venue_id
  FROM staff_sessions ss
  JOIN staff   s ON s.id  = ss.staff_id
  JOIN venues  v ON v.id  = ss.venue_id AND v.slug = p_venue_slug
  WHERE ss.token      = p_token
    AND ss.expires_at > now()
    AND s.is_active   = true;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO closing_acceptances (venue_id, session_date, department_id, staff_id)
  VALUES (v_venue_id, p_session_date, p_department_id, v_staff_id)
  ON CONFLICT (session_date, department_id, staff_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_closing_checklist(uuid, text, uuid, date) TO anon, authenticated;
