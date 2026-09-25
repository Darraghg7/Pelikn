-- Rollback for 120.
--
-- Restores get_dashboard_snapshot exactly as 105 left it, removes 'fridge' as a
-- cooling method and makes end_temp required again.
--
-- ⚠ Batches still cooling (end_temp IS NULL) or recorded with the 'fridge'
-- method block the constraints below. Finish or delete those rows first — this
-- script won't guess an end temperature or a method for them. Only run
-- alongside reverting the client, which otherwise keeps starting batches with
-- no end temperature and fails every insert.

DROP INDEX IF EXISTS cooling_logs_in_progress_idx;

-- Drop the method CHECK by what it checks, not by name, in case the live
-- database named it differently from the 019 default.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.cooling_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%cooling_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.cooling_logs DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE cooling_logs ADD CONSTRAINT cooling_logs_cooling_method_check
  CHECK (cooling_method IN ('ambient','ice_bath','blast_chiller','cold_water','other'));

ALTER TABLE cooling_logs ALTER COLUMN end_temp SET NOT NULL;
ALTER TABLE cooling_logs DROP COLUMN IF EXISTS finished_at;

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
  'staff currently clocked in, not staff rota''d (105).';
