-- ============================================================================
-- 143: Optional extras — switch them ON for venues that already use them
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Never `supabase db push`.         ║
-- ║  Apply BEFORE the app change (PR "Optional extras") goes live, or venues  ║
-- ║  lose their extras from the menu until this runs.                        ║
-- ║  ROLLBACK: 143_rollback.sql (same folder).                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- The app now treats eleven side features as "optional extras": OFF unless
-- the venue's app_settings 'features' JSON lists them in a new `extras` array
-- (src/lib/features.ts, EXTRA_FEATURES). Nothing is deleted — a switched-off
-- extra is just hidden from the menus and its pages redirect to the dashboard.
--
-- Rule agreed with Darragh (8 Oct 2026): a venue with ANY existing record for
-- an extra keeps it switched on. This migration writes `extras` for every
-- venue, built from the data:
--
--   fitness       fitness_declarations, illness_exclusion_policies
--   recall        recall_logs, recall_procedures
--   complaints    food_complaints
--   haccp         haccp_plans
--   eho_mock      mock_inspections
--   equipment_maintenance  equipment_maintenance_logs
--   date_labelling         date_labelling_logs
--   tips          tip_splits
--   noticeboard   noticeboard_posts
--   waste         waste_logs
--   orders        supplier_orders
--
-- Venues with no 'features' row get {"mode":"all","extras":[...]} — "all"
-- is exactly what the app assumed for them before, so nothing else changes.
-- A table that doesn't exist (or has no venue_id) is skipped with a NOTICE.
--
-- Idempotent: re-running recomputes `extras` from the data, so it only ever
-- ADDS extras that have data; it never removes one a manager switched on.
-- ============================================================================

BEGIN;

-- app_settings is read on nearly every page load; don't queue behind a long
-- lock and stall the app. If this times out, just run it again.
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE _extras_in_use (venue_id uuid, extra text) ON COMMIT DROP;

DO $$
DECLARE
  m record;
BEGIN
  FOR m IN SELECT * FROM (VALUES
    ('fitness',               'fitness_declarations'),
    ('fitness',               'illness_exclusion_policies'),
    ('recall',                'recall_logs'),
    ('recall',                'recall_procedures'),
    ('complaints',            'food_complaints'),
    ('haccp',                 'haccp_plans'),
    ('eho_mock',              'mock_inspections'),
    ('equipment_maintenance', 'equipment_maintenance_logs'),
    ('date_labelling',        'date_labelling_logs'),
    ('tips',                  'tip_splits'),
    ('noticeboard',           'noticeboard_posts'),
    ('waste',                 'waste_logs'),
    ('orders',                'supplier_orders')
  ) AS v(extra, tbl)
  LOOP
    IF to_regclass('public.' || m.tbl) IS NULL THEN
      RAISE NOTICE '143: table % not found — skipped', m.tbl;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = m.tbl AND column_name = 'venue_id'
    ) THEN
      RAISE NOTICE '143: table % has no venue_id — skipped', m.tbl;
    ELSE
      EXECUTE format(
        'INSERT INTO _extras_in_use SELECT DISTINCT venue_id, %L FROM public.%I WHERE venue_id IS NOT NULL',
        m.extra, m.tbl);
    END IF;
  END LOOP;
END $$;

-- Every venue gets an `extras` array (empty when it uses none), so the app
-- can tell "switched off" apart from "never set".
WITH per_venue AS (
  SELECT v.id AS venue_id,
         COALESCE(jsonb_agg(DISTINCT u.extra) FILTER (WHERE u.extra IS NOT NULL), '[]'::jsonb) AS in_use
  FROM public.venues v
  LEFT JOIN _extras_in_use u ON u.venue_id = v.id
  GROUP BY v.id
),
cur AS (
  SELECT p.venue_id, p.in_use,
         CASE WHEN s.value IS NOT NULL AND s.value ~ '^\s*\{' THEN s.value::jsonb END AS cfg
  FROM per_venue p
  LEFT JOIN public.app_settings s ON s.venue_id = p.venue_id AND s.key = 'features'
)
INSERT INTO public.app_settings (venue_id, key, value)
SELECT venue_id, 'features',
       (COALESCE(cfg, '{"mode":"all"}'::jsonb)
         || jsonb_build_object('extras', (
              SELECT COALESCE(jsonb_agg(DISTINCT e), '[]'::jsonb)
              FROM jsonb_array_elements_text(
                COALESCE(cfg -> 'extras', '[]'::jsonb) || in_use) AS e
            )))::text
FROM cur
ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;

-- ── Verify (read-only) ──────────────────────────────────────────────────────
-- Every venue should have an "extras" list; venues that use an extra list it.
--
-- SELECT v.name, v.slug, s.value::jsonb -> 'extras' AS extras_on
-- FROM public.venues v
-- LEFT JOIN public.app_settings s ON s.venue_id = v.id AND s.key = 'features'
-- ORDER BY v.name;
