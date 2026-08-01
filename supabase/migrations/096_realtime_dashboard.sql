-- ============================================================================
-- 096: Live manager dashboard
--
-- The "Today at a glance" tiles now watch their source tables over a realtime
-- channel so a check logged on one device lands on the manager's screen
-- without a refresh. Realtime only publishes tables that are members of the
-- `supabase_realtime` publication, so without this migration the client
-- subscribes successfully and then simply never hears anything — the tiles
-- fall back to the polling backstop and no error is raised anywhere.
--
-- REPLICA IDENTITY FULL is required, not optional. The client filters each
-- subscription with `venue_id=eq.<id>` so a venue only receives its own
-- events. Postgres evaluates that filter for DELETE against the *old* row, and
-- with the default replica identity the old row is only the primary key —
-- venue_id would be null, the filter would never match, and deletes (a shift
-- removed, a completion undone) would silently not update the tiles.
--
-- The cost is a wider WAL record for updates and deletes on these tables.
-- They are low-volume operational logs — a venue writes tens to low hundreds
-- of rows a day across all of them — so this is not a meaningful load change.
--
-- duty_template_items is deliberately excluded: it has no venue_id column to
-- filter on, and it is template configuration rather than operational data.
--
-- Idempotent: re-running adds nothing twice and re-applying REPLICA IDENTITY
-- is a no-op. Safe to run on a database where some tables are already members.
--
-- ROLLBACK: 096_rollback.sql (same folder).
-- ============================================================================

DO $$
DECLARE
  t text;
  summary_tables text[] := ARRAY[
    'opening_closing_completions',
    'opening_closing_checks',
    'fridge_temperature_logs',
    'fridges',
    'cleaning_completions',
    'cleaning_tasks',
    'cooking_temp_logs',
    'hot_holding_logs',
    'cooling_logs',
    'corrective_actions',
    'time_off_requests',
    'shifts',
    'duty_assignments',
    'duty_item_completions',
    'venue_closures'
  ];
BEGIN
  FOREACH t IN ARRAY summary_tables LOOP
    -- Skip anything this database does not have rather than aborting the whole
    -- migration; these tables arrived across many earlier migrations.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE '096: skipping %, table not present', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE '096: added % to supabase_realtime', t;
    END IF;
  END LOOP;
END $$;
