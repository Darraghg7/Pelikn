# Duplicate clock punches — diagnosis and repair

Written up after the Nomad manager reported that a staff member's hours weren't
recorded even though she had clocked in, and that adding the hours by hand
didn't work either.

Migrations 105 and 106 fix the cause going forward. **They do not clean up rows
that already exist** — this document is how to find and fix those.

## What went wrong

`makeRetryFetch` (`src/lib/supabase.js`) aborts any request after 20 s and
retries writes twice more (1 s then 2 s back-off). An RPC POST counts as a
write, so on a slow connection a clock-in that the server *did* process — but
whose response didn't arrive before the abort — was sent again, up to three
times. `record_clock_event` was an unconditional `INSERT`, so every attempt that
reached the database added another `clock_in` row.

This is why it showed up on mobile data and not on WiFi.

One extra `clock_in` is enough to make a fully worked day look like no day at
all:

1. Timesheet grouping starts a new session at every `clock_in` and attaches the
   `clock_out` to the most recent one. The duplicate leaves the *earlier*
   session permanently open.
2. The day view drew only `sessions[0]` — the dangling one — so the day rendered
   as **"Off"** with an **Add** button.
3. Pressing Add inserted a third `clock_in`, which also landed behind the same
   orphan. The manually added hours were saved correctly and still didn't
   appear, which is what "couldn't add the hours manually" was.

The period totals were right the whole time; only the per-day view was wrong.
Worth saying to the manager — no one was actually underpaid by this, they just
couldn't see or correct the day.

## Finding the affected rows

Read-only. Run in the Supabase SQL editor. Lists every `clock_in` that has
another `clock_in` for the same staff member within two minutes — the signature
of a retried write.

```sql
SELECT
  s.name,
  e.venue_id,
  e.occurred_at AT TIME ZONE 'Europe/London' AS punched_at_london,
  e.id          AS duplicate_event_id,
  prev.id       AS kept_event_id,
  EXTRACT(EPOCH FROM (e.occurred_at - prev.occurred_at))::int AS seconds_apart
FROM clock_events e
JOIN LATERAL (
  SELECT p.id, p.occurred_at
  FROM clock_events p
  WHERE p.staff_id   = e.staff_id
    AND p.event_type = 'clock_in'
    AND p.occurred_at < e.occurred_at
  ORDER BY p.occurred_at DESC
  LIMIT 1
) prev ON true
JOIN staff s ON s.id = e.staff_id
WHERE e.event_type = 'clock_in'
  AND e.occurred_at - prev.occurred_at < interval '2 minutes'
ORDER BY e.occurred_at DESC;
```

A companion query for the symptom rather than the cause — days where someone has
an unclosed `clock_in` with a later session on the same London day:

```sql
WITH ordered AS (
  SELECT
    e.*,
    lead(e.event_type) OVER w AS next_type,
    (e.occurred_at AT TIME ZONE 'Europe/London')::date AS london_day
  FROM clock_events e
  WINDOW w AS (PARTITION BY e.staff_id ORDER BY e.occurred_at)
)
SELECT s.name, o.london_day, o.id AS dangling_clock_in, o.occurred_at
FROM ordered o
JOIN staff s ON s.id = o.staff_id
WHERE o.event_type = 'clock_in'
  AND o.next_type  = 'clock_in'
ORDER BY o.london_day DESC;
```

## Repairing

**Read the first query's output before deleting anything.** These rows are
payroll records. `seconds_apart` under ~60 and an identical wall-clock minute is
a retry; anything approaching two minutes could conceivably be a real double
punch on a shared device, and is worth eyeballing against the rota first.

Once you're satisfied, delete by explicit id — not by a blanket `WHERE` clause:

```sql
DELETE FROM clock_events WHERE id IN (
  '…',  -- duplicate_event_id values from the query above
  '…'
);
```

Deleting the *earlier* of a duplicate pair is usually right: the retry that
carried the later timestamp is the one the `clock_out` got attached to, so
removing the earlier orphan leaves a complete session. The first query returns
`kept_event_id` (the earlier row) and `duplicate_event_id` (the later one) so
you can see which is which — check the pairing before assuming.

You do not have to delete anything for the display to be correct: the app now
sets a dangling punch aside on its own and labels it "N duplicate punches
ignored". Cleaning up just makes the underlying data match what's on screen.

## What stops it recurring

- **Migration 106** makes `record_clock_event` ignore a repeat of the same event
  type for the same staff member within 120 s, and return the existing row's id.
  The retry chain is bounded at ~63 s, so this covers it with margin while
  staying far short of any legitimate repeat.
- **`partitionDaySessions`** (`src/lib/timesheet.js`) sets aside a `clock_in`
  with no `clock_out` that is followed by another session the same day, so an
  orphan can never hide a real one again. A *trailing* open session is still
  shown — that's someone on shift now, or a genuinely missed clock-out.
- The day view renders **every** session for a day rather than just the first,
  which also fixes split shifts (lunch then dinner) showing only their first half.
