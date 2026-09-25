-- ============================================================================
-- 125: Single-call data fetch for the manager notification bell
--
-- useNotifications (the bell in the top bar) used to fire ~20 PostgREST
-- requests every time a manager opened the app, some of them chained two or
-- three deep. Measured on 25 Sep 2026: the dashboard's cold-open burst of
-- ~50-60 simultaneous requests saturated the database for ~9 s — a trivial
-- query from an unrelated client went from 0.1 s to 4.6 s while one app
-- loaded. The bell was the largest single contributor.
--
-- This returns the same rows those requests fetched, in one round trip. It
-- deliberately returns *data*, not finished notifications: the rules (late
-- clock-ins, fridge ranges, cleaning frequencies, closed days) stay in
-- useNotifications.ts, unchanged and unit-testable, so this can't drift from
-- the client's logic.
--
-- One real change in cost: cleaning completions. The client used to download
-- EVERY completion the venue has ever recorded just to read the latest per
-- task. `cleaning_last` returns only that latest row per task (DISTINCT ON),
-- which is all the client ever looked at.
--
-- The timestamptz parameters receive the exact strings the client used to
-- put in its PostgREST filters ('2026-09-25T00:00:00'), so they are cast in
-- the same session timezone and match the same rows as before.
--
-- SECURITY INVOKER (the default) is deliberate, as in 095: the function must
-- never see more than the caller's own RLS policies allow.
--
-- Idempotent: CREATE OR REPLACE only, no table data touched.
-- Rollback: 125_rollback.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION get_manager_notifications_data(
  p_venue_id        uuid,
  p_today           date,
  p_yesterday       date,
  p_since_30d       date,
  p_training_until  date,
  p_day_start       timestamptz,  -- p_today   || 'T00:00:00'
  p_day_end         timestamptz,  -- p_today   || 'T23:59:59'
  p_since_30d_start timestamptz,  -- p_since_30d || 'T00:00:00'
  p_edits_since     timestamptz   -- 7 days ago || 'T00:00:00'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'break_duration_mins', (
      SELECT value FROM app_settings
      WHERE venue_id = p_venue_id AND key = 'break_duration_mins'
      LIMIT 1
    ),
    'closed_days', (
      SELECT value FROM app_settings
      WHERE venue_id = p_venue_id AND key = 'closed_days'
      LIMIT 1
    ),

    'swaps_pending', (
      SELECT count(*) FROM shift_swaps
      WHERE venue_id = p_venue_id AND status = 'pending'
    ),
    'time_off_pending', (
      SELECT count(*) FROM time_off_requests
      WHERE venue_id = p_venue_id AND status = 'pending'
    ),

    'shifts_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', sh.staff_id, 'start_time', sh.start_time,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END))
      FROM shifts sh LEFT JOIN staff s ON s.id = sh.staff_id
      WHERE sh.venue_id = p_venue_id AND sh.shift_date = p_today
    ), '[]'::jsonb),

    'clock_ins_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', ce.staff_id, 'occurred_at', ce.occurred_at,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END))
      FROM clock_events ce LEFT JOIN staff s ON s.id = ce.staff_id
      WHERE ce.venue_id = p_venue_id AND ce.event_type = 'clock_in'
        AND ce.occurred_at >= p_day_start AND ce.occurred_at <= p_day_end
    ), '[]'::jsonb),

    'breaks_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', ce.staff_id, 'event_type', ce.event_type, 'occurred_at', ce.occurred_at,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END)
        ORDER BY ce.occurred_at)
      FROM clock_events ce LEFT JOIN staff s ON s.id = ce.staff_id
      WHERE ce.venue_id = p_venue_id AND ce.event_type IN ('break_start', 'break_end')
        AND ce.occurred_at >= p_day_start AND ce.occurred_at <= p_day_end
    ), '[]'::jsonb),

    'task_templates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title))
      FROM task_templates
      WHERE venue_id = p_venue_id AND is_active = true
    ), '[]'::jsonb),

    'task_completions_yesterday', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('task_template_id', task_template_id))
      FROM task_completions
      WHERE venue_id = p_venue_id AND completion_date = p_yesterday
    ), '[]'::jsonb),

    'shifts_30d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', sh.staff_id, 'shift_date', sh.shift_date, 'start_time', sh.start_time,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END))
      FROM shifts sh LEFT JOIN staff s ON s.id = sh.staff_id
      WHERE sh.venue_id = p_venue_id AND sh.shift_date >= p_since_30d AND sh.shift_date <= p_today
    ), '[]'::jsonb),

    'clock_ins_30d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('staff_id', staff_id, 'occurred_at', occurred_at))
      FROM clock_events
      WHERE venue_id = p_venue_id AND event_type = 'clock_in' AND occurred_at >= p_since_30d_start
    ), '[]'::jsonb),

    'fridge_logs_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'fridge_id', l.fridge_id, 'check_period', l.check_period,
        'temperature', l.temperature, 'exceedance_reason', l.exceedance_reason,
        'is_resolved', l.is_resolved,
        'fridge', CASE WHEN f.id IS NULL THEN NULL ELSE
          jsonb_build_object('name', f.name, 'min_temp', f.min_temp, 'max_temp', f.max_temp) END))
      FROM fridge_temperature_logs l LEFT JOIN fridges f ON f.id = l.fridge_id
      WHERE l.venue_id = p_venue_id AND l.logged_at >= p_day_start
    ), '[]'::jsonb),

    'fridges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'check_days', check_days, 'required_periods', required_periods))
      FROM fridges
      WHERE venue_id = p_venue_id AND is_active = true
    ), '[]'::jsonb),

    'training', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'expiry_date', t.expiry_date,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END)
        ORDER BY t.expiry_date)
      FROM staff_training t LEFT JOIN staff s ON s.id = t.staff_id
      WHERE t.venue_id = p_venue_id AND t.expiry_date IS NOT NULL AND t.expiry_date <= p_training_until
    ), '[]'::jsonb),

    'cleaning_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'frequency', frequency))
      FROM cleaning_tasks
      WHERE venue_id = p_venue_id AND is_active = true
    ), '[]'::jsonb),

    'venue_closures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('start_date', start_date, 'end_date', end_date))
      FROM venue_closures
      WHERE venue_id = p_venue_id
    ), '[]'::jsonb),

    -- Latest completion per task only — the client never read past it.
    'cleaning_last', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cleaning_task_id', cleaning_task_id, 'completed_at', completed_at))
      FROM (
        SELECT DISTINCT ON (cleaning_task_id) cleaning_task_id, completed_at
        FROM cleaning_completions
        WHERE venue_id = p_venue_id
        ORDER BY cleaning_task_id, completed_at DESC
      ) latest
    ), '[]'::jsonb),

    'actions_open', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'severity', severity))
      FROM corrective_actions
      WHERE venue_id = p_venue_id AND status = 'open'
    ), '[]'::jsonb),

    'probe_last', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'calibrated_at', calibrated_at))
      FROM (
        SELECT id, calibrated_at FROM probe_calibrations
        WHERE venue_id = p_venue_id
        ORDER BY calibrated_at DESC
        LIMIT 1
      ) p
    ), '[]'::jsonb),

    'clock_edit_pending', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END)
        ORDER BY r.created_at DESC)
      FROM (
        SELECT id, staff_id, created_at FROM clock_edit_requests
        WHERE venue_id = p_venue_id AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 20
      ) r LEFT JOIN staff s ON s.id = r.staff_id
    ), '[]'::jsonb),

    'hour_edits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_name', staff_name, 'shift_date', shift_date, 'created_at', created_at)
        ORDER BY created_at DESC)
      FROM (
        SELECT staff_name, shift_date, created_at FROM hour_edit_log
        WHERE venue_id = p_venue_id AND created_at >= p_edits_since
        ORDER BY created_at DESC
        LIMIT 20
      ) h
    ), '[]'::jsonb)
  )
$$;

COMMENT ON FUNCTION get_manager_notifications_data(uuid, date, date, date, date, timestamptz, timestamptz, timestamptz, timestamptz) IS
  'One-call replacement for the ~20 PostgREST reads behind the manager '
  'notification bell (useNotifications.ts). Returns raw rows; the rules stay '
  'on the client. SECURITY INVOKER — respects the caller''s RLS.';

GRANT EXECUTE ON FUNCTION get_manager_notifications_data(uuid, date, date, date, date, timestamptz, timestamptz, timestamptz, timestamptz)
  TO anon, authenticated;
