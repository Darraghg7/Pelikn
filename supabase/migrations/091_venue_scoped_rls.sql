-- ============================================================================
-- 091: Venue-scoped RLS via JWT claims
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 2 — APPLY MANUALLY AFTER VERIFYING PHASE 1                      ║
-- ║                                                                          ║
-- ║  Before running this migration:                                          ║
-- ║  1. Deploy the pin-login edge function                                   ║
-- ║  2. Deploy the app with the updated supabase.js / SessionContext.jsx     ║
-- ║  3. Log in to Nomad and confirm all pages load correctly                 ║
-- ║  4. Only then run this migration in Supabase Dashboard → SQL Editor      ║
-- ║                                                                          ║
-- ║  ROLLBACK: run 091_rollback.sql (same folder, created alongside this)   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- How it works:
--   The pin-login edge function signs a JWT (with SUPABASE_JWT_SECRET) that
--   includes a `venue_id` claim. Every PostgREST request carries this JWT
--   as the Authorization Bearer header. The helper `current_venue_id()` below
--   reads the claim. RLS policies on every table check:
--
--     has_venue_access(venue_id)
--
--   If no JWT is present, current_venue_id() returns NULL which never equals
--   any venue_id — so the policy denies access. This replaces the previous
--   USING (true) / WITH CHECK (true) that left all data open to anyone
--   with the anon key.
--
--   Tables kept open for SELECT (needed before login):
--     venues — login page reads name/slug by URL parameter
--     staff  — login page shows the staff list to pick who's logging in
-- ============================================================================

-- ── Helper: extract venue_id from the JWT claim ───────────────────────────────

-- ── Drift guard (added July 2026) ─────────────────────────────────────────────
-- Some environments are missing tables/columns (migrations applied by hand and
-- drifted). Every statement below only runs if its table (and, for policies, the
-- venue_id column) exists; anything skipped is reported by the SELECT at the end.
CREATE TEMP TABLE IF NOT EXISTS _mig_skipped (tbl text);

CREATE OR REPLACE FUNCTION current_venue_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(auth.jwt() ->> 'venue_id', '')::uuid
$$;

GRANT EXECUTE ON FUNCTION current_venue_id() TO anon, authenticated;

-- ── Helper: venue access = your session's venue OR a venue you own ───────────
-- Staff carry venue_id in their signed JWT (current_venue_id()). Owners sign in
-- via Supabase Auth (no venue_id claim), so we also allow rows of any venue they
-- own (venues.owner_id = auth.uid()). Anon / no session → both NULL → denied.
CREATE OR REPLACE FUNCTION has_venue_access(row_venue_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_venue_id IS NOT NULL AND (
    row_venue_id = current_venue_id()
    OR EXISTS (SELECT 1 FROM venues v WHERE v.id = row_venue_id AND v.owner_id = auth.uid())
  )
$$;
GRANT EXECUTE ON FUNCTION has_venue_access(uuid) TO anon, authenticated;


-- ── Add venue_id to child tables that were missing it ─────────────────────────
-- These tables reference parent rows but had no direct venue_id column,
-- making venue-scoped policies impossible. We add + backfill the column.

DO $mig$
BEGIN
  IF to_regclass('public.staff_training') IS NOT NULL THEN
    ALTER TABLE staff_training
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.staff_training') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_training');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_training';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.staff_training') IS NOT NULL AND to_regclass('public.staff') IS NOT NULL THEN
    UPDATE staff_training st
      SET venue_id = s.venue_id
      FROM staff s
      WHERE st.staff_id = s.id AND st.venue_id IS NULL;
  ELSE
    IF to_regclass('public.staff_training') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_training');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_training';
    END IF;
    IF to_regclass('public.staff') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff';
    END IF;
  END IF;
END;
$mig$;

DO $mig$
BEGIN
  IF to_regclass('public.shift_swaps') IS NOT NULL THEN
    ALTER TABLE shift_swaps
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.shift_swaps') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('shift_swaps');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'shift_swaps';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.shift_swaps') IS NOT NULL AND to_regclass('public.shifts') IS NOT NULL THEN
    UPDATE shift_swaps sw
      SET venue_id = sh.venue_id
      FROM shifts sh
      WHERE sw.shift_id = sh.id AND sw.venue_id IS NULL;
  ELSE
    IF to_regclass('public.shift_swaps') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('shift_swaps');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'shift_swaps';
    END IF;
    IF to_regclass('public.shifts') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('shifts');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'shifts';
    END IF;
  END IF;
END;
$mig$;

