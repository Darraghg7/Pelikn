-- ============================================================================
-- 102: Unchecked-fridge count respects time of day, not just day of week
--
-- get_dashboard_snapshot's `fridge` CTE (095, gated by check_days/
-- required_periods in 101) counted a fridge as "unchecked" as soon as any of
-- its required periods for today had no log — including a PM reading, before
-- the PM window had even started. A fridge logged AM-only-so-far at 9am
-- still showed up in "Fridges Due" / "N fridges not logged today" on the
-- manager dashboard, because the RPC had no idea the PM check isn't due yet.
--
-- Every other place that decides "is this period required right now"
-- (FridgeDashboardPage, FridgeLogFormPage, the client fallback query path in
-- useTodaySummary.js) already uses a noon cutoff — before 12:00 only AM is
-- active, from 12:00 both AM and PM are. This migration brings the RPC in
-- line: the caller now passes which periods are currently active
-- (getActivePeriods() in temperatureChecks.ts, same noon cutoff, using the
-- venue's local clock), and the fridge CTE only flags a period missing if
-- it's in that set.
--
-- p_active_periods defaults to both periods so an old client (pre-deploy of
-- this migration's frontend counterpart) keeps today's behavior rather than
-- erroring on a missing argument.
--
-- Full CREATE OR REPLACE — everything but the new parameter and the
-- `fridge` CTE is copied unchanged from 101_fridge_check_days_gate.sql.
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
            last_done.completed_at IS NULL
            OR EXTRACT(EPOCH FROM (now() - last_done.completed_at)) / 86400 >
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

COMMENT ON FUNCTION get_dashboard_snapshot(uuid, date, timestamptz, timestamptz, text[]) IS
  'Manager dashboard today-summary in one round trip. Replaces 16 separate '
  'PostgREST queries from useTodaySummary. SECURITY INVOKER — respects the '
  'caller''s RLS policies. Daily cleaning tasks reset at local midnight (100). '
  'Unchecked-fridge count respects each fridge''s check_days/required_periods '
  '(101) and only flags a period missing once it is actually active for the '
  'day, e.g. no PM reading required before noon (102).';
