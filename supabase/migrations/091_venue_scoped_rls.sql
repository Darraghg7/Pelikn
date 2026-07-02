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
--     venue_id = current_venue_id()
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
CREATE OR REPLACE FUNCTION current_venue_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(auth.jwt() ->> 'venue_id', '')::uuid
$$;

GRANT EXECUTE ON FUNCTION current_venue_id() TO anon, authenticated;


-- ── Add venue_id to child tables that were missing it ─────────────────────────
-- These tables reference parent rows but had no direct venue_id column,
-- making venue-scoped policies impossible. We add + backfill the column.

ALTER TABLE staff_training
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE staff_training st
  SET venue_id = s.venue_id
  FROM staff s
  WHERE st.staff_id = s.id AND st.venue_id IS NULL;

ALTER TABLE shift_swaps
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE shift_swaps sw
  SET venue_id = sh.venue_id
  FROM shifts sh
  WHERE sw.shift_id = sh.id AND sw.venue_id IS NULL;

ALTER TABLE supplier_items
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE supplier_items si
  SET venue_id = s.venue_id
  FROM suppliers s
  WHERE si.supplier_id = s.id AND si.venue_id IS NULL;

ALTER TABLE supplier_order_items
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE supplier_order_items soi
  SET venue_id = so.venue_id
  FROM supplier_orders so
  WHERE soi.order_id = so.id AND soi.venue_id IS NULL;

ALTER TABLE delivery_check_items
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE delivery_check_items dci
  SET venue_id = dc.venue_id
  FROM delivery_checks dc
  WHERE dci.delivery_check_id = dc.id AND dci.venue_id IS NULL;

ALTER TABLE tip_allocations
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE tip_allocations ta
  SET venue_id = ts.venue_id
  FROM tip_splits ts
  WHERE ta.tip_split_id = ts.id AND ta.venue_id IS NULL;

ALTER TABLE staff_role_assignments
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE CASCADE;
UPDATE staff_role_assignments sra
  SET venue_id = s.venue_id
  FROM staff s
  WHERE sra.staff_id = s.id AND sra.venue_id IS NULL;


-- ── Macro: replace any existing policy and create a venue-scoped one ──────────
-- Used for tables with a direct venue_id column.
-- Each block below is idempotent: DROP IF EXISTS then CREATE.


-- venues ─────────────────────────────────────────────────────────────────────
-- SELECT stays open — login page reads venue name/slug before any JWT exists.
-- Writes are already protected via SECURITY DEFINER RPCs (create_venue_with_owner).
DROP POLICY IF EXISTS "venues_public_read"    ON venues;
DROP POLICY IF EXISTS "venues_select"         ON venues;
CREATE POLICY "venues_select" ON venues
  FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy for anon — all writes via SECURITY DEFINER RPCs.


-- staff ──────────────────────────────────────────────────────────────────────
-- SELECT stays open — login page shows staff list before any JWT exists.
-- All writes go through SECURITY DEFINER RPCs which bypass RLS anyway.
DROP POLICY IF EXISTS "staff_all_write"       ON staff;
DROP POLICY IF EXISTS "staff_select"          ON staff;
DROP POLICY IF EXISTS "staff_write"           ON staff;
CREATE POLICY "staff_select" ON staff
  FOR SELECT USING (true);
CREATE POLICY "staff_write" ON staff
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_sessions ─────────────────────────────────────────────────────────────
-- Keep the existing strict policy — sessions are never readable by clients.
-- (Already set by earlier migration; no change needed here.)


-- shifts ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shifts_all_write"    ON shifts;
DROP POLICY IF EXISTS "shifts_venue_access" ON shifts;
CREATE POLICY "shifts_venue_access" ON shifts
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- app_settings ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_all_write"    ON app_settings;
DROP POLICY IF EXISTS "settings_venue_access" ON app_settings;
CREATE POLICY "settings_venue_access" ON app_settings
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- task_templates ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_templates_all_write"    ON task_templates;
DROP POLICY IF EXISTS "task_templates_venue_access" ON task_templates;
CREATE POLICY "task_templates_venue_access" ON task_templates
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- task_one_offs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_one_offs_all_write"    ON task_one_offs;
DROP POLICY IF EXISTS "task_one_offs_venue_access" ON task_one_offs;
CREATE POLICY "task_one_offs_venue_access" ON task_one_offs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


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
        USING  (venue_id = current_venue_id())
        WITH CHECK (venue_id = current_venue_id())
    $p$;
  END IF;
