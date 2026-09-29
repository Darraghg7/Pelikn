-- ============================================================================
-- 136: One-call data for the Team hub and the Checks hub tiles
--
-- Measured 29 Sep 2026 (Nomad's manager reported both pages slow): the Team
-- hub opened with 10 requests at once — eight in useTeamStatus plus two in
-- useManagerCalendar, which the hub only used for a "N upcoming" count — and
-- the Checks hub with four extra tile lookups on top of the day snapshot.
-- On a cold database the cost of a burst grows with how many requests
-- arrive together (see 126), so each page now asks once.
--
-- Same rules as 125/126:
--  - returns data, not answers — the hooks keep their own logic;
--  - parameters carry the exact filter values the hooks used (day bounds are
--    computed client-side, in London time, so non-UTC maths never happens here);
--  - SECURITY INVOKER (the default) on purpose: never sees more than the
--    caller's own RLS and column grants allow, and selects only columns the
--    hooks already selected;
--  - the client falls back to its old per-table queries while this is missing.
--
-- Idempotent: CREATE OR REPLACE only, no table data touched.
-- Rollback: 136_rollback.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_status(
  p_venue_id       uuid,
  p_day_start      timestamptz,  -- London midnight today
  p_day_end        timestamptz,  -- London midnight tomorrow - 1 ms
  p_today          date,         -- londonToday()
  p_training_until date,         -- today + 30 days
  p_week_from      date,         -- Monday of this week
  p_week_to        date,         -- Sunday of this week
  p_rota_key       text,         -- 'rota_published_' || Monday
  p_calendar_from  date,         -- first day counted as "upcoming"
  p_calendar_to    date          -- last day counted as "upcoming"
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
      FROM staff
      WHERE venue_id = p_venue_id AND is_active = true
    ), '[]'::jsonb),

    'clock_events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', staff_id, 'event_type', event_type, 'occurred_at', occurred_at)
        ORDER BY occurred_at)
      FROM clock_events
      WHERE venue_id = p_venue_id AND occurred_at >= p_day_start AND occurred_at <= p_day_end
    ), '[]'::jsonb),

    'today_shifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'staff_id', staff_id, 'start_time', start_time, 'end_time', end_time))
      FROM shifts
      WHERE venue_id = p_venue_id AND shift_date = p_today
    ), '[]'::jsonb),

    'pending_swaps', (
      SELECT count(*) FROM shift_swaps WHERE venue_id = p_venue_id AND status = 'pending'
    ),

    'pending_time_off', (
      SELECT count(*) FROM time_off_requests WHERE venue_id = p_venue_id AND status = 'pending'
    ),

    'expiring_training', (
      SELECT count(*) FROM staff_training
      WHERE venue_id = p_venue_id AND expiry_date >= p_today AND expiry_date <= p_training_until
    ),

    'rota_unfilled', (
      SELECT count(*) FROM shifts
      WHERE venue_id = p_venue_id AND staff_id IS NULL
        AND shift_date >= p_week_from AND shift_date <= p_week_to
    ),

    'rota_published', (
      SELECT value FROM app_settings WHERE venue_id = p_venue_id AND key = p_rota_key LIMIT 1
    ),

    'calendar_upcoming', (
      SELECT count(*) FROM manager_calendar_events
      WHERE venue_id = p_venue_id AND start_date >= p_calendar_from AND start_date <= p_calendar_to
    )
  )
$$;

COMMENT ON FUNCTION get_team_status(uuid, timestamptz, timestamptz, date, date, date, date, text, date, date) IS
  'One-call data for the Team hub (who is on shift, pending swaps/leave, '
  'expiring training, rota state, upcoming calendar events). Returns raw rows '
  'and counts; useTeamStatus keeps its own logic. SECURITY INVOKER — respects '
  'the caller''s RLS and column grants.';

GRANT EXECUTE ON FUNCTION get_team_status(uuid, timestamptz, timestamptz, date, date, date, date, text, date, date)
  TO anon, authenticated;


CREATE OR REPLACE FUNCTION get_checks_status(
  p_venue_id  uuid,
  p_day_start timestamptz,
  p_day_end   timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'fitness_count', (
      SELECT count(*) FROM fitness_declarations
      WHERE venue_id = p_venue_id AND declared_at >= p_day_start AND declared_at <= p_day_end
    ),
    'last_calibrated_at', (
      SELECT max(calibrated_at) FROM probe_calibrations WHERE venue_id = p_venue_id
    ),
    'delivery_count', (
      SELECT count(*) FROM delivery_checks
      WHERE venue_id = p_venue_id AND checked_at >= p_day_start AND checked_at <= p_day_end
    ),
    'open_incidents', (
      SELECT count(*) FROM incidents WHERE venue_id = p_venue_id AND status = 'open'
    )
  )
$$;

COMMENT ON FUNCTION get_checks_status(uuid, timestamptz, timestamptz) IS
  'One-call data for the Checks hub tiles not covered by get_dashboard_snapshot '
  '(fitness, probe calibration, deliveries, open incidents). SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION get_checks_status(uuid, timestamptz, timestamptz)
  TO anon, authenticated;
