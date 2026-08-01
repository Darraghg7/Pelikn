-- ============================================================================
-- 096 ROLLBACK: remove the dashboard tables from realtime
--
-- Reverses 096_realtime_dashboard.sql. The client degrades on its own: with no
-- events arriving it falls back to the polling backstop, so the tiles stay
-- correct, just no longer live. No frontend change is needed to run this.
--
-- REPLICA IDENTITY goes back to DEFAULT (primary key), which is what these
-- tables had before 096.
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
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', t);
    END IF;
  END LOOP;
END $$;