DO $mig$
BEGIN
  IF to_regclass('public.supplier_items') IS NOT NULL THEN
    ALTER TABLE supplier_items
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.supplier_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_items';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.supplier_items') IS NOT NULL AND to_regclass('public.suppliers') IS NOT NULL THEN
    UPDATE supplier_items si
      SET venue_id = s.venue_id
      FROM suppliers s
      WHERE si.supplier_id = s.id AND si.venue_id IS NULL;
  ELSE
    IF to_regclass('public.supplier_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_items';
    END IF;
    IF to_regclass('public.suppliers') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('suppliers');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'suppliers';
    END IF;
  END IF;
END;
$mig$;

DO $mig$
BEGIN
  IF to_regclass('public.supplier_order_items') IS NOT NULL THEN
    ALTER TABLE supplier_order_items
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.supplier_order_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_order_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_order_items';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.supplier_order_items') IS NOT NULL AND to_regclass('public.supplier_orders') IS NOT NULL THEN
    UPDATE supplier_order_items soi
      SET venue_id = so.venue_id
      FROM supplier_orders so
      WHERE soi.order_id = so.id AND soi.venue_id IS NULL;
  ELSE
    IF to_regclass('public.supplier_order_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_order_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_order_items';
    END IF;
    IF to_regclass('public.supplier_orders') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_orders');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_orders';
    END IF;
  END IF;
END;
$mig$;

DO $mig$
BEGIN
  IF to_regclass('public.delivery_check_items') IS NOT NULL THEN
    ALTER TABLE delivery_check_items
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.delivery_check_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('delivery_check_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'delivery_check_items';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.delivery_check_items') IS NOT NULL AND to_regclass('public.delivery_checks') IS NOT NULL THEN
    UPDATE delivery_check_items dci
      SET venue_id = dc.venue_id
      FROM delivery_checks dc
      WHERE dci.delivery_check_id = dc.id AND dci.venue_id IS NULL;
  ELSE
    IF to_regclass('public.delivery_check_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('delivery_check_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'delivery_check_items';
    END IF;
    IF to_regclass('public.delivery_checks') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('delivery_checks');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'delivery_checks';
    END IF;
  END IF;
END;
$mig$;

DO $mig$
BEGIN
  IF to_regclass('public.tip_allocations') IS NOT NULL THEN
    ALTER TABLE tip_allocations
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.tip_allocations') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('tip_allocations');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'tip_allocations';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.tip_allocations') IS NOT NULL AND to_regclass('public.tip_splits') IS NOT NULL THEN
    UPDATE tip_allocations ta
      SET venue_id = ts.venue_id
      FROM tip_splits ts
      WHERE ta.tip_split_id = ts.id AND ta.venue_id IS NULL;
  ELSE
    IF to_regclass('public.tip_allocations') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('tip_allocations');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'tip_allocations';
    END IF;
    IF to_regclass('public.tip_splits') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('tip_splits');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'tip_splits';
    END IF;
  END IF;
END;
$mig$;

DO $mig$
BEGIN
  IF to_regclass('public.staff_role_assignments') IS NOT NULL THEN
    ALTER TABLE staff_role_assignments
      ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
  ELSE
    IF to_regclass('public.staff_role_assignments') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_role_assignments');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_role_assignments';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.staff_role_assignments') IS NOT NULL AND to_regclass('public.staff') IS NOT NULL THEN
    UPDATE staff_role_assignments sra
      SET venue_id = s.venue_id
      FROM staff s
      WHERE sra.staff_id = s.id AND sra.venue_id IS NULL;
  ELSE
    IF to_regclass('public.staff_role_assignments') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_role_assignments');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_role_assignments';
    END IF;
    IF to_regclass('public.staff') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff';
    END IF;
  END IF;
END;
$mig$;


-- ── Macro: replace any existing policy and create a venue-scoped one ──────────
-- Used for tables with a direct venue_id column.
-- Each block below is idempotent: DROP IF EXISTS then CREATE.


-- venues ─────────────────────────────────────────────────────────────────────
-- SELECT stays open — login page reads venue name/slug before any JWT exists.
-- Writes are already protected via SECURITY DEFINER RPCs (create_venue_with_owner).
DO $mig$
BEGIN
  IF to_regclass('public.venues') IS NOT NULL THEN
    DROP POLICY IF EXISTS "venues_public_read"    ON venues;
    DROP POLICY IF EXISTS "venues_select"         ON venues;
    DROP POLICY IF EXISTS "venues_select" ON venues;
    CREATE POLICY "venues_select" ON venues
      FOR SELECT USING (true);
  ELSE
    IF to_regclass('public.venues') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('venues');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'venues';
    END IF;
  END IF;
END;
$mig$;
-- No INSERT/UPDATE/DELETE policy for anon — all writes via SECURITY DEFINER RPCs.


-- staff ──────────────────────────────────────────────────────────────────────
-- SELECT stays open — login page shows staff list before any JWT exists.
-- All writes go through SECURITY DEFINER RPCs which bypass RLS anyway.
DO $mig$
BEGIN
  IF to_regclass('public.staff') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff_all_write"       ON staff;
    DROP POLICY IF EXISTS "staff_select"          ON staff;
    DROP POLICY IF EXISTS "staff_write"           ON staff;
    DROP POLICY IF EXISTS "staff_select" ON staff;
    CREATE POLICY "staff_select" ON staff
      FOR SELECT USING (true);
    DROP POLICY IF EXISTS "staff_write" ON staff;
    CREATE POLICY "staff_write" ON staff
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff';
    END IF;
  END IF;
END;
$mig$;


-- staff_sessions ─────────────────────────────────────────────────────────────
-- Keep the existing strict policy — sessions are never readable by clients.
-- (Already set by earlier migration; no change needed here.)


-- shifts ─────────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.shifts') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shifts' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "shifts_all_write"    ON shifts;
    DROP POLICY IF EXISTS "shifts_venue_access" ON shifts;
    DROP POLICY IF EXISTS "shifts_venue_access" ON shifts;
    CREATE POLICY "shifts_venue_access" ON shifts
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.shifts') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('shifts');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'shifts';
    ELSE
      INSERT INTO _mig_skipped VALUES ('shifts (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'shifts';
    END IF;
  END IF;
END;
$mig$;


-- app_settings ───────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "settings_all_write"    ON app_settings;
    DROP POLICY IF EXISTS "settings_venue_access" ON app_settings;
    DROP POLICY IF EXISTS "settings_venue_access" ON app_settings;
    CREATE POLICY "settings_venue_access" ON app_settings
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.app_settings') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('app_settings');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'app_settings';
    ELSE
      INSERT INTO _mig_skipped VALUES ('app_settings (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'app_settings';
    END IF;
  END IF;
END;
$mig$;


-- task_templates ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.task_templates') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_templates' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "task_templates_all_write"    ON task_templates;
    DROP POLICY IF EXISTS "task_templates_venue_access" ON task_templates;
    DROP POLICY IF EXISTS "task_templates_venue_access" ON task_templates;
    CREATE POLICY "task_templates_venue_access" ON task_templates
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.task_templates') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('task_templates');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'task_templates';
    ELSE
      INSERT INTO _mig_skipped VALUES ('task_templates (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'task_templates';
    END IF;
  END IF;
END;
$mig$;


-- task_one_offs ──────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.task_one_offs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_one_offs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "task_one_offs_all_write"    ON task_one_offs;
    DROP POLICY IF EXISTS "task_one_offs_venue_access" ON task_one_offs;
    DROP POLICY IF EXISTS "task_one_offs_venue_access" ON task_one_offs;
    CREATE POLICY "task_one_offs_venue_access" ON task_one_offs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.task_one_offs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('task_one_offs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'task_one_offs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('task_one_offs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'task_one_offs';
    END IF;
  END IF;
END;
$mig$;


-- task_completions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_completions' AND column_name = 'venue_id'
  ) THEN
    DROP POLICY IF EXISTS "task_completions_all_write"    ON task_completions;
    DROP POLICY IF EXISTS "task_completions_venue_access" ON task_completions;
    EXECUTE $p$
      CREATE POLICY "task_completions_venue_access" ON task_completions
        FOR ALL
        USING  (has_venue_access(venue_id))
        WITH CHECK (has_venue_access(venue_id))
    $p$;
  END IF;
END;
$$;


-- cleaning_tasks ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.cleaning_tasks') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cleaning_tasks' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "cleaning_tasks_all_write"    ON cleaning_tasks;
    DROP POLICY IF EXISTS "cleaning_tasks_manager_write" ON cleaning_tasks;
    DROP POLICY IF EXISTS "cleaning_tasks_public_read"  ON cleaning_tasks;
    DROP POLICY IF EXISTS "cleaning_tasks_venue_access" ON cleaning_tasks;
    DROP POLICY IF EXISTS "cleaning_tasks_venue_access" ON cleaning_tasks;
    CREATE POLICY "cleaning_tasks_venue_access" ON cleaning_tasks
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.cleaning_tasks') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('cleaning_tasks');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'cleaning_tasks';
    ELSE
      INSERT INTO _mig_skipped VALUES ('cleaning_tasks (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'cleaning_tasks';
    END IF;
  END IF;
END;
$mig$;


-- cleaning_completions ───────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.cleaning_completions') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cleaning_completions' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "cleaning_completions_all_write"  ON cleaning_completions;
    DROP POLICY IF EXISTS "cleaning_completions_public_read" ON cleaning_completions;
    DROP POLICY IF EXISTS "cleaning_completions_venue_access" ON cleaning_completions;
    CREATE POLICY "cleaning_completions_venue_access" ON cleaning_completions
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.cleaning_completions') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('cleaning_completions');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'cleaning_completions';
    ELSE
      INSERT INTO _mig_skipped VALUES ('cleaning_completions (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'cleaning_completions';
    END IF;
  END IF;
END;
$mig$;


-- fridges ────────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.fridges') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fridges' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "fridges_all_write"    ON fridges;
    DROP POLICY IF EXISTS "fridges_public_read"  ON fridges;
    DROP POLICY IF EXISTS "fridges_venue_access" ON fridges;
    CREATE POLICY "fridges_venue_access" ON fridges
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.fridges') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('fridges');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'fridges';
    ELSE
      INSERT INTO _mig_skipped VALUES ('fridges (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'fridges';
    END IF;
  END IF;
END;
$mig$;


-- fridge_temperature_logs ────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.fridge_temperature_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fridge_temperature_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "fridge_logs_all_write"       ON fridge_temperature_logs;
    DROP POLICY IF EXISTS "fridge_logs_manager_modify"  ON fridge_temperature_logs;
    DROP POLICY IF EXISTS "fridge_logs_public_insert"   ON fridge_temperature_logs;
    DROP POLICY IF EXISTS "fridge_logs_public_read"     ON fridge_temperature_logs;
    DROP POLICY IF EXISTS "fridge_logs_venue_access" ON fridge_temperature_logs;
    CREATE POLICY "fridge_logs_venue_access" ON fridge_temperature_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.fridge_temperature_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('fridge_temperature_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'fridge_temperature_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('fridge_temperature_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'fridge_temperature_logs';
    END IF;
  END IF;
END;
$mig$;


-- food_items ─────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.food_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='food_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "food_items_all_write"      ON food_items;
    DROP POLICY IF EXISTS "food_items_manager_write"  ON food_items;
    DROP POLICY IF EXISTS "food_items_public_read"    ON food_items;
    DROP POLICY IF EXISTS "food_items_venue_access" ON food_items;
    CREATE POLICY "food_items_venue_access" ON food_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.food_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('food_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'food_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('food_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'food_items';
    END IF;
  END IF;
END;
$mig$;


-- food_allergens ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.food_allergens') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='food_allergens' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "food_allergens_all_write"     ON food_allergens;
    DROP POLICY IF EXISTS "food_allergens_manager_write" ON food_allergens;
    DROP POLICY IF EXISTS "food_allergens_public_read"   ON food_allergens;
    DROP POLICY IF EXISTS "food_allergens_venue_access" ON food_allergens;
    CREATE POLICY "food_allergens_venue_access" ON food_allergens
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.food_allergens') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('food_allergens');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'food_allergens';
    ELSE
      INSERT INTO _mig_skipped VALUES ('food_allergens (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'food_allergens';
    END IF;
  END IF;
END;
$mig$;


-- waste_logs ─────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.waste_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='waste_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "waste_logs_all"          ON waste_logs;
    DROP POLICY IF EXISTS "waste_logs_venue_access" ON waste_logs;
    DROP POLICY IF EXISTS "waste_logs_venue_access" ON waste_logs;
    CREATE POLICY "waste_logs_venue_access" ON waste_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.waste_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('waste_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'waste_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('waste_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'waste_logs';
    END IF;
  END IF;
END;
$mig$;


-- delivery_checks ────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.delivery_checks') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_checks' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "delivery_checks_all"          ON delivery_checks;
    DROP POLICY IF EXISTS "delivery_checks_venue_access" ON delivery_checks;
    DROP POLICY IF EXISTS "delivery_checks_venue_access" ON delivery_checks;
    CREATE POLICY "delivery_checks_venue_access" ON delivery_checks
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.delivery_checks') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('delivery_checks');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'delivery_checks';
    ELSE
      INSERT INTO _mig_skipped VALUES ('delivery_checks (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'delivery_checks';
    END IF;
  END IF;
END;
$mig$;


-- delivery_check_items (now has venue_id after backfill above) ───────────────
DO $mig$
BEGIN
  IF to_regclass('public.delivery_check_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_check_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "delivery_check_items_read"  ON delivery_check_items;
    DROP POLICY IF EXISTS "delivery_check_items_write" ON delivery_check_items;
    DROP POLICY IF EXISTS "delivery_check_items_venue_access" ON delivery_check_items;
    CREATE POLICY "delivery_check_items_venue_access" ON delivery_check_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.delivery_check_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('delivery_check_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'delivery_check_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('delivery_check_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'delivery_check_items';
    END IF;
  END IF;
END;
$mig$;


-- suppliers ──────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.suppliers') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "suppliers_all"          ON suppliers;
    DROP POLICY IF EXISTS "suppliers_venue_access" ON suppliers;
    DROP POLICY IF EXISTS "suppliers_venue_access" ON suppliers;
    CREATE POLICY "suppliers_venue_access" ON suppliers
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.suppliers') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('suppliers');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'suppliers';
    ELSE
      INSERT INTO _mig_skipped VALUES ('suppliers (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'suppliers';
    END IF;
  END IF;
END;
$mig$;


-- supplier_items (now has venue_id) ──────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.supplier_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "supplier_items_read"         ON supplier_items;
    DROP POLICY IF EXISTS "supplier_items_write"        ON supplier_items;
    DROP POLICY IF EXISTS "supplier_items_venue_access" ON supplier_items;
    DROP POLICY IF EXISTS "supplier_items_venue_access" ON supplier_items;
    CREATE POLICY "supplier_items_venue_access" ON supplier_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.supplier_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('supplier_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'supplier_items';
    END IF;
  END IF;
END;
$mig$;


-- supplier_orders ────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.supplier_orders') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_orders' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "supplier_orders_all"          ON supplier_orders;
    DROP POLICY IF EXISTS "supplier_orders_venue_access" ON supplier_orders;
    DROP POLICY IF EXISTS "supplier_orders_venue_access" ON supplier_orders;
    CREATE POLICY "supplier_orders_venue_access" ON supplier_orders
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.supplier_orders') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_orders');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_orders';
    ELSE
      INSERT INTO _mig_skipped VALUES ('supplier_orders (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'supplier_orders';
    END IF;
  END IF;
END;
$mig$;


-- supplier_order_items (now has venue_id) ────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.supplier_order_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_order_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "open"                            ON supplier_order_items;
    DROP POLICY IF EXISTS "supplier_order_items_venue_access" ON supplier_order_items;
    DROP POLICY IF EXISTS "supplier_order_items_venue_access" ON supplier_order_items;
    CREATE POLICY "supplier_order_items_venue_access" ON supplier_order_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.supplier_order_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_order_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_order_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('supplier_order_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'supplier_order_items';
    END IF;
  END IF;
END;
$mig$;


-- opening_closing_checks ─────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.opening_closing_checks') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='opening_closing_checks' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "oc_checks_select" ON opening_closing_checks;
    DROP POLICY IF EXISTS "oc_checks_write"  ON opening_closing_checks;
    DROP POLICY IF EXISTS "oc_checks_venue_access" ON opening_closing_checks;
    CREATE POLICY "oc_checks_venue_access" ON opening_closing_checks
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.opening_closing_checks') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('opening_closing_checks');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'opening_closing_checks';
    ELSE
      INSERT INTO _mig_skipped VALUES ('opening_closing_checks (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'opening_closing_checks';
    END IF;
  END IF;
END;
$mig$;


-- opening_closing_completions ────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.opening_closing_completions') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='opening_closing_completions' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "oc_completions_all"          ON opening_closing_completions;
    DROP POLICY IF EXISTS "oc_completions_venue_access" ON opening_closing_completions;
    DROP POLICY IF EXISTS "oc_completions_venue_access" ON opening_closing_completions;
    CREATE POLICY "oc_completions_venue_access" ON opening_closing_completions
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.opening_closing_completions') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('opening_closing_completions');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'opening_closing_completions';
    ELSE
      INSERT INTO _mig_skipped VALUES ('opening_closing_completions (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'opening_closing_completions';
    END IF;
  END IF;
END;
$mig$;


-- cooking_temp_logs ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.cooking_temp_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cooking_temp_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "cooking_logs_all"          ON cooking_temp_logs;
    DROP POLICY IF EXISTS "cooking_logs_venue_access" ON cooking_temp_logs;
    DROP POLICY IF EXISTS "cooking_logs_venue_access" ON cooking_temp_logs;
    CREATE POLICY "cooking_logs_venue_access" ON cooking_temp_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.cooking_temp_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('cooking_temp_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'cooking_temp_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('cooking_temp_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'cooking_temp_logs';
    END IF;
  END IF;
END;
$mig$;


-- cooling_logs ───────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.cooling_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cooling_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "cooling_logs_all"          ON cooling_logs;
    DROP POLICY IF EXISTS "cooling_logs_venue_access" ON cooling_logs;
    DROP POLICY IF EXISTS "cooling_logs_venue_access" ON cooling_logs;
    CREATE POLICY "cooling_logs_venue_access" ON cooling_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.cooling_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('cooling_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'cooling_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('cooling_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'cooling_logs';
    END IF;
  END IF;
END;
$mig$;


-- pest_control_logs ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.pest_control_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pest_control_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "pest_control_all"          ON pest_control_logs;
    DROP POLICY IF EXISTS "pest_control_venue_access" ON pest_control_logs;
    DROP POLICY IF EXISTS "pest_control_venue_access" ON pest_control_logs;
    CREATE POLICY "pest_control_venue_access" ON pest_control_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.pest_control_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('pest_control_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'pest_control_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('pest_control_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'pest_control_logs';
    END IF;
  END IF;
END;
$mig$;


-- probe_calibrations ─────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.probe_calibrations') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='probe_calibrations' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "probe_calibrations_all"          ON probe_calibrations;
    DROP POLICY IF EXISTS "probe_calibrations_venue_access" ON probe_calibrations;
    DROP POLICY IF EXISTS "probe_calibrations_venue_access" ON probe_calibrations;
    CREATE POLICY "probe_calibrations_venue_access" ON probe_calibrations
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.probe_calibrations') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('probe_calibrations');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'probe_calibrations';
    ELSE
      INSERT INTO _mig_skipped VALUES ('probe_calibrations (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'probe_calibrations';
    END IF;
  END IF;
END;
$mig$;


-- hot_holding_items ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.hot_holding_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hot_holding_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "hot_holding_items_all"          ON hot_holding_items;
    DROP POLICY IF EXISTS "hot_holding_items_venue_access" ON hot_holding_items;
    DROP POLICY IF EXISTS "hot_holding_items_venue_access" ON hot_holding_items;
    CREATE POLICY "hot_holding_items_venue_access" ON hot_holding_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.hot_holding_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('hot_holding_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'hot_holding_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('hot_holding_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'hot_holding_items';
    END IF;
  END IF;
END;
$mig$;


-- hot_holding_logs ───────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.hot_holding_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hot_holding_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "hot_holding_logs_all"          ON hot_holding_logs;
    DROP POLICY IF EXISTS "hot_holding_logs_venue_access" ON hot_holding_logs;
    DROP POLICY IF EXISTS "hot_holding_logs_venue_access" ON hot_holding_logs;
    CREATE POLICY "hot_holding_logs_venue_access" ON hot_holding_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.hot_holding_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('hot_holding_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'hot_holding_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('hot_holding_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'hot_holding_logs';
    END IF;
  END IF;
END;
$mig$;


-- corrective_actions ─────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.corrective_actions') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='corrective_actions' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "corrective_actions_all"          ON corrective_actions;
    DROP POLICY IF EXISTS "corrective_actions_venue_access" ON corrective_actions;
    DROP POLICY IF EXISTS "corrective_actions_venue_access" ON corrective_actions;
    CREATE POLICY "corrective_actions_venue_access" ON corrective_actions
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.corrective_actions') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('corrective_actions');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'corrective_actions';
    ELSE
      INSERT INTO _mig_skipped VALUES ('corrective_actions (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'corrective_actions';
    END IF;
  END IF;
END;
$mig$;


-- rota_requirements ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.rota_requirements') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rota_requirements' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "rota_requirements_all"          ON rota_requirements;
    DROP POLICY IF EXISTS "rota_requirements_venue_access" ON rota_requirements;
    DROP POLICY IF EXISTS "rota_requirements_venue_access" ON rota_requirements;
    CREATE POLICY "rota_requirements_venue_access" ON rota_requirements
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.rota_requirements') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('rota_requirements');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'rota_requirements';
    ELSE
      INSERT INTO _mig_skipped VALUES ('rota_requirements (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'rota_requirements';
    END IF;
  END IF;
END;
$mig$;


-- clock_events ───────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.clock_events') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clock_events' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "clock_events_all_write"    ON clock_events;
    DROP POLICY IF EXISTS "clock_events_public_read"  ON clock_events;
    DROP POLICY IF EXISTS "clock_events_venue_access" ON clock_events;
    DROP POLICY IF EXISTS "clock_events_venue_access" ON clock_events;
    CREATE POLICY "clock_events_venue_access" ON clock_events
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.clock_events') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('clock_events');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'clock_events';
    ELSE
      INSERT INTO _mig_skipped VALUES ('clock_events (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'clock_events';
    END IF;
  END IF;
END;
$mig$;


-- push_subscriptions ─────────────────────────────────────────────────────────
-- The send-push edge function uses the service role key and bypasses RLS.
-- Client-side subscription management needs to be venue-scoped.
DO $mig$
BEGIN
  IF to_regclass('public.push_subscriptions') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "push_subscriptions_all"          ON push_subscriptions;
    DROP POLICY IF EXISTS "push_subscriptions_venue_access" ON push_subscriptions;
    DROP POLICY IF EXISTS "push_subscriptions_venue_access" ON push_subscriptions;
    CREATE POLICY "push_subscriptions_venue_access" ON push_subscriptions
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.push_subscriptions') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('push_subscriptions');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'push_subscriptions';
    ELSE
      INSERT INTO _mig_skipped VALUES ('push_subscriptions (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'push_subscriptions';
    END IF;
  END IF;
END;
$mig$;


-- time_off_requests ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.time_off_requests') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='time_off_requests' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "time_off_all"          ON time_off_requests;
    DROP POLICY IF EXISTS "time_off_venue_access" ON time_off_requests;
    DROP POLICY IF EXISTS "time_off_venue_access" ON time_off_requests;
    CREATE POLICY "time_off_venue_access" ON time_off_requests
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.time_off_requests') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('time_off_requests');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'time_off_requests';
    ELSE
      INSERT INTO _mig_skipped VALUES ('time_off_requests (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'time_off_requests';
    END IF;
  END IF;
END;
$mig$;


-- staff_availability ─────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_availability') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_availability' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "Public delete staff_availability" ON staff_availability;
    DROP POLICY IF EXISTS "Public read staff_availability"   ON staff_availability;
    DROP POLICY IF EXISTS "Public update staff_availability" ON staff_availability;
    DROP POLICY IF EXISTS "Public write staff_availability"  ON staff_availability;
    DROP POLICY IF EXISTS "staff_availability_venue_access" ON staff_availability;
    CREATE POLICY "staff_availability_venue_access" ON staff_availability
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_availability') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_availability');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_availability';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_availability (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_availability';
    END IF;
  END IF;
END;
$mig$;


-- fitness_declarations ───────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.fitness_declarations') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fitness_declarations' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "fitness_all"          ON fitness_declarations;
    DROP POLICY IF EXISTS "fitness_venue_access" ON fitness_declarations;
    DROP POLICY IF EXISTS "fitness_venue_access" ON fitness_declarations;
    CREATE POLICY "fitness_venue_access" ON fitness_declarations
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.fitness_declarations') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('fitness_declarations');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'fitness_declarations';
    ELSE
      INSERT INTO _mig_skipped VALUES ('fitness_declarations (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'fitness_declarations';
    END IF;
  END IF;
END;
$mig$;


-- dashboard_widgets ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.dashboard_widgets') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dashboard_widgets' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "dashboard_widgets_all"          ON dashboard_widgets;
    DROP POLICY IF EXISTS "dashboard_widgets_venue_access" ON dashboard_widgets;
    DROP POLICY IF EXISTS "dashboard_widgets_venue_access" ON dashboard_widgets;
    CREATE POLICY "dashboard_widgets_venue_access" ON dashboard_widgets
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.dashboard_widgets') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('dashboard_widgets');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'dashboard_widgets';
    ELSE
      INSERT INTO _mig_skipped VALUES ('dashboard_widgets (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'dashboard_widgets';
    END IF;
  END IF;
END;
$mig$;


-- venue_roles ────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.venue_roles') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='venue_roles' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "venue_roles_all"          ON venue_roles;
    DROP POLICY IF EXISTS "venue_roles_venue_access" ON venue_roles;
    DROP POLICY IF EXISTS "venue_roles_venue_access" ON venue_roles;
    CREATE POLICY "venue_roles_venue_access" ON venue_roles
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.venue_roles') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('venue_roles');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'venue_roles';
    ELSE
      INSERT INTO _mig_skipped VALUES ('venue_roles (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'venue_roles';
    END IF;
  END IF;
END;
$mig$;


-- staff_venue_links ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_venue_links') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_venue_links' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff_venue_links_all"          ON staff_venue_links;
    DROP POLICY IF EXISTS "staff_venue_links_venue_access" ON staff_venue_links;
    DROP POLICY IF EXISTS "staff_venue_links_venue_access" ON staff_venue_links;
    CREATE POLICY "staff_venue_links_venue_access" ON staff_venue_links
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_venue_links') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_venue_links');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_venue_links';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_venue_links (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_venue_links';
    END IF;
  END IF;
END;
$mig$;


-- tip_splits ─────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.tip_splits') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tip_splits' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "tip_splits_all"          ON tip_splits;
    DROP POLICY IF EXISTS "tip_splits_venue_access" ON tip_splits;
    DROP POLICY IF EXISTS "tip_splits_venue_access" ON tip_splits;
    CREATE POLICY "tip_splits_venue_access" ON tip_splits
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.tip_splits') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('tip_splits');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'tip_splits';
    ELSE
      INSERT INTO _mig_skipped VALUES ('tip_splits (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'tip_splits';
    END IF;
  END IF;
END;
$mig$;


-- tip_allocations (now has venue_id) ─────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.tip_allocations') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tip_allocations' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "tip_allocations_all"          ON tip_allocations;
    DROP POLICY IF EXISTS "tip_allocations_venue_access" ON tip_allocations;
    DROP POLICY IF EXISTS "tip_allocations_venue_access" ON tip_allocations;
    CREATE POLICY "tip_allocations_venue_access" ON tip_allocations
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.tip_allocations') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('tip_allocations');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'tip_allocations';
    ELSE
      INSERT INTO _mig_skipped VALUES ('tip_allocations (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'tip_allocations';
    END IF;
  END IF;
END;
$mig$;


-- documents ──────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.documents') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "documents_read"         ON documents;
    DROP POLICY IF EXISTS "documents_write"        ON documents;
    DROP POLICY IF EXISTS "documents_venue_access" ON documents;
    DROP POLICY IF EXISTS "documents_venue_access" ON documents;
    CREATE POLICY "documents_venue_access" ON documents
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.documents') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('documents');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'documents';
    ELSE
      INSERT INTO _mig_skipped VALUES ('documents (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'documents';
    END IF;
  END IF;
END;
$mig$;


-- incidents ──────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.incidents') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incidents' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "incidents_read"         ON incidents;
    DROP POLICY IF EXISTS "incidents_write"        ON incidents;
    DROP POLICY IF EXISTS "incidents_venue_access" ON incidents;
    DROP POLICY IF EXISTS "incidents_venue_access" ON incidents;
    CREATE POLICY "incidents_venue_access" ON incidents
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.incidents') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('incidents');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'incidents';
    ELSE
      INSERT INTO _mig_skipped VALUES ('incidents (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'incidents';
    END IF;
  END IF;
END;
$mig$;


-- hr_formal_actions ──────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.hr_formal_actions') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_formal_actions' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "hr_formal_actions_all"          ON hr_formal_actions;
    DROP POLICY IF EXISTS "hr_formal_actions_venue_access" ON hr_formal_actions;
    DROP POLICY IF EXISTS "hr_formal_actions_venue_access" ON hr_formal_actions;
    CREATE POLICY "hr_formal_actions_venue_access" ON hr_formal_actions
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.hr_formal_actions') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('hr_formal_actions');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'hr_formal_actions';
    ELSE
      INSERT INTO _mig_skipped VALUES ('hr_formal_actions (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'hr_formal_actions';
    END IF;
  END IF;
END;
$mig$;


-- equipment_maintenance_logs ─────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.equipment_maintenance_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_maintenance_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "equipment_maintenance_open"         ON equipment_maintenance_logs;
    DROP POLICY IF EXISTS "equipment_maintenance_venue_access" ON equipment_maintenance_logs;
    DROP POLICY IF EXISTS "equipment_maintenance_venue_access" ON equipment_maintenance_logs;
    CREATE POLICY "equipment_maintenance_venue_access" ON equipment_maintenance_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.equipment_maintenance_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('equipment_maintenance_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'equipment_maintenance_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('equipment_maintenance_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'equipment_maintenance_logs';
    END IF;
  END IF;
END;
$mig$;


-- date_labelling_logs ────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.date_labelling_logs') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='date_labelling_logs' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "date_labelling_open"         ON date_labelling_logs;
    DROP POLICY IF EXISTS "date_labelling_venue_access" ON date_labelling_logs;
    DROP POLICY IF EXISTS "date_labelling_venue_access" ON date_labelling_logs;
    CREATE POLICY "date_labelling_venue_access" ON date_labelling_logs
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.date_labelling_logs') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('date_labelling_logs');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'date_labelling_logs';
    ELSE
      INSERT INTO _mig_skipped VALUES ('date_labelling_logs (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'date_labelling_logs';
    END IF;
  END IF;
END;
$mig$;


-- duty_templates ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.duty_templates') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='duty_templates' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "duty_templates_read"         ON duty_templates;
    DROP POLICY IF EXISTS "duty_templates_write"        ON duty_templates;
    DROP POLICY IF EXISTS "duty_templates_venue_access" ON duty_templates;
    DROP POLICY IF EXISTS "duty_templates_venue_access" ON duty_templates;
    CREATE POLICY "duty_templates_venue_access" ON duty_templates
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.duty_templates') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('duty_templates');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'duty_templates';
    ELSE
      INSERT INTO _mig_skipped VALUES ('duty_templates (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'duty_templates';
    END IF;
  END IF;
END;
$mig$;


-- duty_template_items ────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.duty_template_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='duty_template_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "duty_template_items_read"         ON duty_template_items;
    DROP POLICY IF EXISTS "duty_template_items_write"        ON duty_template_items;
    DROP POLICY IF EXISTS "duty_template_items_venue_access" ON duty_template_items;
    DROP POLICY IF EXISTS "duty_template_items_venue_access" ON duty_template_items;
    CREATE POLICY "duty_template_items_venue_access" ON duty_template_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.duty_template_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('duty_template_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'duty_template_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('duty_template_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'duty_template_items';
    END IF;
  END IF;
END;
$mig$;


-- duty_assignments ───────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.duty_assignments') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='duty_assignments' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "duty_assignments_read"         ON duty_assignments;
    DROP POLICY IF EXISTS "duty_assignments_write"        ON duty_assignments;
    DROP POLICY IF EXISTS "duty_assignments_venue_access" ON duty_assignments;
    DROP POLICY IF EXISTS "duty_assignments_venue_access" ON duty_assignments;
    CREATE POLICY "duty_assignments_venue_access" ON duty_assignments
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.duty_assignments') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('duty_assignments');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'duty_assignments';
    ELSE
      INSERT INTO _mig_skipped VALUES ('duty_assignments (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'duty_assignments';
    END IF;
  END IF;
END;
$mig$;


-- duty_item_completions ──────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.duty_item_completions') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='duty_item_completions' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "duty_item_completions_read"         ON duty_item_completions;
    DROP POLICY IF EXISTS "duty_item_completions_venue_access" ON duty_item_completions;
    DROP POLICY IF EXISTS "duty_item_completions_venue_access" ON duty_item_completions;
    CREATE POLICY "duty_item_completions_venue_access" ON duty_item_completions
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.duty_item_completions') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('duty_item_completions');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'duty_item_completions';
    ELSE
      INSERT INTO _mig_skipped VALUES ('duty_item_completions (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'duty_item_completions';
    END IF;
  END IF;
END;
$mig$;


-- allergen_procedures ────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.allergen_procedures') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='allergen_procedures' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "allergen_procedures_all"          ON allergen_procedures;
    DROP POLICY IF EXISTS "allergen_procedures_venue_access" ON allergen_procedures;
    DROP POLICY IF EXISTS "allergen_procedures_venue_access" ON allergen_procedures;
    CREATE POLICY "allergen_procedures_venue_access" ON allergen_procedures
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.allergen_procedures') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('allergen_procedures');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'allergen_procedures';
    ELSE
      INSERT INTO _mig_skipped VALUES ('allergen_procedures (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'allergen_procedures';
    END IF;
  END IF;
END;
$mig$;


-- illness_exclusion_policies ─────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.illness_exclusion_policies') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='illness_exclusion_policies' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "illness_policies_all"          ON illness_exclusion_policies;
    DROP POLICY IF EXISTS "illness_policies_venue_access" ON illness_exclusion_policies;
    DROP POLICY IF EXISTS "illness_policies_venue_access" ON illness_exclusion_policies;
    CREATE POLICY "illness_policies_venue_access" ON illness_exclusion_policies
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.illness_exclusion_policies') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('illness_exclusion_policies');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'illness_exclusion_policies';
    ELSE
      INSERT INTO _mig_skipped VALUES ('illness_exclusion_policies (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'illness_exclusion_policies';
    END IF;
  END IF;
END;
$mig$;


-- staff_notification_preferences ─────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_notification_preferences') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_notification_preferences' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff_notification_preferences_all"          ON staff_notification_preferences;
    DROP POLICY IF EXISTS "staff_notification_preferences_venue_access" ON staff_notification_preferences;
    DROP POLICY IF EXISTS "staff_notification_preferences_venue_access" ON staff_notification_preferences;
    CREATE POLICY "staff_notification_preferences_venue_access" ON staff_notification_preferences
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_notification_preferences') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_notification_preferences');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_notification_preferences';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_notification_preferences (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_notification_preferences';
    END IF;
  END IF;
END;
$mig$;


-- food_complaints ────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.food_complaints') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='food_complaints' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "food_complaints_all"          ON food_complaints;
    DROP POLICY IF EXISTS "food_complaints_venue_access" ON food_complaints;
    DROP POLICY IF EXISTS "food_complaints_venue_access" ON food_complaints;
    CREATE POLICY "food_complaints_venue_access" ON food_complaints
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.food_complaints') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('food_complaints');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'food_complaints';
    ELSE
      INSERT INTO _mig_skipped VALUES ('food_complaints (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'food_complaints';
    END IF;
  END IF;
END;
$mig$;


-- hour_edit_log ──────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.hour_edit_log') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hour_edit_log' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "hour_edit_log_select"      ON hour_edit_log;
    DROP POLICY IF EXISTS "hour_edit_log_venue_access" ON hour_edit_log;
    DROP POLICY IF EXISTS "hour_edit_log_venue_access" ON hour_edit_log;
    CREATE POLICY "hour_edit_log_venue_access" ON hour_edit_log
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.hour_edit_log') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('hour_edit_log');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'hour_edit_log';
    ELSE
      INSERT INTO _mig_skipped VALUES ('hour_edit_log (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'hour_edit_log';
    END IF;
  END IF;
END;
$mig$;


-- staff_hr_documents ─────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_hr_documents') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_hr_documents' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff_hr_documents_all"          ON staff_hr_documents;
    DROP POLICY IF EXISTS "staff_hr_documents_venue_access" ON staff_hr_documents;
    DROP POLICY IF EXISTS "staff_hr_documents_venue_access" ON staff_hr_documents;
    CREATE POLICY "staff_hr_documents_venue_access" ON staff_hr_documents
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_hr_documents') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_hr_documents');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_hr_documents';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_hr_documents (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_hr_documents';
    END IF;
  END IF;
END;
$mig$;


-- leave_entitlements ─────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.leave_entitlements') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leave_entitlements' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "leave_entitlements_all"          ON leave_entitlements;
    DROP POLICY IF EXISTS "leave_entitlements_venue_access" ON leave_entitlements;
    DROP POLICY IF EXISTS "leave_entitlements_venue_access" ON leave_entitlements;
    CREATE POLICY "leave_entitlements_venue_access" ON leave_entitlements
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.leave_entitlements') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('leave_entitlements');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'leave_entitlements';
    ELSE
      INSERT INTO _mig_skipped VALUES ('leave_entitlements (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'leave_entitlements';
    END IF;
  END IF;
END;
$mig$;


-- staff_dashboard_today_items ────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_dashboard_today_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_dashboard_today_items' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff_dashboard_today_items_all"          ON staff_dashboard_today_items;
    DROP POLICY IF EXISTS "staff_dashboard_today_items_venue_access" ON staff_dashboard_today_items;
    DROP POLICY IF EXISTS "staff_dashboard_today_items_venue_access" ON staff_dashboard_today_items;
    CREATE POLICY "staff_dashboard_today_items_venue_access" ON staff_dashboard_today_items
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_dashboard_today_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_dashboard_today_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_dashboard_today_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_dashboard_today_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_dashboard_today_items';
    END IF;
  END IF;
END;
$mig$;


-- staff_training (now has venue_id) ──────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_training') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_training' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "training_select" ON staff_training;
    DROP POLICY IF EXISTS "training_insert" ON staff_training;
    DROP POLICY IF EXISTS "training_update" ON staff_training;
    DROP POLICY IF EXISTS "training_delete" ON staff_training;
    DROP POLICY IF EXISTS "staff_training_venue_access" ON staff_training;
    CREATE POLICY "staff_training_venue_access" ON staff_training
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_training') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_training');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_training';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_training (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_training';
    END IF;
  END IF;
END;
$mig$;


-- shift_swaps (now has venue_id) ─────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.shift_swaps') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_swaps' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "shift_swaps_all"          ON shift_swaps;
    DROP POLICY IF EXISTS "shift_swaps_venue_access" ON shift_swaps;
    DROP POLICY IF EXISTS "shift_swaps_venue_access" ON shift_swaps;
    CREATE POLICY "shift_swaps_venue_access" ON shift_swaps
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.shift_swaps') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('shift_swaps');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'shift_swaps';
    ELSE
      INSERT INTO _mig_skipped VALUES ('shift_swaps (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'shift_swaps';
    END IF;
  END IF;
END;
$mig$;


-- staff_role_assignments (now has venue_id) ───────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_role_assignments') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_role_assignments' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff_role_assignments_all"          ON staff_role_assignments;
    DROP POLICY IF EXISTS "staff_role_assignments_venue_access" ON staff_role_assignments;
    DROP POLICY IF EXISTS "staff_role_assignments_venue_access" ON staff_role_assignments;
    CREATE POLICY "staff_role_assignments_venue_access" ON staff_role_assignments
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.staff_role_assignments') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_role_assignments');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_role_assignments';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_role_assignments (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_role_assignments';
    END IF;
  END IF;
END;
$mig$;


-- noticeboard_posts ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noticeboard_posts') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'noticeboard_posts' AND column_name = 'venue_id'
    ) THEN
      DROP POLICY IF EXISTS "noticeboard_insert"      ON noticeboard_posts;
      DROP POLICY IF EXISTS "noticeboard_update"      ON noticeboard_posts;
      DROP POLICY IF EXISTS "noticeboard_venue_access" ON noticeboard_posts;
      EXECUTE $p$
        CREATE POLICY "noticeboard_venue_access" ON noticeboard_posts
          FOR ALL
          USING  (has_venue_access(venue_id))
          WITH CHECK (has_venue_access(venue_id))
      $p$;
    END IF;
  END IF;
END;
$$;


-- apns_tokens ────────────────────────────────────────────────────────────────
-- Already has an RLS policy from migration 062 that validates via JWT claims.
-- Replace with venue-scoped policy for consistency.
DO $mig$
BEGIN
  IF to_regclass('public.apns_tokens') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apns_tokens' AND column_name='venue_id') THEN
    DROP POLICY IF EXISTS "staff can manage own apns tokens" ON apns_tokens;
    DROP POLICY IF EXISTS "apns_tokens_venue_access" ON apns_tokens;
    CREATE POLICY "apns_tokens_venue_access" ON apns_tokens
      FOR ALL
      USING  (has_venue_access(venue_id))
      WITH CHECK (has_venue_access(venue_id));
  ELSE
    IF to_regclass('public.apns_tokens') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('apns_tokens');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'apns_tokens';
    ELSE
      INSERT INTO _mig_skipped VALUES ('apns_tokens (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'apns_tokens';
    END IF;
  END IF;
END;
$mig$;


-- staff_permissions ──────────────────────────────────────────────────────────
-- Kept as-is from migration 059b:
--   SELECT USING (true)  — needed for hasPermission() checks
--   No write policy for anon — all writes via save_staff_permissions SECURITY DEFINER
-- No change needed here.


-- ── Indexes on newly added venue_id columns ───────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public.staff_training') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_training' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_staff_training_venue_id          ON staff_training (venue_id);
  ELSE
    IF to_regclass('public.staff_training') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_training');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_training';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_training (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_training';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.shift_swaps') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_swaps' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_shift_swaps_venue_id             ON shift_swaps (venue_id);
  ELSE
    IF to_regclass('public.shift_swaps') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('shift_swaps');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'shift_swaps';
    ELSE
      INSERT INTO _mig_skipped VALUES ('shift_swaps (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'shift_swaps';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.supplier_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_items' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_supplier_items_venue_id          ON supplier_items (venue_id);
  ELSE
    IF to_regclass('public.supplier_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('supplier_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'supplier_items';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.supplier_order_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_order_items' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_supplier_order_items_venue_id    ON supplier_order_items (venue_id);
  ELSE
    IF to_regclass('public.supplier_order_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('supplier_order_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'supplier_order_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('supplier_order_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'supplier_order_items';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.delivery_check_items') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_check_items' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_delivery_check_items_venue_id    ON delivery_check_items (venue_id);
  ELSE
    IF to_regclass('public.delivery_check_items') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('delivery_check_items');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'delivery_check_items';
    ELSE
      INSERT INTO _mig_skipped VALUES ('delivery_check_items (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'delivery_check_items';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.tip_allocations') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tip_allocations' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tip_allocations_venue_id         ON tip_allocations (venue_id);
  ELSE
    IF to_regclass('public.tip_allocations') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('tip_allocations');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'tip_allocations';
    ELSE
      INSERT INTO _mig_skipped VALUES ('tip_allocations (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'tip_allocations';
    END IF;
  END IF;
END;
$mig$;
DO $mig$
BEGIN
  IF to_regclass('public.staff_role_assignments') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_role_assignments' AND column_name='venue_id') THEN
    CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_venue_id  ON staff_role_assignments (venue_id);
  ELSE
    IF to_regclass('public.staff_role_assignments') IS NULL THEN
      INSERT INTO _mig_skipped VALUES ('staff_role_assignments');
      RAISE NOTICE 'PELIKN 091: skipped — table % missing', 'staff_role_assignments';
    ELSE
      INSERT INTO _mig_skipped VALUES ('staff_role_assignments (no venue_id column)');
      RAISE NOTICE 'PELIKN 091: skipped — % has no venue_id column', 'staff_role_assignments';
    END IF;
  END IF;
END;
$mig$;


-- ── Drift report — THIS IS THE OUTPUT TO READ ────────────────────────────────
-- 'none' = the whole migration applied. Anything listed here was skipped because
-- its table or venue_id column is missing in this database (drift — investigate).
SELECT COALESCE(string_agg(DISTINCT tbl, ', ' ORDER BY tbl), 'none')
       AS skipped_missing_tables
FROM _mig_skipped;
