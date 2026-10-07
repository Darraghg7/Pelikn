-- ============================================================================
-- 140: Closed periods in My Calendar actually close the venue
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR.                                   ║
-- ║  Prereqs: 030 (venue_closures), 087 (manager_calendar_events).           ║
-- ║  Optional first: run the PREVIEW query below on its own — read-only —    ║
-- ║  to see what the back-fill at the bottom will do.                        ║
-- ║  Safe in either order with the client change in the same PR.             ║
-- ║  ROLLBACK: 140_rollback.sql (removes the link column and triggers; the   ║
-- ║  back-filled closures are left in place, see that file).                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── What was wrong ──────────────────────────────────────────────────────────
-- Checks, cleaning, fridge history, the dashboard and notifications decide
-- "was the venue closed that day?" from venue_closures only — both in the app
-- and in the server functions (get_dashboard_snapshot, the cleaning and fridge
-- RPCs from 095/100-102/105/120/125/130).
--
-- 087 moved closed periods into manager_calendar_events (type = 'closed') with
-- a one-off copy, and Venue Settings started sending managers to My Calendar
-- to add them. Nothing copied them back. Every closed period added in the
-- calendar since 087 has had no effect: checks on those days still show as
-- overdue / missed.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
-- venue_closures stays the one list everything reads. A calendar 'closed'
-- event now owns a matching venue_closures row, linked by calendar_event_id:
--
--   calendar event added / edited as 'closed'  → closure row upserted
--   calendar event changed to another type      → closure row deleted
--   calendar event deleted                      → closure row deleted (FK cascade)
--   linked closure deleted elsewhere (Rota,
--     Venue Settings)                           → calendar event deleted too
--
-- Closures added in Rota or Venue Settings have no calendar event; the
-- calendar page shows them read-only.
--
-- ── PREVIEW (read-only — run on its own before applying) ────────────────────
-- Every calendar 'closed' event, and what the back-fill will do with it:
--   'link'   = an identical closure already exists (087's copy) — just linked
--   'insert' = no closure exists — one is created, so checks stop on those days
--
--   SELECT e.venue_id, e.title, e.start_date, e.end_date, e.created_at,
--          CASE WHEN EXISTS (
--            SELECT 1 FROM venue_closures c
--            WHERE c.venue_id = e.venue_id
--              AND c.start_date = LEAST(e.start_date, e.end_date)
--              AND c.end_date   = GREATEST(e.start_date, e.end_date)
--          ) THEN 'link' ELSE 'insert' END AS backfill_action
--   FROM manager_calendar_events e
--   WHERE e.type = 'closed'
--   ORDER BY backfill_action DESC, e.start_date;
--
-- One case to eyeball in the 'insert' rows: a closure that 087 copied into the
-- calendar and someone later removed from the Rota. The calendar kept showing
-- it as closed, so the back-fill will make it closed again. If any 'insert' row
-- is a day the venue really traded, delete that event in My Calendar after
-- applying — the closure goes with it.
-- ============================================================================

SET lock_timeout = '5s';

-- ── 1. Link column ──────────────────────────────────────────────────────────
ALTER TABLE venue_closures
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid
    REFERENCES manager_calendar_events(id) ON DELETE CASCADE;

-- Plain UNIQUE (NULLs don't collide), so ON CONFLICT (calendar_event_id) works.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venue_closures_calendar_event_id_key'
  ) THEN
    ALTER TABLE venue_closures
      ADD CONSTRAINT venue_closures_calendar_event_id_key UNIQUE (calendar_event_id);
  END IF;
END $$;

-- ── 2. Calendar → closures ──────────────────────────────────────────────────
-- SECURITY DEFINER: the event row has already passed manager_calendar_events
-- RLS, and the closure is written to that same venue.
CREATE OR REPLACE FUNCTION sync_calendar_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'closed' THEN
    INSERT INTO venue_closures (venue_id, start_date, end_date, reason, calendar_event_id)
    VALUES (
      NEW.venue_id,
      LEAST(NEW.start_date, NEW.end_date),
      GREATEST(NEW.start_date, NEW.end_date),
      NULLIF(TRIM(NEW.title), ''),
      NEW.id
    )
    ON CONFLICT (calendar_event_id) DO UPDATE
      SET venue_id   = EXCLUDED.venue_id,
          start_date = EXCLUDED.start_date,
          end_date   = EXCLUDED.end_date,
          reason     = EXCLUDED.reason;
  ELSE
    DELETE FROM venue_closures WHERE calendar_event_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION sync_calendar_closure() FROM PUBLIC;

DROP TRIGGER IF EXISTS manager_calendar_events_sync_closure ON manager_calendar_events;
CREATE TRIGGER manager_calendar_events_sync_closure
  AFTER INSERT OR UPDATE OF type, venue_id, start_date, end_date, title
  ON manager_calendar_events
  FOR EACH ROW EXECUTE FUNCTION sync_calendar_closure();

-- ── 3. Closures → calendar (deletes only) ───────────────────────────────────
-- Removing a linked closure from the Rota or Venue Settings removes the
-- calendar event, so the calendar never shows "Closed" on a day checks treat
-- as open. When the delete started from the event, the FK cascade gets here
-- with the event already gone and this deletes nothing. When it started from
-- the event being changed to another type, the event is no longer 'closed'
-- and is kept.
CREATE OR REPLACE FUNCTION delete_closure_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.calendar_event_id IS NOT NULL THEN
    DELETE FROM manager_calendar_events
    WHERE id = OLD.calendar_event_id AND type = 'closed';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION delete_closure_calendar_event() FROM PUBLIC;

DROP TRIGGER IF EXISTS venue_closures_delete_calendar_event ON venue_closures;
CREATE TRIGGER venue_closures_delete_calendar_event
  AFTER DELETE ON venue_closures
  FOR EACH ROW EXECUTE FUNCTION delete_closure_calendar_event();

-- ── 4. Back-fill ────────────────────────────────────────────────────────────
-- Link each closed event to an identical unlinked closure if there is one
-- (087's copies), otherwise create the closure.
DO $$
DECLARE
  e        record;
  match_id uuid;
BEGIN
  FOR e IN
    SELECT * FROM manager_calendar_events
    WHERE type = 'closed'
      AND NOT EXISTS (SELECT 1 FROM venue_closures c WHERE c.calendar_event_id = manager_calendar_events.id)
    ORDER BY created_at, id
  LOOP
    SELECT c.id INTO match_id
    FROM venue_closures c
    WHERE c.venue_id = e.venue_id
      AND c.calendar_event_id IS NULL
      AND c.start_date = LEAST(e.start_date, e.end_date)
      AND c.end_date   = GREATEST(e.start_date, e.end_date)
    ORDER BY c.created_at, c.id
    LIMIT 1;

    IF match_id IS NOT NULL THEN
      UPDATE venue_closures SET calendar_event_id = e.id WHERE id = match_id;
    ELSE
      INSERT INTO venue_closures (venue_id, start_date, end_date, reason, calendar_event_id)
      VALUES (e.venue_id, LEAST(e.start_date, e.end_date), GREATEST(e.start_date, e.end_date),
              NULLIF(TRIM(e.title), ''), e.id);
    END IF;
  END LOOP;
END $$;

RESET lock_timeout;

-- Expect 0: every closed calendar event now has its closure.
SELECT count(*) AS closed_events_without_closure
FROM manager_calendar_events e
WHERE e.type = 'closed'
  AND NOT EXISTS (SELECT 1 FROM venue_closures c WHERE c.calendar_event_id = e.id);
