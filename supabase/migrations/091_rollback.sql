-- ============================================================================
-- 091 ROLLBACK — revert venue-scoped RLS back to open access
--
-- Run this in Supabase Dashboard → SQL Editor if migration 091 causes issues.
-- Restores all tables to USING (true) / WITH CHECK (true).
-- Data is NEVER affected — only access policies change.
-- ============================================================================

DROP FUNCTION IF EXISTS current_venue_id();

-- Core tables
DROP POLICY IF EXISTS "shifts_venue_access"            ON shifts;
CREATE POLICY "shifts_venue_access" ON shifts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "settings_venue_access"          ON app_settings;
CREATE POLICY "settings_venue_access" ON app_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_templates_venue_access"    ON task_templates;
CREATE POLICY "task_templates_venue_access" ON task_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_one_offs_venue_access"     ON task_one_offs;
CREATE POLICY "task_one_offs_venue_access" ON task_one_offs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_completions_venue_access"  ON task_completions;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_completions') THEN
    EXECUTE $p$ CREATE POLICY "task_completions_venue_access" ON task_completions FOR ALL USING (true) WITH CHECK (true) $p$;
  END IF;
END $$;

DROP POLICY IF EXISTS "cleaning_tasks_venue_access"    ON cleaning_tasks;
CREATE POLICY "cleaning_tasks_all_write" ON cleaning_tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cleaning_completions_venue_access" ON cleaning_completions;
CREATE POLICY "cleaning_completions_all_write" ON cleaning_completions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fridges_venue_access"           ON fridges;
CREATE POLICY "fridges_all_write" ON fridges FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fridge_logs_venue_access"       ON fridge_temperature_logs;
CREATE POLICY "fridge_logs_all_write" ON fridge_temperature_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "food_items_venue_access"        ON food_items;
CREATE POLICY "food_items_all_write" ON food_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "food_allergens_venue_access"    ON food_allergens;
CREATE POLICY "food_allergens_all_write" ON food_allergens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "waste_logs_venue_access"        ON waste_logs;
CREATE POLICY "waste_logs_all" ON waste_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_checks_venue_access"   ON delivery_checks;
CREATE POLICY "delivery_checks_all" ON delivery_checks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_check_items_venue_access" ON delivery_check_items;
CREATE POLICY "delivery_check_items_write" ON delivery_check_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "suppliers_venue_access"         ON suppliers;
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_items_venue_access"    ON supplier_items;
CREATE POLICY "supplier_items_write" ON supplier_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_orders_venue_access"   ON supplier_orders;
CREATE POLICY "supplier_orders_all" ON supplier_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_order_items_venue_access" ON supplier_order_items;
CREATE POLICY "open" ON supplier_order_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "oc_checks_venue_access"         ON opening_closing_checks;
CREATE POLICY "oc_checks_write" ON opening_closing_checks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "oc_completions_venue_access"    ON opening_closing_completions;
CREATE POLICY "oc_completions_all" ON opening_closing_completions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cooking_logs_venue_access"      ON cooking_temp_logs;
CREATE POLICY "cooking_logs_all" ON cooking_temp_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cooling_logs_venue_access"      ON cooling_logs;
CREATE POLICY "cooling_logs_all" ON cooling_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pest_control_venue_access"      ON pest_control_logs;
CREATE POLICY "pest_control_all" ON pest_control_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "probe_calibrations_venue_access" ON probe_calibrations;
CREATE POLICY "probe_calibrations_all" ON probe_calibrations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "hot_holding_items_venue_access" ON hot_holding_items;
CREATE POLICY "hot_holding_items_all" ON hot_holding_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "hot_holding_logs_venue_access"  ON hot_holding_logs;
CREATE POLICY "hot_holding_logs_all" ON hot_holding_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "corrective_actions_venue_access" ON corrective_actions;
CREATE POLICY "corrective_actions_all" ON corrective_actions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rota_requirements_venue_access" ON rota_requirements;
CREATE POLICY "rota_requirements_all" ON rota_requirements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "clock_events_venue_access"      ON clock_events;
CREATE POLICY "clock_events_all_write" ON clock_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "push_subscriptions_venue_access" ON push_subscriptions;
CREATE POLICY "push_subscriptions_all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "time_off_venue_access"          ON time_off_requests;
CREATE POLICY "time_off_all" ON time_off_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_availability_venue_access" ON staff_availability;
CREATE POLICY "Public read staff_availability"   ON staff_availability FOR SELECT USING (true);
CREATE POLICY "Public write staff_availability"  ON staff_availability FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff_availability" ON staff_availability FOR UPDATE USING (true);
CREATE POLICY "Public delete staff_availability" ON staff_availability FOR DELETE USING (true);

