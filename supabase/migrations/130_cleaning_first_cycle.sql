-- ============================================================================
-- 130: New cleaning tasks get their first cycle before they count as overdue
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Safe in either order with the     ║
-- ║  client: old client + new SQL just shows the dashboard tile one lower;    ║
-- ║  new client + old SQL shows the tile one higher than the Cleaning page    ║
-- ║  until this runs. ROLLBACK: 130_rollback.sql.                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Found in the manual E2E run (25 Sep 2026): adding a weekly task made it
-- "NEVER DONE", red, and +1 on every overdue count the moment it was saved.
-- Decided rule: a never-done weekly/fortnightly/monthly/quarterly task is
-- "due soon" until one full cycle has passed since created_at, then overdue.
-- Daily keeps the calendar-day rule (not done today = flagged).
--
-- Two functions carry the rule to the client:
--   • get_dashboard_snapshot — the cleaning CTE now measures a never-done task
--     from t.created_at (COALESCE). Everything else is 120's body verbatim.
--   • get_manager_notifications_data — cleaning_tasks now includes created_at
--     so the client's cleaningStatus() can apply the same rule. Everything
--     else is 125's body verbatim.
--
-- Idempotent: CREATE OR REPLACE with unchanged signatures; grants are kept.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_snapshot(
  p_venue_id        uuid,
  p_date            date,
  p_day_start       timestamptz,
  p_day_end         timestamptz,
  p_active_periods  text[] DEFAULT ARRAY['am', 'pm']
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH
  -- ── One-off closure covering the requested date ──────────────────────────
  closure AS (
    SELECT reason
    FROM venue_closures
    WHERE venue_id = p_venue_id
      AND start_date <= p_date
      AND end_date   >= p_date
    LIMIT 1
  ),

  -- ── Cleaning: overdue = never done, or last done longer ago than its
  --    frequency allows. Daily is a calendar-day reset (done today, in the
  --    venue's local day, or it's overdue); everything else is a rolling
  --    window from the last completion.
  cleaning AS (
    SELECT count(*) AS overdue
    FROM cleaning_tasks t
    LEFT JOIN LATERAL (
      SELECT c.completed_at
      FROM cleaning_completions c
      WHERE c.cleaning_task_id = t.id
        AND c.venue_id = p_venue_id
        AND c.completed_at >= now() - interval '90 days'
      ORDER BY c.completed_at DESC
      LIMIT 1
    ) last_done ON true
    WHERE t.venue_id = p_venue_id
      AND t.is_active
      AND (
        CASE
          WHEN t.frequency = 'daily' THEN
            last_done.completed_at IS NULL
            OR last_done.completed_at < p_day_start
            OR last_done.completed_at > p_day_end
          ELSE
            -- Never done: measured from creation, so a new task gets its first
            -- cycle before it counts (130). Matches cleaningStatus() client-side.
            EXTRACT(EPOCH FROM (now() - COALESCE(last_done.completed_at, t.created_at))) / 86400 >
               CASE t.frequency
                 WHEN 'weekly'      THEN 7
                 WHEN 'fortnightly' THEN 14
                 WHEN 'monthly'     THEN 30
                 WHEN 'quarterly'   THEN 90
                 ELSE 1
               END
        END
      )
  ),

  -- ── Fridges: active ones, and how many still have a required reading
  --    missing today. "Required" mirrors isCheckRequired() in
  --    temperatureChecks.ts — a null/empty check_days means every day, a
  --    null/empty required_periods means both AM and PM. p_date's day of
  --    week uses Postgres's Sunday=0 numbering, same as JS Date#getDay(),
  --    so fridges.check_days needs no conversion (unlike closedDays, which
  --    is Monday-first — see useCleaningTasks.ts). A period only counts as
  --    missing once it's actually active (p_active_periods, from
  --    getActivePeriods() — before noon that's AM only), so a PM reading
  --    that isn't due yet doesn't flag the fridge as unchecked.
  fridge AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (
        WHERE (
          COALESCE(array_length(f.check_days, 1), 0) = 0
          OR EXTRACT(DOW FROM p_date)::int = ANY(f.check_days)
        )
        AND EXISTS (
          SELECT 1
          FROM unnest(
            CASE WHEN COALESCE(array_length(f.required_periods, 1), 0) = 0
                 THEN ARRAY['am', 'pm']
                 ELSE f.required_periods
            END
          ) AS period
          WHERE period = ANY(p_active_periods)
            AND NOT EXISTS (
              SELECT 1
              FROM fridge_temperature_logs l
              WHERE l.fridge_id    = f.id
                AND l.venue_id     = p_venue_id
                AND l.check_period = period
                AND l.logged_at   >= p_day_start
                AND l.logged_at   <= p_day_end
            )
        )
      ) AS unchecked
    FROM fridges f
    WHERE f.venue_id = p_venue_id
      AND f.is_active
  ),

  -- ── Duties attached to today's shifts, with per-assignment progress ──────
  duties AS (
    SELECT
      count(*) AS assigned,
      count(*) FILTER (WHERE total_items > 0 AND done_items >= total_items) AS completed
    FROM (
      SELECT
        (SELECT count(*) FROM duty_template_items ti
          WHERE ti.duty_template_id = da.duty_template_id) AS total_items,
        (SELECT count(*) FROM duty_item_completions dc
          WHERE dc.duty_assignment_id = da.id)             AS done_items
      FROM duty_assignments da
      JOIN shifts s ON s.id = da.shift_id
      WHERE s.venue_id   = p_venue_id
        AND s.shift_date = p_date
    ) per_assignment
  ),

  -- ── On shift right now: the latest clock_events row per staff for today.
  --    Any latest event other than clock_out means they are still on site
  --    (clocked in, or on a break). DISTINCT ON picks that row directly,
  --    which is equivalent to useTeamStatus.js's walk over ordered events
  --    since only the last event's type decides the final status.
  clocked_in AS (
    SELECT DISTINCT ON (staff_id) staff_id, event_type
    FROM clock_events
    WHERE venue_id = p_venue_id
      AND occurred_at >= p_day_start
      AND occurred_at <= p_day_end
    ORDER BY staff_id, occurred_at DESC
  )

  SELECT jsonb_build_object(
    'closureReason',      (SELECT reason FROM closure),
    'isClosed',           EXISTS (SELECT 1 FROM closure),

    'overdueClean',       (SELECT overdue FROM cleaning),

    'onShiftToday',       (SELECT count(*) FROM clocked_in
                            WHERE event_type <> 'clock_out'),

    'checksToday',        (SELECT count(*) FROM opening_closing_completions
                            WHERE venue_id = p_venue_id AND session_type = 'opening'
                              AND completed_at >= p_day_start AND completed_at <= p_day_end),

    'closingChecksToday', (SELECT count(*) FROM opening_closing_completions
                            WHERE venue_id = p_venue_id AND session_type = 'closing'
                              AND completed_at >= p_day_start AND completed_at <= p_day_end),

    'totalChecks',        (SELECT count(*) FROM opening_closing_checks
                            WHERE venue_id = p_venue_id AND is_active),

    'uncheckedFridges',   (SELECT unchecked FROM fridge),
    'totalFridges',       (SELECT total     FROM fridge),

    'pendingLeave',       (SELECT count(*) FROM time_off_requests
                            WHERE venue_id = p_venue_id AND status = 'pending'),

    'criticalActions',    (SELECT count(*) FROM corrective_actions
                            WHERE venue_id = p_venue_id AND status = 'open'
                              AND severity = 'critical'),

    'cookingTempsToday',  (SELECT count(*) FROM cooking_temp_logs
                            WHERE venue_id = p_venue_id
                              AND logged_at >= p_day_start AND logged_at <= p_day_end),

    'hotHoldingToday',    (SELECT count(*) FROM hot_holding_logs
                            WHERE venue_id = p_venue_id
                              AND logged_at >= p_day_start AND logged_at <= p_day_end),

    'coolingLogsToday',   (SELECT count(*) FROM cooling_logs
                            WHERE venue_id = p_venue_id
                              AND end_temp IS NOT NULL
                              AND logged_at >= p_day_start AND logged_at <= p_day_end),

    'dutiesAssigned',     (SELECT assigned  FROM duties),
    'dutiesCompleted',    (SELECT completed FROM duties)
  );
$$;

COMMENT ON FUNCTION get_dashboard_snapshot(uuid, date, timestamptz, timestamptz, text[]) IS
  'Manager dashboard today-summary in one round trip. Replaces 16 separate '
  'PostgREST queries from useTodaySummary. SECURITY INVOKER — respects the '
  'caller''s RLS policies. Daily cleaning tasks reset at local midnight (100). '
  'Unchecked-fridge count respects each fridge''s check_days/required_periods '
  '(101) and only flags a period missing once it is actually active for the '
  'day, e.g. no PM reading required before noon (102). onShiftToday counts '
  'staff currently clocked in, not staff rota''d (105). coolingLogsToday '
  'counts finished batches only, not ones still cooling (120). A never-done '
  'weekly+ cleaning task is only overdue once its first cycle from created_at '
  'has passed (130).';


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
      SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'frequency', frequency, 'created_at', created_at))
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
