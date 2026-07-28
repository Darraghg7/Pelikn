-- ============================================================================
-- 095: Single-call dashboard snapshot
--
-- The manager dashboard's "today summary" was assembled from 15 parallel
-- PostgREST requests plus a sequential 16th for duties (it needed today's
-- shift ids before it could ask about duty assignments). Every one of those
-- paid its own HTTP + auth + RLS overhead, and the follow-up round trip meant
-- the tiles could not finish in under two network latencies no matter how
-- fast the queries themselves were. On venue wifi that read as a slow app.
--
-- This collapses the whole thing into one round trip. The queries are
-- unchanged in meaning — same tables, same filters — they just run next to
-- the data instead of across the network.
--
-- SECURITY INVOKER (the default) is deliberate: the function must never see
-- more than the caller's own SELECT policies allow, so it stays correct if
-- and when venue-scoped RLS is switched back on. It is not SECURITY DEFINER.
--
-- Day boundaries are passed in rather than derived from p_date in SQL. The
-- client computes them from the device's local timezone, and deriving them
-- server-side would silently shift every "today" count by the UTC offset for
-- venues that are not on UTC.
--
-- Idempotent: CREATE OR REPLACE only, no table data touched.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_snapshot(
  p_venue_id  uuid,
  p_date      date,
  p_day_start timestamptz,
  p_day_end   timestamptz
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
  --    frequency allows. Mirrors the freqDays map the client used.
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
        last_done.completed_at IS NULL
        OR EXTRACT(EPOCH FROM (now() - last_done.completed_at)) / 86400 >
           CASE t.frequency
             WHEN 'daily'       THEN 1
             WHEN 'weekly'      THEN 7
             WHEN 'fortnightly' THEN 14
             WHEN 'monthly'     THEN 30
             WHEN 'quarterly'   THEN 90
             ELSE 1
           END
      )
  ),

  -- ── Fridges: active ones, and how many have no reading logged today ──────
  fridge AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM fridge_temperature_logs l
          WHERE l.fridge_id = f.id
            AND l.venue_id  = p_venue_id
            AND l.logged_at >= p_day_start
            AND l.logged_at <= p_day_end
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
  )

  SELECT jsonb_build_object(
    'closureReason',      (SELECT reason FROM closure),
    'isClosed',           EXISTS (SELECT 1 FROM closure),

    'overdueClean',       (SELECT overdue FROM cleaning),

    'onShiftToday',       (SELECT count(*) FROM shifts
                            WHERE venue_id = p_venue_id AND shift_date = p_date),

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
                              AND logged_at >= p_day_start AND logged_at <= p_day_end),

    'dutiesAssigned',     (SELECT assigned  FROM duties),
    'dutiesCompleted',    (SELECT completed FROM duties)
  );
$$;

COMMENT ON FUNCTION get_dashboard_snapshot(uuid, date, timestamptz, timestamptz) IS
  'Manager dashboard today-summary in one round trip. Replaces 16 separate '
  'PostgREST queries from useTodaySummary. SECURITY INVOKER — respects the '
  'caller''s RLS policies.';

GRANT EXECUTE ON FUNCTION get_dashboard_snapshot(uuid, date, timestamptz, timestamptz)
  TO anon, authenticated;

-- ── Supporting indexes ──────────────────────────────────────────────────────
-- The snapshot leans on venue_id + day-bounded timestamp lookups. These match
-- the shape of every "logged today" count above.
CREATE INDEX IF NOT EXISTS fridge_temp_logs_venue_logged_idx
  ON fridge_temperature_logs (venue_id, logged_at);
CREATE INDEX IF NOT EXISTS cooking_temp_logs_venue_logged_idx
  ON cooking_temp_logs (venue_id, logged_at);
CREATE INDEX IF NOT EXISTS hot_holding_logs_venue_logged_idx
  ON hot_holding_logs (venue_id, logged_at);
CREATE INDEX IF NOT EXISTS cooling_logs_venue_logged_idx
  ON cooling_logs (venue_id, logged_at);
CREATE INDEX IF NOT EXISTS oc_completions_venue_completed_idx
  ON opening_closing_completions (venue_id, session_type, completed_at);
CREATE INDEX IF NOT EXISTS cleaning_completions_task_completed_idx
  ON cleaning_completions (cleaning_task_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS shifts_venue_date_idx
  ON shifts (venue_id, shift_date);
