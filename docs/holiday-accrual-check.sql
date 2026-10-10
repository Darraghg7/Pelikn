-- ============================================================================
-- Holiday accrual check — READ ONLY (it only reads; nothing is changed)
--
-- Paste into Supabase → SQL Editor and press Run. One row per active staff
-- member, from the start of the holiday year up to now:
--
--   hours_worked          paid hours from clock-ins, using the timesheet's rules
--                         (completed breaks taken off; a shift with no clock-out
--                         counts as 0 — see missed_clock_outs)
--   accrued_hours         12.07% of hours_worked (capped at 224)
--   avg_shift_hours       hours_worked ÷ days worked (7.6 until 3 days worked)
--   holiday_days_taken    approved annual leave on their working days, up to today
--   holiday_hours_taken   those days × avg_shift_hours
--   hours_left_now        accrued_hours − holiday_hours_taken
--   booked_ahead_*        approved leave still to come this holiday year
--   hours_left_after_booked   what's left once that's taken too (what the app shows)
--   missed_clock_outs     shifts with a clock-in but no clock-out — worth fixing
--                         on the timesheet, as those hours earn no holiday
--
-- This mirrors the app's calculation, so the numbers should match what Time off
-- shows. Holiday hours are estimated from the average shift because holiday pay
-- allocation (migration 148) isn't in use yet.
--
-- Change the two values in `params` if needed: your venue's slug (from the app's
-- web address, /v/<slug>/…) and the first day of your holiday year.
-- ============================================================================

