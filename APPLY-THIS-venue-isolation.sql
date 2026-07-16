-- ============================================================================
-- 091: Venue-scoped RLS via JWT claims  (v2 — data-driven, drift-proof)
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR — "Run without RLS"                ║
-- ║  (the _mig_* TEMP table + DROP POLICY lines trip the linter; both benign) ║
-- ║  Prereqs: client venue-JWT injection deployed (done), fresh backup taken. ║
-- ║  ROLLBACK: 091_rollback.sql (same folder).                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- WHY v2 (the 16 Jul 2026 apply of v1 was rolled back):
--   v1 dropped old policies by *guessed name*, so prod's real open policies
--   (shifts_public_read, sp_read, time_off_read, …) survived and OR'd with the
--   new scoped ones — leaving ~35 tables open. v1 also scoped the public QR
--   allergen-menu tables, which anon must read, breaking that page.
--   v2 fixes both: it drops EVERY existing policy per table (name-agnostic),
--   and keeps a public SELECT on the allergen-menu tables (writes stay scoped).
--
-- Access model:
--   current_venue_id() reads the venue_id JWT claim (staff, via pin-login).
--   has_venue_access(v) = row's venue = caller's JWT venue  OR  caller owns
--   the venue (owners, via Supabase-Auth auth.uid()). Anon → both NULL → deny.
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS _mig_skipped (tbl text);

CREATE OR REPLACE FUNCTION current_venue_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(auth.jwt() ->> 'venue_id', '')::uuid
$$;
GRANT EXECUTE ON FUNCTION current_venue_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION has_venue_access(row_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT row_venue_id IS NOT NULL AND (
    row_venue_id = current_venue_id()
    OR EXISTS (SELECT 1 FROM venues v WHERE v.id = row_venue_id AND v.owner_id = auth.uid())
  )
$$;
GRANT EXECUTE ON FUNCTION has_venue_access(uuid) TO anon, authenticated;

-- Drop EVERY existing policy on a table (name-agnostic — the v1 fix).
CREATE OR REPLACE FUNCTION _pk_drop_all_policies(p_tbl text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = ('public.'||p_tbl)::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, p_tbl);
  END LOOP;
END $$;

-- Fully scope a table (venue_id required, else skip+report).
CREATE OR REPLACE FUNCTION _pk_scope(p_tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.'||p_tbl) IS NULL THEN
    INSERT INTO _mig_skipped VALUES (p_tbl); RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=p_tbl AND column_name='venue_id') THEN
    INSERT INTO _mig_skipped VALUES (p_tbl||' (no venue_id column)'); RETURN; END IF;
  PERFORM _pk_drop_all_policies(p_tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id))', p_tbl||'_venue_access', p_tbl);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_tbl);
END $$;

-- Public-read table: anon SELECT stays open (public QR allergen menu); writes scoped.
CREATE OR REPLACE FUNCTION _pk_public_read(p_tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.'||p_tbl) IS NULL THEN
    INSERT INTO _mig_skipped VALUES (p_tbl); RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=p_tbl AND column_name='venue_id') THEN
    INSERT INTO _mig_skipped VALUES (p_tbl||' (no venue_id column)'); RETURN; END IF;
  PERFORM _pk_drop_all_policies(p_tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', p_tbl||'_public_read', p_tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (has_venue_access(venue_id))', p_tbl||'_venue_insert', p_tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id))', p_tbl||'_venue_update', p_tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (has_venue_access(venue_id))', p_tbl||'_venue_delete', p_tbl);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_tbl);
END $$;

DO $mig$
DECLARE
  scoped text[] := ARRAY[

    'allergen_procedures',
    'apns_tokens',
    'cleaning_completions',
    'cleaning_tasks',
    'clock_events',
    'cooking_temp_logs',
    'cooling_logs',
    'corrective_actions',
    'dashboard_widgets',
    'date_labelling_logs',
    'delivery_check_items',
    'delivery_checks',
    'documents',
    'duty_assignments',
    'duty_item_completions',
    'duty_template_items',
    'duty_templates',
    'equipment_maintenance_logs',
    'fitness_declarations',
    'food_complaints',
    'fridge_temperature_logs',
    'fridges',
    'hot_holding_items',
    'hot_holding_logs',
    'hour_edit_log',
    'hr_formal_actions',
    'illness_exclusion_policies',
    'incidents',
    'leave_entitlements',
    'noticeboard_posts',
    'opening_closing_checks',
    'opening_closing_completions',
    'pest_control_logs',
    'probe_calibrations',
    'push_subscriptions',
    'rota_requirements',
    'shift_swaps',
    'shifts',
    'staff_availability',
    'staff_dashboard_today_items',
    'staff_hr_documents',
    'staff_notification_preferences',
    'staff_role_assignments',
    'staff_training',
    'staff_venue_links',
    'supplier_items',
    'supplier_order_items',
    'supplier_orders',
    'suppliers',
    'task_completions',
    'task_one_offs',
    'task_templates',
    'time_off_requests',
    'tip_allocations',
    'tip_splits',
    'venue_roles',
    'waste_logs'


  ];
  public_read text[] := ARRAY['app_settings','food_items','food_allergens'];
  t text;
BEGIN
  FOREACH t IN ARRAY scoped LOOP PERFORM _pk_scope(t); END LOOP;
  FOREACH t IN ARRAY public_read LOOP PERFORM _pk_public_read(t); END LOOP;
END $mig$;

-- venues + staff: public SELECT for the login screen; writes via SECURITY DEFINER RPCs only.
SELECT _pk_drop_all_policies('venues');
CREATE POLICY "venues_select" ON venues FOR SELECT USING (true);
SELECT _pk_drop_all_policies('staff');
CREATE POLICY "staff_select" ON staff FOR SELECT USING (true);

DROP FUNCTION _pk_drop_all_policies(text);
DROP FUNCTION _pk_scope(text);
DROP FUNCTION _pk_public_read(text);

-- Drift report — tables with no venue_id column are LEFT OPEN and listed here
-- as follow-ups (add venue_id + backfill, then scope). Nothing was broken.
SELECT COALESCE(string_agg(tbl, ', '), 'none') AS skipped_missing_tables FROM _mig_skipped;