END;
$$;


-- cleaning_tasks ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cleaning_tasks_all_write"    ON cleaning_tasks;
DROP POLICY IF EXISTS "cleaning_tasks_manager_write" ON cleaning_tasks;
DROP POLICY IF EXISTS "cleaning_tasks_public_read"  ON cleaning_tasks;
DROP POLICY IF EXISTS "cleaning_tasks_venue_access" ON cleaning_tasks;
CREATE POLICY "cleaning_tasks_venue_access" ON cleaning_tasks
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- cleaning_completions ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cleaning_completions_all_write"  ON cleaning_completions;
DROP POLICY IF EXISTS "cleaning_completions_public_read" ON cleaning_completions;
CREATE POLICY "cleaning_completions_venue_access" ON cleaning_completions
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- fridges ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fridges_all_write"    ON fridges;
DROP POLICY IF EXISTS "fridges_public_read"  ON fridges;
CREATE POLICY "fridges_venue_access" ON fridges
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- fridge_temperature_logs ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fridge_logs_all_write"       ON fridge_temperature_logs;
DROP POLICY IF EXISTS "fridge_logs_manager_modify"  ON fridge_temperature_logs;
DROP POLICY IF EXISTS "fridge_logs_public_insert"   ON fridge_temperature_logs;
DROP POLICY IF EXISTS "fridge_logs_public_read"     ON fridge_temperature_logs;
CREATE POLICY "fridge_logs_venue_access" ON fridge_temperature_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- food_items ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "food_items_all_write"      ON food_items;
DROP POLICY IF EXISTS "food_items_manager_write"  ON food_items;
DROP POLICY IF EXISTS "food_items_public_read"    ON food_items;
CREATE POLICY "food_items_venue_access" ON food_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- food_allergens ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "food_allergens_all_write"     ON food_allergens;
DROP POLICY IF EXISTS "food_allergens_manager_write" ON food_allergens;
DROP POLICY IF EXISTS "food_allergens_public_read"   ON food_allergens;
CREATE POLICY "food_allergens_venue_access" ON food_allergens
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- waste_logs ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "waste_logs_all"          ON waste_logs;
DROP POLICY IF EXISTS "waste_logs_venue_access" ON waste_logs;
CREATE POLICY "waste_logs_venue_access" ON waste_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- delivery_checks ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "delivery_checks_all"          ON delivery_checks;
DROP POLICY IF EXISTS "delivery_checks_venue_access" ON delivery_checks;
CREATE POLICY "delivery_checks_venue_access" ON delivery_checks
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- delivery_check_items (now has venue_id after backfill above) ───────────────
DROP POLICY IF EXISTS "delivery_check_items_read"  ON delivery_check_items;
DROP POLICY IF EXISTS "delivery_check_items_write" ON delivery_check_items;
CREATE POLICY "delivery_check_items_venue_access" ON delivery_check_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- suppliers ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "suppliers_all"          ON suppliers;
DROP POLICY IF EXISTS "suppliers_venue_access" ON suppliers;
CREATE POLICY "suppliers_venue_access" ON suppliers
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- supplier_items (now has venue_id) ──────────────────────────────────────────
DROP POLICY IF EXISTS "supplier_items_read"         ON supplier_items;
DROP POLICY IF EXISTS "supplier_items_write"        ON supplier_items;
DROP POLICY IF EXISTS "supplier_items_venue_access" ON supplier_items;
CREATE POLICY "supplier_items_venue_access" ON supplier_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- supplier_orders ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "supplier_orders_all"          ON supplier_orders;
DROP POLICY IF EXISTS "supplier_orders_venue_access" ON supplier_orders;
CREATE POLICY "supplier_orders_venue_access" ON supplier_orders
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- supplier_order_items (now has venue_id) ────────────────────────────────────
DROP POLICY IF EXISTS "open"                            ON supplier_order_items;
DROP POLICY IF EXISTS "supplier_order_items_venue_access" ON supplier_order_items;
CREATE POLICY "supplier_order_items_venue_access" ON supplier_order_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- opening_closing_checks ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "oc_checks_select" ON opening_closing_checks;
DROP POLICY IF EXISTS "oc_checks_write"  ON opening_closing_checks;
CREATE POLICY "oc_checks_venue_access" ON opening_closing_checks
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- opening_closing_completions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "oc_completions_all"          ON opening_closing_completions;
DROP POLICY IF EXISTS "oc_completions_venue_access" ON opening_closing_completions;
CREATE POLICY "oc_completions_venue_access" ON opening_closing_completions
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- cooking_temp_logs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cooking_logs_all"          ON cooking_temp_logs;
DROP POLICY IF EXISTS "cooking_logs_venue_access" ON cooking_temp_logs;
CREATE POLICY "cooking_logs_venue_access" ON cooking_temp_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- cooling_logs ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cooling_logs_all"          ON cooling_logs;
DROP POLICY IF EXISTS "cooling_logs_venue_access" ON cooling_logs;
CREATE POLICY "cooling_logs_venue_access" ON cooling_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- pest_control_logs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pest_control_all"          ON pest_control_logs;
DROP POLICY IF EXISTS "pest_control_venue_access" ON pest_control_logs;
CREATE POLICY "pest_control_venue_access" ON pest_control_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- probe_calibrations ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "probe_calibrations_all"          ON probe_calibrations;
DROP POLICY IF EXISTS "probe_calibrations_venue_access" ON probe_calibrations;
CREATE POLICY "probe_calibrations_venue_access" ON probe_calibrations
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- hot_holding_items ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hot_holding_items_all"          ON hot_holding_items;
DROP POLICY IF EXISTS "hot_holding_items_venue_access" ON hot_holding_items;
CREATE POLICY "hot_holding_items_venue_access" ON hot_holding_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- hot_holding_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hot_holding_logs_all"          ON hot_holding_logs;
DROP POLICY IF EXISTS "hot_holding_logs_venue_access" ON hot_holding_logs;
CREATE POLICY "hot_holding_logs_venue_access" ON hot_holding_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- corrective_actions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "corrective_actions_all"          ON corrective_actions;
DROP POLICY IF EXISTS "corrective_actions_venue_access" ON corrective_actions;
CREATE POLICY "corrective_actions_venue_access" ON corrective_actions
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- rota_requirements ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rota_requirements_all"          ON rota_requirements;
DROP POLICY IF EXISTS "rota_requirements_venue_access" ON rota_requirements;
CREATE POLICY "rota_requirements_venue_access" ON rota_requirements
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- clock_events ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clock_events_all_write"    ON clock_events;
DROP POLICY IF EXISTS "clock_events_public_read"  ON clock_events;
DROP POLICY IF EXISTS "clock_events_venue_access" ON clock_events;
CREATE POLICY "clock_events_venue_access" ON clock_events
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- push_subscriptions ─────────────────────────────────────────────────────────
-- The send-push edge function uses the service role key and bypasses RLS.
-- Client-side subscription management needs to be venue-scoped.
DROP POLICY IF EXISTS "push_subscriptions_all"          ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_venue_access" ON push_subscriptions;
CREATE POLICY "push_subscriptions_venue_access" ON push_subscriptions
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- time_off_requests ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "time_off_all"          ON time_off_requests;
DROP POLICY IF EXISTS "time_off_venue_access" ON time_off_requests;
CREATE POLICY "time_off_venue_access" ON time_off_requests
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_availability ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public delete staff_availability" ON staff_availability;
DROP POLICY IF EXISTS "Public read staff_availability"   ON staff_availability;
DROP POLICY IF EXISTS "Public update staff_availability" ON staff_availability;
DROP POLICY IF EXISTS "Public write staff_availability"  ON staff_availability;
CREATE POLICY "staff_availability_venue_access" ON staff_availability
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- fitness_declarations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fitness_all"          ON fitness_declarations;
DROP POLICY IF EXISTS "fitness_venue_access" ON fitness_declarations;
CREATE POLICY "fitness_venue_access" ON fitness_declarations
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- dashboard_widgets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dashboard_widgets_all"          ON dashboard_widgets;
DROP POLICY IF EXISTS "dashboard_widgets_venue_access" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_venue_access" ON dashboard_widgets
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- venue_roles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "venue_roles_all"          ON venue_roles;
DROP POLICY IF EXISTS "venue_roles_venue_access" ON venue_roles;
CREATE POLICY "venue_roles_venue_access" ON venue_roles
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_venue_links ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_venue_links_all"          ON staff_venue_links;
DROP POLICY IF EXISTS "staff_venue_links_venue_access" ON staff_venue_links;
CREATE POLICY "staff_venue_links_venue_access" ON staff_venue_links
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- tip_splits ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tip_splits_all"          ON tip_splits;
DROP POLICY IF EXISTS "tip_splits_venue_access" ON tip_splits;
CREATE POLICY "tip_splits_venue_access" ON tip_splits
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- tip_allocations (now has venue_id) ─────────────────────────────────────────
DROP POLICY IF EXISTS "tip_allocations_all"          ON tip_allocations;
DROP POLICY IF EXISTS "tip_allocations_venue_access" ON tip_allocations;
CREATE POLICY "tip_allocations_venue_access" ON tip_allocations
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- documents ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents_read"         ON documents;
DROP POLICY IF EXISTS "documents_write"        ON documents;
DROP POLICY IF EXISTS "documents_venue_access" ON documents;
CREATE POLICY "documents_venue_access" ON documents
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- incidents ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "incidents_read"         ON incidents;
DROP POLICY IF EXISTS "incidents_write"        ON incidents;
DROP POLICY IF EXISTS "incidents_venue_access" ON incidents;
CREATE POLICY "incidents_venue_access" ON incidents
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- hr_formal_actions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hr_formal_actions_all"          ON hr_formal_actions;
DROP POLICY IF EXISTS "hr_formal_actions_venue_access" ON hr_formal_actions;
CREATE POLICY "hr_formal_actions_venue_access" ON hr_formal_actions
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- equipment_maintenance_logs ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "equipment_maintenance_open"         ON equipment_maintenance_logs;
DROP POLICY IF EXISTS "equipment_maintenance_venue_access" ON equipment_maintenance_logs;
CREATE POLICY "equipment_maintenance_venue_access" ON equipment_maintenance_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- date_labelling_logs ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "date_labelling_open"         ON date_labelling_logs;
DROP POLICY IF EXISTS "date_labelling_venue_access" ON date_labelling_logs;
CREATE POLICY "date_labelling_venue_access" ON date_labelling_logs
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- duty_templates ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "duty_templates_read"         ON duty_templates;
DROP POLICY IF EXISTS "duty_templates_write"        ON duty_templates;
DROP POLICY IF EXISTS "duty_templates_venue_access" ON duty_templates;
CREATE POLICY "duty_templates_venue_access" ON duty_templates
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- duty_template_items ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "duty_template_items_read"         ON duty_template_items;
DROP POLICY IF EXISTS "duty_template_items_write"        ON duty_template_items;
DROP POLICY IF EXISTS "duty_template_items_venue_access" ON duty_template_items;
CREATE POLICY "duty_template_items_venue_access" ON duty_template_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- duty_assignments ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "duty_assignments_read"         ON duty_assignments;
DROP POLICY IF EXISTS "duty_assignments_write"        ON duty_assignments;
DROP POLICY IF EXISTS "duty_assignments_venue_access" ON duty_assignments;
CREATE POLICY "duty_assignments_venue_access" ON duty_assignments
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- duty_item_completions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "duty_item_completions_read"         ON duty_item_completions;
DROP POLICY IF EXISTS "duty_item_completions_venue_access" ON duty_item_completions;
CREATE POLICY "duty_item_completions_venue_access" ON duty_item_completions
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- allergen_procedures ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allergen_procedures_all"          ON allergen_procedures;
DROP POLICY IF EXISTS "allergen_procedures_venue_access" ON allergen_procedures;
CREATE POLICY "allergen_procedures_venue_access" ON allergen_procedures
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- illness_exclusion_policies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "illness_policies_all"          ON illness_exclusion_policies;
DROP POLICY IF EXISTS "illness_policies_venue_access" ON illness_exclusion_policies;
CREATE POLICY "illness_policies_venue_access" ON illness_exclusion_policies
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_notification_preferences ─────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_notification_preferences_all"          ON staff_notification_preferences;
DROP POLICY IF EXISTS "staff_notification_preferences_venue_access" ON staff_notification_preferences;
CREATE POLICY "staff_notification_preferences_venue_access" ON staff_notification_preferences
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- food_complaints ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "food_complaints_all"          ON food_complaints;
DROP POLICY IF EXISTS "food_complaints_venue_access" ON food_complaints;
CREATE POLICY "food_complaints_venue_access" ON food_complaints
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- hour_edit_log ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hour_edit_log_select"      ON hour_edit_log;
DROP POLICY IF EXISTS "hour_edit_log_venue_access" ON hour_edit_log;
CREATE POLICY "hour_edit_log_venue_access" ON hour_edit_log
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_hr_documents ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_hr_documents_all"          ON staff_hr_documents;
DROP POLICY IF EXISTS "staff_hr_documents_venue_access" ON staff_hr_documents;
CREATE POLICY "staff_hr_documents_venue_access" ON staff_hr_documents
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- leave_entitlements ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_entitlements_all"          ON leave_entitlements;
DROP POLICY IF EXISTS "leave_entitlements_venue_access" ON leave_entitlements;
CREATE POLICY "leave_entitlements_venue_access" ON leave_entitlements
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_dashboard_today_items ────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_dashboard_today_items_all"          ON staff_dashboard_today_items;
DROP POLICY IF EXISTS "staff_dashboard_today_items_venue_access" ON staff_dashboard_today_items;
CREATE POLICY "staff_dashboard_today_items_venue_access" ON staff_dashboard_today_items
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_training (now has venue_id) ──────────────────────────────────────────
DROP POLICY IF EXISTS "training_select" ON staff_training;
DROP POLICY IF EXISTS "training_insert" ON staff_training;
DROP POLICY IF EXISTS "training_update" ON staff_training;
DROP POLICY IF EXISTS "training_delete" ON staff_training;
CREATE POLICY "staff_training_venue_access" ON staff_training
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- shift_swaps (now has venue_id) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "shift_swaps_all"          ON shift_swaps;
DROP POLICY IF EXISTS "shift_swaps_venue_access" ON shift_swaps;
CREATE POLICY "shift_swaps_venue_access" ON shift_swaps
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_role_assignments (now has venue_id) ───────────────────────────────────
DROP POLICY IF EXISTS "staff_role_assignments_all"          ON staff_role_assignments;
DROP POLICY IF EXISTS "staff_role_assignments_venue_access" ON staff_role_assignments;
CREATE POLICY "staff_role_assignments_venue_access" ON staff_role_assignments
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


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
          USING  (venue_id = current_venue_id())
          WITH CHECK (venue_id = current_venue_id())
      $p$;
    END IF;
  END IF;
END;
$$;


-- apns_tokens ────────────────────────────────────────────────────────────────
-- Already has an RLS policy from migration 062 that validates via JWT claims.
-- Replace with venue-scoped policy for consistency.
DROP POLICY IF EXISTS "staff can manage own apns tokens" ON apns_tokens;
CREATE POLICY "apns_tokens_venue_access" ON apns_tokens
  FOR ALL
  USING  (venue_id = current_venue_id())
  WITH CHECK (venue_id = current_venue_id());


-- staff_permissions ──────────────────────────────────────────────────────────
-- Kept as-is from migration 059b:
--   SELECT USING (true)  — needed for hasPermission() checks
--   No write policy for anon — all writes via save_staff_permissions SECURITY DEFINER
-- No change needed here.


-- ── Indexes on newly added venue_id columns ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_training_venue_id          ON staff_training (venue_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_venue_id             ON shift_swaps (venue_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_venue_id          ON supplier_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_venue_id    ON supplier_order_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_delivery_check_items_venue_id    ON delivery_check_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_tip_allocations_venue_id         ON tip_allocations (venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_venue_id  ON staff_role_assignments (venue_id);