WITH params AS (
  SELECT 'nomad-bakes'::text AS venue_slug,
         DATE '2026-01-01'   AS year_from,
         DATE '2026-12-31'   AS year_to,
         (now() AT TIME ZONE 'Europe/London')::date AS today
),
people AS (
  SELECT s.id, s.name, s.employment_type,
         CASE WHEN coalesce(array_length(s.working_days, 1), 0) = 0
              THEN ARRAY[1,2,3,4,5] ELSE s.working_days END AS pattern,
         coalesce(array_length(s.working_days, 1), 0) = 0 AS pattern_not_set
  FROM staff s
  JOIN venues v ON v.id = s.venue_id
  CROSS JOIN params p
  WHERE lower(v.slug) = lower(p.venue_slug) AND s.is_active
),
-- Clock events this holiday year, numbered into sessions: each clock_in starts one
ev AS (
  SELECT e.id, e.staff_id, e.event_type, e.occurred_at,
         sum(CASE WHEN e.event_type = 'clock_in' THEN 1 ELSE 0 END)
           OVER (PARTITION BY e.staff_id ORDER BY e.occurred_at, e.id) AS sess
  FROM clock_events e
  JOIN people pe ON pe.id = e.staff_id
  CROSS JOIN params p
  WHERE e.occurred_at >= p.year_from::timestamp AT TIME ZONE 'UTC'
    AND e.occurred_at <= now()
),
-- A break counts when a break_start is followed (among that shift's break
-- events) by a break_end — the same pairing the timesheet uses
brk AS (
  SELECT staff_id, sess, event_type, occurred_at,
         lead(event_type)  OVER w AS next_type,
         lead(occurred_at) OVER w AS next_at
  FROM ev
  WHERE sess > 0 AND event_type IN ('break_start', 'break_end')
  WINDOW w AS (PARTITION BY staff_id, sess ORDER BY occurred_at, id)
),
breaks AS (
  SELECT staff_id, sess, sum(extract(epoch FROM next_at - occurred_at) / 60) AS break_mins
  FROM brk
  WHERE event_type = 'break_start' AND next_type = 'break_end'
  GROUP BY staff_id, sess
),
sessions AS (
  SELECT ev.staff_id, ev.sess,
         min(ev.occurred_at) FILTER (WHERE ev.event_type = 'clock_in')  AS t_in,
         max(ev.occurred_at) FILTER (WHERE ev.event_type = 'clock_out') AS t_out
  FROM ev
  WHERE ev.sess > 0
  GROUP BY ev.staff_id, ev.sess
),
shift_mins AS (
  SELECT s.staff_id, s.t_in,
         (s.t_in AT TIME ZONE 'Europe/London')::date AS work_day,
         s.t_out IS NULL AS no_clock_out,
         CASE WHEN s.t_out IS NULL THEN 0
              ELSE greatest(0, extract(epoch FROM s.t_out - s.t_in) / 60 - coalesce(b.break_mins, 0))
         END AS mins
  FROM sessions s
  LEFT JOIN breaks b ON b.staff_id = s.staff_id AND b.sess = s.sess
),
-- A missing clock-out followed by another shift the same day is a duplicate
-- punch, not a missed clock-out (the timesheet hides those too)
missed AS (
  SELECT staff_id, count(*) AS missed_clock_outs
  FROM (
    SELECT staff_id, no_clock_out,
           lead(work_day) OVER (PARTITION BY staff_id ORDER BY t_in) AS next_day,
           work_day
    FROM shift_mins
  ) x
  WHERE no_clock_out AND (next_day IS NULL OR next_day <> work_day)
  GROUP BY staff_id
),
worked AS (
  SELECT staff_id,
         sum(mins) / 60.0 AS hours,
         count(DISTINCT work_day) FILTER (WHERE mins > 0) AS days_worked
  FROM (SELECT staff_id, work_day, sum(mins) AS mins FROM shift_mins GROUP BY staff_id, work_day) d
  GROUP BY staff_id
),
-- Approved annual leave, one row per day inside the holiday year
leave_days AS (
  SELECT r.staff_id, d::date AS day
  FROM time_off_requests r
  JOIN people pe ON pe.id = r.staff_id
  CROSS JOIN params p
  CROSS JOIN LATERAL generate_series(greatest(r.start_date, p.year_from),
                                     least(r.end_date, p.year_to),
                                     interval '1 day') d
  WHERE r.status = 'approved' AND r.leave_type = 'annual'
    AND r.start_date <= p.year_to AND r.end_date >= p.year_from
),
leave_counts AS (
  SELECT ld.staff_id,
         count(*) FILTER (WHERE ld.day <= p.today) AS days_taken,
         count(*) FILTER (WHERE ld.day >  p.today) AS days_ahead
  FROM leave_days ld
  JOIN people pe ON pe.id = ld.staff_id
  CROSS JOIN params p
  WHERE extract(isodow FROM ld.day)::int = ANY (pe.pattern)
  GROUP BY ld.staff_id
),
summary AS (
  SELECT pe.name, pe.employment_type,
         CASE WHEN pe.pattern_not_set THEN 'NOT SET (Mon–Fri assumed)'
              ELSE array_to_string(pe.pattern, ',') END AS working_days,
         round(coalesce(w.hours, 0), 1) AS hours_worked,
         coalesce(w.days_worked, 0) AS days_worked,
         CASE WHEN coalesce(w.days_worked, 0) >= 3
              THEN round(w.hours / w.days_worked, 1) ELSE 7.6 END AS avg_shift_hours,
         least(round(coalesce(w.hours, 0) * 0.1207, 1), 224) AS accrued_hours,
         coalesce(l.days_taken, 0) AS holiday_days_taken,
         coalesce(l.days_ahead, 0) AS booked_ahead_days,
         coalesce(m.missed_clock_outs, 0) AS missed_clock_outs
  FROM people pe
  LEFT JOIN worked w       ON w.staff_id = pe.id
  LEFT JOIN leave_counts l ON l.staff_id = pe.id
  LEFT JOIN missed m       ON m.staff_id = pe.id
)
SELECT name, employment_type, working_days,
       hours_worked, days_worked, avg_shift_hours, accrued_hours,
       holiday_days_taken,
       round(holiday_days_taken * avg_shift_hours, 1) AS holiday_hours_taken,
       round(accrued_hours - holiday_days_taken * avg_shift_hours, 1) AS hours_left_now,
       booked_ahead_days,
       round(booked_ahead_days * avg_shift_hours, 1) AS booked_ahead_hours,
       round(accrued_hours - (holiday_days_taken + booked_ahead_days) * avg_shift_hours, 1) AS hours_left_after_booked,
       missed_clock_outs
FROM summary
ORDER BY name;
