-- ============================================================================
-- 135: complete_task records the UK date, and ignores a repeat tick
--
-- Staff can tick Tasks again (the staff Tasks tab was restored alongside
-- this). complete_task stamped completion_date with CURRENT_DATE, which is
-- the UTC date: during BST a task ticked between midnight and 1am landed on
-- the previous day, so it showed as not done. Same fix as 133 used for the
-- fridge reminder.
--
-- A double tap (or a retried request on a bad connection) also inserted a
-- second row for the same task and day; now the second call does nothing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_task(p_token uuid, p_template_id uuid DEFAULT NULL::uuid, p_one_off_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
  v_venue_id   uuid;
  v_today      date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  SELECT ss.staff_id, s.name, ss.venue_id
  INTO v_staff_id, v_staff_name, v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  IF EXISTS (
    SELECT 1 FROM task_completions
     WHERE venue_id = v_venue_id
       AND completion_date = v_today
       AND task_template_id IS NOT DISTINCT FROM p_template_id
       AND task_one_off_id  IS NOT DISTINCT FROM p_one_off_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO task_completions (
    task_template_id, task_one_off_id,
    completion_date, completed_by_staff_id, completed_by_name, venue_id
  ) VALUES (
    p_template_id, p_one_off_id,
    v_today, v_staff_id, v_staff_name, v_venue_id
  );
END;
$function$;
