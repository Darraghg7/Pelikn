-- Rollback for 135_complete_task_london_date.sql: restores the live
-- definition from before 135 (UTC date, no repeat-tick guard).
CREATE OR REPLACE FUNCTION public.complete_task(p_token uuid, p_template_id uuid DEFAULT NULL::uuid, p_one_off_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
  v_venue_id   uuid;
BEGIN
  SELECT ss.staff_id, s.name, ss.venue_id
  INTO v_staff_id, v_staff_name, v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO task_completions (
    task_template_id, task_one_off_id,
    completion_date, completed_by_staff_id, completed_by_name, venue_id
  ) VALUES (
    p_template_id, p_one_off_id,
    CURRENT_DATE, v_staff_id, v_staff_name, v_venue_id
  );
END;
$function$;
