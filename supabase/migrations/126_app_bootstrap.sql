-- ============================================================================
-- 126: One-call startup bundle for the dashboard
--
-- Measured 25 Sep 2026: on a cold open the database has been idle, and the
-- cost of the first burst grows with how many requests arrive at once —
-- 1 request ~1.0 s, 6 ~1.9 s, 12 ~2.5 s, 20 ~3.4-8 s. After 125 and the
-- deferred widget cards, the mobile dashboard still opened with 18 requests
-- at once, ~14 of them small lookups: venue settings (3), the viewer's
-- dashboard layout (2), their clock status and weekly hours (2), the
-- closing-checklist gate (2), their own swap/leave/shift updates (3), the
-- disciplinary alert, the unsigned-training count and the managers list.
--
-- This returns the rows for all of them in one round trip, so a cold open
-- sends ~4 requests instead of 18.
--
-- As in 125 it returns *data*, not answers: every hook keeps its own logic
-- and uses this only for its first load, falling back to its own query when
-- the function is missing or a slice doesn't cover what it needs. Parameters
-- carry the exact filter values the hooks used, so the same rows come back.
--
-- p_staff_id may be NULL (no signed-in staff member); every per-person slice
-- is then empty and the client ignores it.
--
-- SECURITY INVOKER (the default) is deliberate: it must never see more than
-- the caller's own RLS and column grants allow. It selects only the columns
-- the hooks already selected, so the column-level revokes in 116-119 (pay,
-- pin_hash, time-off reasons) are unaffected.
--
-- Idempotent: CREATE OR REPLACE only, no table data touched.
-- Rollback: 126_rollback.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION get_app_bootstrap(
  p_venue_id           uuid,
  p_staff_id           uuid,
  p_setting_keys       text[],
  p_today              date,         -- londonToday()
  p_week_start         timestamptz,  -- start of this week (Mon), as the client computed it
  p_updates_since      timestamptz,  -- 7 days ago || 'T00:00:00'
  p_disciplinary_since timestamptz   -- now - 7 days
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH last_boundary AS (
    -- Latest clock_in/clock_out for the viewer: is there an open session?
    SELECT event_type, occurred_at
    FROM clock_events
    WHERE staff_id = p_staff_id AND venue_id = p_venue_id
      AND event_type IN ('clock_in', 'clock_out')
    ORDER BY occurred_at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'staff_id',     p_staff_id,
    'setting_keys', to_jsonb(p_setting_keys),

    'settings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', key, 'value', value))
      FROM app_settings
      WHERE venue_id = p_venue_id AND key = ANY (p_setting_keys)
    ), '[]'::jsonb),

    'widget_layout', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('widget_id', widget_id, 'position', position) ORDER BY position)
      FROM dashboard_widgets
      WHERE venue_id = p_venue_id AND staff_id = p_staff_id
    ), '[]'::jsonb),

    'today_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('item_id', item_id, 'position', position) ORDER BY position)
      FROM staff_dashboard_today_items
      WHERE venue_id = p_venue_id AND staff_id = p_staff_id
    ), '[]'::jsonb),

    'clock_last', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('event_type', event_type, 'occurred_at', occurred_at))
      FROM last_boundary
    ), '[]'::jsonb),

    -- Every event since the open clock_in, only when the session is open.
    'clock_session', CASE
      WHEN (SELECT event_type FROM last_boundary) = 'clock_in' THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('event_type', event_type, 'occurred_at', occurred_at) ORDER BY occurred_at)
        FROM clock_events
        WHERE staff_id = p_staff_id AND venue_id = p_venue_id
          AND occurred_at >= (SELECT occurred_at FROM last_boundary)
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END,

    'week_clock', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('event_type', event_type, 'occurred_at', occurred_at) ORDER BY occurred_at)
      FROM clock_events
      WHERE staff_id = p_staff_id AND venue_id = p_venue_id
        AND event_type IN ('clock_in', 'clock_out')
        AND occurred_at >= p_week_start
    ), '[]'::jsonb),

    'closing_shifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('is_closing', is_closing))
      FROM shifts
      WHERE venue_id = p_venue_id AND staff_id = p_staff_id AND shift_date = p_today
    ), '[]'::jsonb),

    'my_role_ids', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('role_id', role_id))
      FROM staff_role_assignments
      WHERE staff_id = p_staff_id
    ), '[]'::jsonb),

    'my_swaps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status, 'resolved_at', resolved_at) ORDER BY resolved_at DESC)
      FROM (
        SELECT id, status, resolved_at FROM shift_swaps
        WHERE venue_id = p_venue_id AND requester_id = p_staff_id
          AND status IN ('approved', 'rejected') AND resolved_at >= p_updates_since
        ORDER BY resolved_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb),

    'my_time_off', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'status', status, 'start_date', start_date, 'end_date', end_date, 'reviewed_at', reviewed_at)
        ORDER BY reviewed_at DESC)
      FROM (
        SELECT id, status, start_date, end_date, reviewed_at FROM time_off_requests
        WHERE venue_id = p_venue_id AND staff_id = p_staff_id
          AND status IN ('approved', 'rejected') AND reviewed_at >= p_updates_since
        ORDER BY reviewed_at DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),

    'my_shifts_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'shift_date', shift_date, 'start_time', start_time, 'end_time', end_time)
        ORDER BY start_time)
      FROM (
        SELECT id, shift_date, start_time, end_time FROM shifts
        WHERE venue_id = p_venue_id AND staff_id = p_staff_id AND shift_date = p_today
        ORDER BY start_time
        LIMIT 5
      ) s
    ), '[]'::jsonb),

    'disciplinary', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'offence_type', d.offence_type, 'strike_number', d.strike_number,
        'occurred_at', d.occurred_at,
        'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END)
        ORDER BY d.occurred_at DESC)
      FROM staff_disciplinary_log d LEFT JOIN staff s ON s.id = d.staff_id
      WHERE d.venue_id = p_venue_id AND d.strike_number = 4 AND d.occurred_at >= p_disciplinary_since
    ), '[]'::jsonb),

    'unsigned_training', (
      SELECT count(*) FROM training_sign_offs
      WHERE venue_id = p_venue_id AND staff_acknowledged = false
    ),

    'managers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'photo_url', photo_url) ORDER BY name)
      FROM staff
      WHERE venue_id = p_venue_id AND is_active = true AND role IN ('manager', 'owner')
    ), '[]'::jsonb)
  )
$$;

COMMENT ON FUNCTION get_app_bootstrap(uuid, uuid, text[], date, timestamptz, timestamptz, timestamptz) IS
  'One-call startup bundle for the dashboard (settings, layout, clock status, '
  'own updates, alerts). Returns raw rows; each hook keeps its own logic and '
  'uses this only for its first load. SECURITY INVOKER — respects the '
  'caller''s RLS and column grants.';

GRANT EXECUTE ON FUNCTION get_app_bootstrap(uuid, uuid, text[], date, timestamptz, timestamptz, timestamptz)
  TO anon, authenticated;