DROP POLICY IF EXISTS "fitness_venue_access"           ON fitness_declarations;
CREATE POLICY "fitness_all" ON fitness_declarations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dashboard_widgets_venue_access" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_all" ON dashboard_widgets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "venue_roles_venue_access"       ON venue_roles;
CREATE POLICY "venue_roles_all" ON venue_roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_venue_links_venue_access" ON staff_venue_links;
CREATE POLICY "staff_venue_links_all" ON staff_venue_links FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tip_splits_venue_access"        ON tip_splits;
CREATE POLICY "tip_splits_all" ON tip_splits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tip_allocations_venue_access"   ON tip_allocations;
CREATE POLICY "tip_allocations_all" ON tip_allocations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "documents_venue_access"         ON documents;
CREATE POLICY "documents_read"  ON documents FOR SELECT USING (true);
CREATE POLICY "documents_write" ON documents FOR ALL    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_venue_access"         ON incidents;
CREATE POLICY "incidents_read"  ON incidents FOR SELECT USING (true);
CREATE POLICY "incidents_write" ON incidents FOR ALL    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "hr_formal_actions_venue_access"           ON hr_formal_actions;
CREATE POLICY "hr_formal_actions_all" ON hr_formal_actions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "equipment_maintenance_venue_access"       ON equipment_maintenance_logs;
CREATE POLICY "equipment_maintenance_open" ON equipment_maintenance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "date_labelling_venue_access"    ON date_labelling_logs;
CREATE POLICY "date_labelling_open" ON date_labelling_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "duty_templates_venue_access"    ON duty_templates;
CREATE POLICY "duty_templates_write" ON duty_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "duty_template_items_venue_access" ON duty_template_items;
CREATE POLICY "duty_template_items_write" ON duty_template_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "duty_assignments_venue_access"  ON duty_assignments;
CREATE POLICY "duty_assignments_write" ON duty_assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "duty_item_completions_venue_access" ON duty_item_completions;
CREATE POLICY "duty_item_completions_read" ON duty_item_completions FOR SELECT USING (true);

DROP POLICY IF EXISTS "allergen_procedures_venue_access" ON allergen_procedures;
CREATE POLICY "allergen_procedures_all" ON allergen_procedures FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "illness_policies_venue_access"  ON illness_exclusion_policies;
CREATE POLICY "illness_policies_all" ON illness_exclusion_policies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_notification_preferences_venue_access" ON staff_notification_preferences;
CREATE POLICY "staff_notification_preferences_all" ON staff_notification_preferences FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "food_complaints_venue_access"   ON food_complaints;
CREATE POLICY "food_complaints_all" ON food_complaints FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "hour_edit_log_venue_access"     ON hour_edit_log;
CREATE POLICY "hour_edit_log_select" ON hour_edit_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff_hr_documents_venue_access" ON staff_hr_documents;
CREATE POLICY "staff_hr_documents_all" ON staff_hr_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "leave_entitlements_venue_access" ON leave_entitlements;
CREATE POLICY "leave_entitlements_all" ON leave_entitlements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_dashboard_today_items_venue_access" ON staff_dashboard_today_items;
CREATE POLICY "staff_dashboard_today_items_all" ON staff_dashboard_today_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_training_venue_access"    ON staff_training;
CREATE POLICY "training_select" ON staff_training FOR SELECT USING (true);
CREATE POLICY "training_insert" ON staff_training FOR INSERT WITH CHECK (true);
CREATE POLICY "training_update" ON staff_training FOR UPDATE USING (true);
CREATE POLICY "training_delete" ON staff_training FOR DELETE USING (true);

DROP POLICY IF EXISTS "shift_swaps_venue_access"       ON shift_swaps;
CREATE POLICY "shift_swaps_all" ON shift_swaps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_role_assignments_venue_access" ON staff_role_assignments;
CREATE POLICY "staff_role_assignments_all" ON staff_role_assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "apns_tokens_venue_access"       ON apns_tokens;
CREATE POLICY "staff can manage own apns tokens" ON apns_tokens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_write"  ON staff;
DROP POLICY IF EXISTS "staff_select" ON staff;
CREATE POLICY "staff_all_write" ON staff FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "noticeboard_venue_access" ON noticeboard_posts;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noticeboard_posts') THEN
    EXECUTE $p$ CREATE POLICY "noticeboard_insert" ON noticeboard_posts FOR INSERT WITH CHECK (true) $p$;
    EXECUTE $p$ CREATE POLICY "noticeboard_update" ON noticeboard_posts FOR UPDATE USING (true)      $p$;
  END IF;
END $$;
