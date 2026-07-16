-- ============================================================================
-- 091 ROLLBACK (v2) — revert venue-scoped RLS to fully-open access.
-- Run in Supabase SQL Editor ("Run without RLS") if 091 causes issues.
-- Drops every policy on each managed table (name-agnostic) and restores a
-- single open FOR ALL USING(true) policy. Data is never touched — only access.
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS _mig_skipped (tbl text);

CREATE OR REPLACE FUNCTION _pk_drop_all_policies(p_tbl text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = ('public.'||p_tbl)::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, p_tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION _pk_open(p_tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.'||p_tbl) IS NULL THEN
    INSERT INTO _mig_skipped VALUES (p_tbl); RETURN; END IF;
  PERFORM _pk_drop_all_policies(p_tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', p_tbl||'_open', p_tbl);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_tbl);
END $$;

DO $mig$
DECLARE
  managed text[] := ARRAY[
    'venues','staff',
    'app_settings','food_items','food_allergens',

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
  t text;
BEGIN
  FOREACH t IN ARRAY managed LOOP PERFORM _pk_open(t); END LOOP;
END $mig$;

DROP FUNCTION _pk_drop_all_policies(text);
DROP FUNCTION _pk_open(text);

-- Helpers are dropped last (policies referenced them until now).
DROP FUNCTION IF EXISTS has_venue_access(uuid);
DROP FUNCTION IF EXISTS current_venue_id();

SELECT COALESCE(string_agg(tbl, ', '), 'none') AS skipped_missing_tables FROM _mig_skipped;

