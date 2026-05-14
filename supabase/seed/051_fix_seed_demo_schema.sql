-- ============================================================================
-- 051: Fix seed_demo_data to match current venue_roles / staff_role_assignments
--      / rota_requirements schemas introduced in migration 031.
--
-- Changes:
--   venue_roles:           job_role → name, colour → color, drop is_active
--   staff_role_assignments: (staff_id, job_role, venue_id) → (staff_id, role_id)
--   rota_requirements:     job_role/positions_required → role_id/role_name/
--                          staff_count/start_time/end_time
-- ============================================================================

DROP FUNCTION IF EXISTS seed_demo_data(uuid);

CREATE OR REPLACE FUNCTION seed_demo_data(p_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v1  uuid; v2  uuid;
  s1  uuid; s2  uuid; s3  uuid; s4  uuid;
  s5  uuid; s6  uuid; s7  uuid; s8  uuid;
  -- venue role IDs (needed for staff_role_assignments FK)
  vr1_kitchen uuid; vr1_foh uuid; vr1_bar uuid;
  vr2_kitchen uuid; vr2_foh uuid; vr2_bar uuid;
  f1a uuid; f1b uuid; f1c uuid;
  f2a uuid; f2b uuid;
  sup1a uuid; sup1b uuid; sup1c uuid;
  sup2a uuid; sup2b uuid;
  ord1a uuid; ord1b uuid; ord2a uuid;
  ct1 uuid; ct2 uuid; ct3 uuid; ct4 uuid; ct5 uuid; ct6 uuid;
  ct7 uuid; ct8 uuid; ct9 uuid; ct10 uuid; ct11 uuid; ct12 uuid;
  oc1 uuid; oc2 uuid; oc3 uuid; oc4 uuid; oc5 uuid; oc6 uuid;
  oc7 uuid; oc8 uuid;
  tt1 uuid; tt2 uuid; tt3 uuid; tt4 uuid; tt5 uuid;
  tt6 uuid; tt7 uuid; tt8 uuid; tt9 uuid; tt10 uuid;
  ca1 uuid; ca2 uuid; ca3 uuid; ca4 uuid;
  fi1 uuid; fi2 uuid; fi3 uuid; fi4 uuid; fi5 uuid;
  fi6 uuid; fi7 uuid; fi8 uuid;
  hi1 uuid; hi2 uuid; hi3 uuid; hi4 uuid;
  si1 uuid; si2 uuid; si3 uuid; si4 uuid; si5 uuid; si6 uuid;
  t   date := current_date;
BEGIN

  -- ── 1. Clean up any previous demo data (correct dependency order) ────────
  -- Collect demo venue IDs into a temp variable set
  CREATE TEMP TABLE IF NOT EXISTS _demo_venue_ids AS
    SELECT id FROM venues WHERE owner_id = p_owner_id AND slug IN ('brew-and-bloom', 'the-corner-cup');

  -- Delete leaf tables (reference staff or venues, no children)
  DELETE FROM fridge_temperature_logs  WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM cleaning_completions     WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM opening_closing_completions WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM task_completions         WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM clock_events             WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM hot_holding_logs         WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM cooking_temp_logs        WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM cooling_logs             WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM waste_logs               WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM delivery_checks          WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM corrective_actions       WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM pest_control_logs        WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM staff_training           WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM training_sign_offs       WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM probe_calibrations       WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM shift_swaps              WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM time_off_requests        WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM hour_edit_log            WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM supplier_order_items     WHERE order_id IN (SELECT id FROM supplier_orders WHERE venue_id IN (SELECT id FROM _demo_venue_ids));
  DELETE FROM supplier_orders          WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM supplier_items           WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM food_allergens           WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM food_items               WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM hot_holding_items        WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM shifts                   WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM rota_requirements        WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM opening_closing_checks   WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM cleaning_tasks           WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM task_templates           WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM fridges                  WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM suppliers                WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM app_settings             WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM staff_role_assignments   WHERE staff_id IN (SELECT id FROM staff WHERE venue_id IN (SELECT id FROM _demo_venue_ids));
  DELETE FROM staff_venue_links        WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM venue_roles              WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM staff                    WHERE venue_id IN (SELECT id FROM _demo_venue_ids);
  DELETE FROM venues                   WHERE id       IN (SELECT id FROM _demo_venue_ids);

  DROP TABLE _demo_venue_ids;

  -- ── 2. Create venues ──────────────────────────────────────────────────────
  INSERT INTO venues (name, slug, owner_id, plan, additional_venues)
  VALUES ('Brew & Bloom Café', 'brew-and-bloom', p_owner_id, 'pro', 1)
  RETURNING id INTO v1;

  INSERT INTO venues (name, slug, owner_id, plan, additional_venues)
  VALUES ('The Corner Cup', 'the-corner-cup', p_owner_id, 'pro', 0)
  RETURNING id INTO v2;

  -- ── 3. App settings ───────────────────────────────────────────────────────
  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v1, 'venue_name',          '"Brew & Bloom Café"'),
    (v1, 'manager_email',       '"demo@pelikn.app"'),
    (v1, 'break_duration_mins', '30'),
    (v1, 'cleanup_minutes',     '15'),
    (v1, 'closed_days',         '[6]'),
    (v1, 'custom_roles',        '["Kitchen","Front of House","Bar"]'),
    (v2, 'venue_name',          '"The Corner Cup"'),
    (v2, 'manager_email',       '"demo@pelikn.app"'),
    (v2, 'break_duration_mins', '30'),
    (v2, 'cleanup_minutes',     '10'),
    (v2, 'closed_days',         '[6]'),
    (v2, 'custom_roles',        '["Kitchen","Front of House","Bar"]');

  -- ── 4. Venue roles (name + color — no job_role / is_active columns) ───────
  INSERT INTO venue_roles (venue_id, name, color, sort_order)
  VALUES (v1, 'Kitchen',       '#f59e0b', 1) RETURNING id INTO vr1_kitchen;
  INSERT INTO venue_roles (venue_id, name, color, sort_order)
  VALUES (v1, 'Front of House','#3b82f6', 2) RETURNING id INTO vr1_foh;
  INSERT INTO venue_roles (venue_id, name, color, sort_order)
  VALUES (v1, 'Bar',           '#10b981', 3) RETURNING id INTO vr1_bar;

  INSERT INTO venue_roles (venue_id, name, color, sort_order)
  VALUES (v2, 'Kitchen',       '#ef4444', 1) RETURNING id INTO vr2_kitchen;
  INSERT INTO venue_roles (venue_id, name, color, sort_order)
  VALUES (v2, 'Front of House','#8b5cf6', 2) RETURNING id INTO vr2_foh;
  INSERT INTO venue_roles (venue_id, name, color, sort_order)
  VALUES (v2, 'Bar',           '#06b6d4', 3) RETURNING id INTO vr2_bar;

  -- ── 5. Rota requirements (role_id FK + role_name + staff_count + times) ───
  INSERT INTO rota_requirements (venue_id, day_of_week, role_id, role_name, staff_count, start_time, end_time)
  SELECT v1, d, r.role_id, r.role_name, 2, TIME '08:00', TIME '16:00'
  FROM (VALUES (1),(2),(3),(4),(5),(6)) days(d)
  CROSS JOIN (VALUES (vr1_kitchen,'Kitchen'),(vr1_foh,'Front of House')) r(role_id, role_name);

  INSERT INTO rota_requirements (venue_id, day_of_week, role_id, role_name, staff_count, start_time, end_time)
  SELECT v2, d, r.role_id, r.role_name, 2, TIME '08:00', TIME '16:00'
  FROM (VALUES (1),(2),(3),(4),(5),(6)) days(d)
  CROSS JOIN (VALUES (vr2_kitchen,'Kitchen'),(vr2_foh,'Front of House')) r(role_id, role_name);

  -- ── 6. Staff ──────────────────────────────────────────────────────────────
  INSERT INTO staff (name, email, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Sarah Mitchell', 'sarah@brewandbloom.com', hash_staff_pin('1234'), 'owner',   'kitchen', true, v1, '#3b82f6', 40, 14.50)
  RETURNING id INTO s1;

  INSERT INTO staff (name, email, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('James O''Brien',  'james@brewandbloom.com', hash_staff_pin('1234'), 'manager', 'foh',     true, v1, '#10b981', 40, 13.50)
  RETURNING id INTO s2;

  INSERT INTO staff (name, email, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Emma Walsh',      'emma@thecornercup.com',  hash_staff_pin('1234'), 'manager', 'kitchen', true, v2, '#ef4444', 40, 13.50)
  RETURNING id INTO s3;

  INSERT INTO staff (name, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Tom Clarke',   hash_staff_pin('1234'), 'staff', 'kitchen', true, v1, '#f59e0b', 30, 11.44)
  RETURNING id INTO s4;

  INSERT INTO staff (name, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Lucy Brennan', hash_staff_pin('1234'), 'staff', 'foh',     true, v1, '#8b5cf6', 25, 11.44)
  RETURNING id INTO s5;

  INSERT INTO staff (name, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Ryan Murphy',  hash_staff_pin('1234'), 'staff', 'kitchen', true, v2, '#06b6d4', 32, 11.44)
  RETURNING id INTO s6;

  INSERT INTO staff (name, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Aoife Kelly',  hash_staff_pin('1234'), 'staff', 'foh',     true, v1, '#f97316', 20, 11.44)
  RETURNING id INTO s7;

  INSERT INTO staff (name, pin_hash, role, job_role, is_active, venue_id, colour, contracted_hours, hourly_rate)
  VALUES ('Conor Hayes',  hash_staff_pin('1234'), 'staff', 'kitchen', true, v2, '#84cc16', 30, 11.44)
  RETURNING id INTO s8;

  -- ── 7. Cross-venue links ──────────────────────────────────────────────────
  INSERT INTO staff_venue_links (staff_id, venue_id, role) VALUES
    (s1, v2, 'owner'),
    (s5, v2, 'staff'),
    (s8, v1, 'staff');

  -- ── 8. Staff role assignments (staff_id + role_id FK — no job_role column) ─
  INSERT INTO staff_role_assignments (staff_id, role_id) VALUES
    (s1, vr1_kitchen), (s1, vr1_foh),
    (s2, vr1_foh),     (s2, vr1_bar),
    (s3, vr2_kitchen), (s3, vr2_foh),
    (s4, vr1_kitchen),
    (s5, vr1_foh),
    (s6, vr2_kitchen),
    (s7, vr1_foh),
    (s8, vr2_kitchen);

  -- ── 9. Shifts (Mon–Sat, 3 weeks back + current + 2 weeks ahead) ──────────
  INSERT INTO shifts (venue_id, staff_id, shift_date, week_start, start_time, end_time, role_label)
  SELECT v1, sched.staff_id, d::date,
    date_trunc('week', d)::date,
    sched.s, sched.e, sched.lbl
  FROM generate_series(
    date_trunc('week', t::timestamp) - interval '21 days',
    date_trunc('week', t::timestamp) + interval '19 days',
    interval '1 day'
  ) d
  CROSS JOIN (VALUES
    (s1, TIME '08:00', TIME '16:00', 'Kitchen'),
    (s2, TIME '09:00', TIME '17:00', 'Front of House'),
    (s4, TIME '07:00', TIME '15:00', 'Kitchen'),
    (s5, TIME '10:00', TIME '16:00', 'Front of House'),
    (s7, TIME '12:00', TIME '20:00', 'Front of House')
  ) sched(staff_id, s, e, lbl)
  WHERE extract(dow from d) BETWEEN 1 AND 6;

  INSERT INTO shifts (venue_id, staff_id, shift_date, week_start, start_time, end_time, role_label)
  SELECT v2, sched.staff_id, d::date,
    date_trunc('week', d)::date,
    sched.s, sched.e, sched.lbl
  FROM generate_series(
    date_trunc('week', t::timestamp) - interval '21 days',
    date_trunc('week', t::timestamp) + interval '19 days',
    interval '1 day'
  ) d
  CROSS JOIN (VALUES
    (s3, TIME '07:30', TIME '15:30', 'Kitchen'),
    (s6, TIME '08:00', TIME '16:00', 'Kitchen'),
    (s8, TIME '09:00', TIME '17:00', 'Kitchen')
  ) sched(staff_id, s, e, lbl)
  WHERE extract(dow from d) BETWEEN 1 AND 6;

  -- ── 10. Clock events ──────────────────────────────────────────────────────
  INSERT INTO clock_events (venue_id, staff_id, event_type, occurred_at)
  SELECT v1, ce.staff_id, ce.event_type,
    (d::date + ce.offset_)::timestamptz
  FROM generate_series(
    date_trunc('week', t::timestamp) - interval '21 days',
    t::timestamp - interval '1 day',
    interval '1 day'
  ) d
  CROSS JOIN (VALUES
    (s1, 'clock_in',    INTERVAL  '8 hours'),
    (s1, 'break_start', INTERVAL '12 hours'),
    (s1, 'break_end',   INTERVAL '12 hours 32 minutes'),
    (s1, 'clock_out',   INTERVAL '16 hours'),
    (s2, 'clock_in',    INTERVAL  '9 hours 7 minutes'),
    (s2, 'break_start', INTERVAL '13 hours'),
    (s2, 'break_end',   INTERVAL '13 hours 28 minutes'),
    (s2, 'clock_out',   INTERVAL '17 hours'),
    (s4, 'clock_in',    INTERVAL  '7 hours'),
    (s4, 'break_start', INTERVAL '11 hours'),
    (s4, 'break_end',   INTERVAL '11 hours 30 minutes'),
    (s4, 'clock_out',   INTERVAL '15 hours'),
    (s5, 'clock_in',    INTERVAL '10 hours'),
    (s5, 'break_start', INTERVAL '13 hours'),
    (s5, 'break_end',   INTERVAL '13 hours 20 minutes'),
    (s5, 'clock_out',   INTERVAL '16 hours'),
    (s7, 'clock_in',    INTERVAL '12 hours'),
    (s7, 'break_start', INTERVAL '15 hours'),
    (s7, 'break_end',   INTERVAL '15 hours 25 minutes'),
    (s7, 'clock_out',   INTERVAL '20 hours')
  ) ce(staff_id, event_type, offset_)
  WHERE extract(dow from d) BETWEEN 1 AND 6;

  INSERT INTO clock_events (venue_id, staff_id, event_type, occurred_at)
  SELECT v2, ce.staff_id, ce.event_type,
    (d::date + ce.offset_)::timestamptz
  FROM generate_series(
    date_trunc('week', t::timestamp) - interval '21 days',
    t::timestamp - interval '1 day',
    interval '1 day'
  ) d
  CROSS JOIN (VALUES
    (s3, 'clock_in',    INTERVAL  '7 hours 30 minutes'),
    (s3, 'break_start', INTERVAL '11 hours 30 minutes'),
    (s3, 'break_end',   INTERVAL '12 hours 2 minutes'),
    (s3, 'clock_out',   INTERVAL '15 hours 30 minutes'),
    (s6, 'clock_in',    INTERVAL  '8 hours'),
    (s6, 'break_start', INTERVAL '12 hours'),
    (s6, 'break_end',   INTERVAL '12 hours 35 minutes'),
    (s6, 'clock_out',   INTERVAL '16 hours'),
    (s8, 'clock_in',    INTERVAL  '9 hours 10 minutes'),
    (s8, 'break_start', INTERVAL '13 hours'),
    (s8, 'break_end',   INTERVAL '13 hours 30 minutes'),
    (s8, 'clock_out',   INTERVAL '17 hours')
  ) ce(staff_id, event_type, offset_)
  WHERE extract(dow from d) BETWEEN 1 AND 6;

  -- ── 11. Fridges ───────────────────────────────────────────────────────────
  INSERT INTO fridges (venue_id, name, min_temp, max_temp, is_active)
  VALUES (v1, 'Main Display Fridge', 1.0, 5.0, true) RETURNING id INTO f1a;
  INSERT INTO fridges (venue_id, name, min_temp, max_temp, is_active)
  VALUES (v1, 'Prep Fridge', 0.0, 5.0, true) RETURNING id INTO f1b;
  INSERT INTO fridges (venue_id, name, min_temp, max_temp, is_active)
  VALUES (v1, 'Bar Fridge', 0.0, 8.0, true) RETURNING id INTO f1c;
  INSERT INTO fridges (venue_id, name, min_temp, max_temp, is_active)
  VALUES (v2, 'Kitchen Fridge', 0.0, 5.0, true) RETURNING id INTO f2a;
  INSERT INTO fridges (venue_id, name, min_temp, max_temp, is_active)
  VALUES (v2, 'Display Fridge', 1.0, 5.0, true) RETURNING id INTO f2b;

  INSERT INTO fridge_temperature_logs (venue_id, fridge_id, fridge_name, temperature, check_period, logged_by, logged_by_name, logged_at)
  SELECT fr.vid, fr.fid, fr.fname,
    fr.base + ((row_number() OVER () % 5) * 0.3)::numeric(3,1),
    p.period,
    fr.lby, fr.lbname,
    (t - (day_offset || ' days')::interval + p.offset_)::timestamptz
  FROM (VALUES
    (v1, f1a, 'Main Display Fridge', 3.2, s1, 'Sarah Mitchell'),
    (v1, f1b, 'Prep Fridge',          2.1, s4, 'Tom Clarke'),
    (v1, f1c, 'Bar Fridge',           5.5, s2, 'James O''Brien'),
    (v2, f2a, 'Kitchen Fridge',       2.4, s3, 'Emma Walsh'),
    (v2, f2b, 'Display Fridge',       3.0, s6, 'Ryan Murphy')
  ) fr(vid, fid, fname, base, lby, lbname)
  CROSS JOIN generate_series(1, 7) day_offset
  CROSS JOIN (VALUES ('am', INTERVAL '8 hours'), ('pm', INTERVAL '15 hours')) p(period, offset_);

  INSERT INTO fridge_temperature_logs (venue_id, fridge_id, fridge_name, temperature, check_period, logged_by, logged_by_name, logged_at)
  VALUES (v1, f1b, 'Prep Fridge', 6.8, 'am', s4, 'Tom Clarke', (t - interval '2 days' + interval '8 hours')::timestamptz);

  -- ── 12. Cleaning tasks ────────────────────────────────────────────────────
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v1, 'Clean coffee machine', 'daily',    'all', true, s1) RETURNING id INTO ct1;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v1, 'Wipe down surfaces',   'daily',    'foh', true, s1) RETURNING id INTO ct2;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v1, 'Clean oven & hob',     'weekly',   'kitchen', true, s1) RETURNING id INTO ct3;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v1, 'Deep clean fridges',   'monthly',  'kitchen', true, s1) RETURNING id INTO ct4;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v1, 'Clean floor drains',   'weekly',   'kitchen', true, s1) RETURNING id INTO ct5;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v1, 'Sanitise prep boards', 'daily',    'kitchen', true, s1) RETURNING id INTO ct6;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v2, 'Clean espresso machine','daily',   'all', true, s3) RETURNING id INTO ct7;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v2, 'Wipe counters & glass', 'daily',   'foh', true, s3) RETURNING id INTO ct8;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v2, 'Clean grinder hopper',  'weekly',  'kitchen', true, s3) RETURNING id INTO ct9;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v2, 'Descale milk steamer',  'weekly',  'foh', true, s3) RETURNING id INTO ct10;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v2, 'Mop kitchen floor',     'daily',   'kitchen', true, s3) RETURNING id INTO ct11;
  INSERT INTO cleaning_tasks (venue_id, title, frequency, assigned_role, is_active, created_by)
  VALUES (v2, 'Deep clean fridges',    'monthly', 'kitchen', true, s3) RETURNING id INTO ct12;

  INSERT INTO cleaning_completions (venue_id, cleaning_task_id, completed_by_staff_id, completed_by_name, completed_at)
  SELECT v1, task_id, comp_by, comp_name,
    (t - (day_offset || ' days')::interval + interval '17 hours')::timestamptz
  FROM (VALUES
    (ct1, s2, 'James O''Brien'),
    (ct2, s2, 'James O''Brien'),
    (ct6, s4, 'Tom Clarke')
  ) tasks(task_id, comp_by, comp_name)
  CROSS JOIN generate_series(1, 6) day_offset;

  INSERT INTO cleaning_completions (venue_id, cleaning_task_id, completed_by_staff_id, completed_by_name, completed_at)
  VALUES
    (v1, ct3, s4, 'Tom Clarke', (date_trunc('week', t::timestamp) + interval '17 hours')::timestamptz),
    (v1, ct5, s4, 'Tom Clarke', (date_trunc('week', t::timestamp) + interval '17 hours')::timestamptz);

  INSERT INTO cleaning_completions (venue_id, cleaning_task_id, completed_by_staff_id, completed_by_name, completed_at)
  SELECT v2, task_id, comp_by, comp_name,
    (t - (day_offset || ' days')::interval + interval '17 hours')::timestamptz
  FROM (VALUES
    (ct7,  s3, 'Emma Walsh'),
    (ct8,  s6, 'Ryan Murphy'),
    (ct11, s6, 'Ryan Murphy')
  ) tasks(task_id, comp_by, comp_name)
  CROSS JOIN generate_series(1, 6) day_offset;

  INSERT INTO cleaning_completions (venue_id, cleaning_task_id, completed_by_staff_id, completed_by_name, completed_at)
  VALUES
    (v2, ct9,  s8, 'Conor Hayes', (date_trunc('week', t::timestamp) + interval '17 hours')::timestamptz),
    (v2, ct10, s3, 'Emma Walsh',  (date_trunc('week', t::timestamp) + interval '17 hours')::timestamptz);

  -- ── 13. Opening/closing checks ────────────────────────────────────────────
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Check fridge temperatures',    'opening', 1, true) RETURNING id INTO oc1;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Check all equipment on',       'opening', 2, true) RETURNING id INTO oc2;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Unlock doors & set float',     'opening', 3, true) RETURNING id INTO oc3;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Staff allergen briefing done', 'opening', 4, true) RETURNING id INTO oc4;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Cash & card terminal balanced','closing',  1, true) RETURNING id INTO oc5;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'All food covered & labelled',  'closing',  2, true) RETURNING id INTO oc6;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Ovens & appliances off',       'closing',  3, true) RETURNING id INTO oc7;
  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active)
  VALUES (v1, 'Doors locked, alarm set',      'closing',  4, true) RETURNING id INTO oc8;

  INSERT INTO opening_closing_completions (venue_id, check_id, session_date, session_type, staff_id, staff_name, completed_at)
  SELECT v1, chk.check_id, (t - (day_offset || ' days')::interval)::date,
    chk.stype, chk.comp_by, chk.comp_name,
    (t - (day_offset || ' days')::interval + chk.offset_)::timestamptz
  FROM (VALUES
    (oc1, 'opening', s1, 'Sarah Mitchell', INTERVAL '8 hours 5 minutes'),
    (oc2, 'opening', s1, 'Sarah Mitchell', INTERVAL '8 hours 6 minutes'),
    (oc3, 'opening', s2, 'James O''Brien', INTERVAL '8 hours 55 minutes'),
    (oc4, 'opening', s2, 'James O''Brien', INTERVAL '8 hours 57 minutes'),
    (oc5, 'closing', s2, 'James O''Brien', INTERVAL '17 hours 5 minutes'),
    (oc6, 'closing', s4, 'Tom Clarke',     INTERVAL '15 hours 2 minutes'),
    (oc7, 'closing', s4, 'Tom Clarke',     INTERVAL '15 hours 3 minutes'),
    (oc8, 'closing', s2, 'James O''Brien', INTERVAL '17 hours 10 minutes')
  ) chk(check_id, stype, comp_by, comp_name, offset_)
  CROSS JOIN generate_series(1, 6) day_offset;

  INSERT INTO opening_closing_checks (venue_id, title, type, sort_order, is_active) VALUES
    (v2, 'Check fridge temperatures',    'opening', 1, true),
    (v2, 'Prep station sanitised',       'opening', 2, true),
    (v2, 'Allergen board updated',       'opening', 3, true),
    (v2, 'Coffee machine warmed up',     'opening', 4, true),
    (v2, 'End-of-day waste log done',    'closing',  1, true),
    (v2, 'All food stored & labelled',   'closing',  2, true),
    (v2, 'Equipment off & cleaned',      'closing',  3, true),
    (v2, 'Doors locked & secured',       'closing',  4, true);

  -- ── 14. Task templates ────────────────────────────────────────────────────
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v1, 'Stock rotation check',      'kitchen', true, s1) RETURNING id INTO tt1;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v1, 'Date label all prep items', 'kitchen', true, s1) RETURNING id INTO tt2;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v1, 'Sweep & mop dining area',   'foh',     true, s1) RETURNING id INTO tt3;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v1, 'Restock condiments',        'foh',     true, s1) RETURNING id INTO tt4;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v1, 'Check use-by dates',        'all',     true, s1) RETURNING id INTO tt5;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v2, 'Stock milk & syrups',       'foh',     true, s3) RETURNING id INTO tt6;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v2, 'Date label all prep',       'kitchen', true, s3) RETURNING id INTO tt7;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v2, 'Sweep café floor',          'foh',     true, s3) RETURNING id INTO tt8;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v2, 'Descale group heads',       'kitchen', true, s3) RETURNING id INTO tt9;
  INSERT INTO task_templates (venue_id, title, job_role, is_active, created_by)
  VALUES (v2, 'Check use-by dates',        'all',     true, s3) RETURNING id INTO tt10;

  INSERT INTO task_completions (venue_id, task_template_id, completion_date, completed_by_staff_id, completed_by_name, completed_at)
  SELECT v1, task_id, (t - (day_offset || ' days')::interval)::date,
    comp_by, comp_name,
    (t - (day_offset || ' days')::interval + interval '14 hours')::timestamptz
  FROM (VALUES
    (tt1, s4, 'Tom Clarke'),
    (tt2, s4, 'Tom Clarke'),
    (tt3, s5, 'Lucy Brennan'),
    (tt4, s5, 'Lucy Brennan'),
    (tt5, s1, 'Sarah Mitchell')
  ) tasks(task_id, comp_by, comp_name)
  CROSS JOIN generate_series(1, 6) day_offset;

  INSERT INTO task_completions (venue_id, task_template_id, completion_date, completed_by_staff_id, completed_by_name, completed_at)
  SELECT v2, task_id, (t - (day_offset || ' days')::interval)::date,
    comp_by, comp_name,
    (t - (day_offset || ' days')::interval + interval '14 hours')::timestamptz
  FROM (VALUES
    (tt6,  s6, 'Ryan Murphy'),
    (tt7,  s8, 'Conor Hayes'),
    (tt8,  s6, 'Ryan Murphy'),
    (tt9,  s8, 'Conor Hayes'),
    (tt10, s3, 'Emma Walsh')
  ) tasks(task_id, comp_by, comp_name)
  CROSS JOIN generate_series(1, 6) day_offset;

  -- ── 15. Suppliers ─────────────────────────────────────────────────────────
  INSERT INTO suppliers (venue_id, name, is_active) VALUES (v1, 'Fresh Direct UK',      true) RETURNING id INTO sup1a;
  INSERT INTO suppliers (venue_id, name, is_active) VALUES (v1, 'Brewer''s Collective', true) RETURNING id INTO sup1b;
  INSERT INTO suppliers (venue_id, name, is_active) VALUES (v1, 'Metro Wholesale',      true) RETURNING id INTO sup1c;
  INSERT INTO suppliers (venue_id, name, is_active) VALUES (v2, 'Grumpy Mule Coffee',   true) RETURNING id INTO sup2a;
  INSERT INTO suppliers (venue_id, name, is_active) VALUES (v2, 'Meadow Fresh Dairy',   true) RETURNING id INTO sup2b;

  INSERT INTO supplier_items (venue_id, supplier_id, name, category, temp_required, min_temp, max_temp, is_active) VALUES
    (v1, sup1a, 'Mixed Salad Leaves',  'chilled',  true, 1.0, 5.0, true),
    (v1, sup1a, 'Smoked Salmon',       'chilled',  true, 0.0, 4.0, true),
    (v1, sup1a, 'Free Range Eggs',     'chilled',  true, 0.0, 5.0, true),
    (v1, sup1b, 'Whole Milk 6L',       'chilled',  true, 0.0, 5.0, true),
    (v1, sup1b, 'Double Cream',        'chilled',  true, 0.0, 5.0, true),
    (v1, sup1c, 'Plain Flour 16kg',    'ambient',  false, null, null, true),
    (v1, sup1c, 'Caster Sugar 10kg',   'ambient',  false, null, null, true),
    (v2, sup2a, 'Espresso Blend 5kg',  'ambient',  false, null, null, true),
    (v2, sup2a, 'Decaf Blend 2kg',     'ambient',  false, null, null, true),
    (v2, sup2b, 'Whole Milk 10L',      'chilled',  true, 0.0, 5.0, true),
    (v2, sup2b, 'Oat Milk 6L',         'ambient',  false, null, null, true),
    (v2, sup2b, 'Soy Milk 6L',         'ambient',  false, null, null, true);

  INSERT INTO supplier_orders (venue_id, supplier_id, supplier_name, status, raised_by, raised_by_name, ordered_at, received_at)
  VALUES (v1, sup1a, 'Fresh Direct UK', 'received', s1, 'Sarah Mitchell',
    (t - interval '5 days')::timestamptz, (t - interval '4 days')::timestamptz)
  RETURNING id INTO ord1a;

  INSERT INTO supplier_orders (venue_id, supplier_id, supplier_name, status, raised_by, raised_by_name, ordered_at)
  VALUES (v1, sup1c, 'Metro Wholesale', 'ordered', s2, 'James O''Brien',
    (t - interval '1 day')::timestamptz)
  RETURNING id INTO ord1b;

  INSERT INTO supplier_orders (venue_id, supplier_id, supplier_name, status, raised_by, raised_by_name, ordered_at, received_at)
  VALUES (v2, sup2a, 'Grumpy Mule Coffee', 'received', s3, 'Emma Walsh',
    (t - interval '3 days')::timestamptz, (t - interval '2 days')::timestamptz)
  RETURNING id INTO ord2a;

  INSERT INTO delivery_checks (venue_id, supplier_id, supplier_name, items_desc, temp_reading, temp_pass, packaging_ok, use_by_ok, overall_pass, checked_by, checked_at)
  VALUES
    (v1, sup1a, 'Fresh Direct UK',    'Salad, salmon, eggs', 3.2, true,  true, true, true,  s1, (t - interval '4 days' + interval '9 hours')::timestamptz),
    (v1, sup1b, 'Brewer''s Collective','Milk, cream',         4.8, true,  true, true, true,  s2, (t - interval '2 days' + interval '8 hours')::timestamptz),
    (v2, sup2a, 'Grumpy Mule Coffee', 'Espresso blend',      null, null,  true, true, true,  s3, (t - interval '2 days' + interval '10 hours')::timestamptz),
    (v2, sup2b, 'Meadow Fresh Dairy', 'Whole milk, oat milk', 5.1, false, true, true, false, s3, (t - interval '1 day'  + interval '8 hours')::timestamptz);

  -- ── 16. Food items + allergens ────────────────────────────────────────────
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v1, 'Classic Eggs Benedict',  'Poached eggs, hollandaise, sourdough',  true) RETURNING id INTO fi1;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v1, 'Smoked Salmon Bagel',    'Cream cheese, capers, red onion',        true) RETURNING id INTO fi2;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v1, 'Avocado Toast',          'Sourdough, smashed avocado, chilli',     true) RETURNING id INTO fi3;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v1, 'Granola Bowl',           'Oats, honey, fresh berries, yoghurt',    true) RETURNING id INTO fi4;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v2, 'Cortado',                'Double espresso, steamed milk',          true) RETURNING id INTO fi5;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v2, 'Banana Bread Slice',     'Homemade, walnuts, honey drizzle',       true) RETURNING id INTO fi6;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v2, 'Toasted Focaccia',       'Rosemary, olive oil, sea salt',          true) RETURNING id INTO fi7;
  INSERT INTO food_items (venue_id, name, description, is_active) VALUES
    (v2, 'Matcha Latte',           'Ceremonial matcha, oat milk',            true) RETURNING id INTO fi8;

  INSERT INTO food_allergens (venue_id, food_item_id, allergen) VALUES
    (v1, fi1, 'Eggs'), (v1, fi1, 'Gluten'), (v1, fi1, 'Milk'), (v1, fi1, 'Mustard'),
    (v1, fi2, 'Fish'), (v1, fi2, 'Gluten'), (v1, fi2, 'Milk'),
    (v1, fi3, 'Gluten'),
    (v1, fi4, 'Gluten'), (v1, fi4, 'Milk'), (v1, fi4, 'Tree Nuts'),
    (v2, fi5, 'Milk'),
    (v2, fi6, 'Gluten'), (v2, fi6, 'Tree Nuts'), (v2, fi6, 'Eggs'), (v2, fi6, 'Milk'),
    (v2, fi7, 'Gluten'),
    (v2, fi8, 'Milk');

  -- ── 17. Hot holding ───────────────────────────────────────────────────────
  INSERT INTO hot_holding_items (venue_id, name, is_active) VALUES (v1, 'Soup of the Day',    true) RETURNING id INTO hi1;
  INSERT INTO hot_holding_items (venue_id, name, is_active) VALUES (v1, 'Breakfast Burritos', true) RETURNING id INTO hi2;
  INSERT INTO hot_holding_items (venue_id, name, is_active) VALUES (v2, 'Toasted Sandwiches', true) RETURNING id INTO hi3;
  INSERT INTO hot_holding_items (venue_id, name, is_active) VALUES (v2, 'Quiche Slices',      true) RETURNING id INTO hi4;

  INSERT INTO hot_holding_logs (venue_id, item_id, item_name, temperature, check_period, logged_by, logged_by_name, logged_at)
  SELECT item.vid, item.iid, item.iname,
    65.0 + (day_offset % 4),
    period, item.lby, item.lbname,
    (t - (day_offset || ' days')::interval + CASE period WHEN 'am' THEN INTERVAL '9 hours' ELSE INTERVAL '14 hours' END)::timestamptz
  FROM (VALUES
    (v1, hi1, 'Soup of the Day',    s1, 'Sarah Mitchell'),
    (v1, hi2, 'Breakfast Burritos', s4, 'Tom Clarke'),
    (v2, hi3, 'Toasted Sandwiches', s3, 'Emma Walsh'),
    (v2, hi4, 'Quiche Slices',      s6, 'Ryan Murphy')
  ) item(vid, iid, iname, lby, lbname)
  CROSS JOIN generate_series(1, 3) day_offset
  CROSS JOIN (VALUES ('am'), ('pm')) periods(period);

  -- ── 18. Cooking temp logs ─────────────────────────────────────────────────
  INSERT INTO cooking_temp_logs (venue_id, check_type, food_item, temperature, target_temp, logged_by, logged_by_name, logged_at)
  VALUES
    (v1, 'cooking',   'Eggs Benedict — hollandaise', 74.0, 70.0, s4, 'Tom Clarke',   (t - interval '1 day' + interval '8 hours')::timestamptz),
    (v1, 'cooking',   'Soup of the Day',             83.0, 75.0, s4, 'Tom Clarke',   (t - interval '1 day' + interval '11 hours')::timestamptz),
    (v1, 'reheating', 'Breakfast Burritos',          71.0, 70.0, s4, 'Tom Clarke',   (t - interval '2 days' + interval '8 hours')::timestamptz),
    (v2, 'cooking',   'Quiche (fresh batch)',         78.0, 75.0, s8, 'Conor Hayes', (t - interval '1 day' + interval '9 hours')::timestamptz),
    (v2, 'cooking',   'Focaccia bake',                90.0, 85.0, s8, 'Conor Hayes', (t - interval '2 days' + interval '9 hours')::timestamptz),
    (v2, 'reheating', 'Toasted Sandwich filling',    72.0, 70.0, s3, 'Emma Walsh',  (t - interval '1 day' + interval '12 hours')::timestamptz);

  -- ── 19. Cooling logs ──────────────────────────────────────────────────────
  INSERT INTO cooling_logs (venue_id, food_item, start_temp, end_temp, target_temp, cooling_method, started_at, logged_by, logged_by_name, logged_at)
  VALUES
    (v1, 'Soup — leftover batch',    78.0, 4.0, 5.0, 'ice_bath',   (t - interval '2 days' + interval '15 hours')::timestamptz, s4, 'Tom Clarke',     (t - interval '2 days' + interval '17 hours')::timestamptz),
    (v2, 'Quiche — overnight batch', 75.0, 3.0, 5.0, 'ambient',    (t - interval '1 day'  + interval '16 hours')::timestamptz, s8, 'Conor Hayes',    (t - interval '1 day'  + interval '18 hours')::timestamptz),
    (v1, 'Hollandaise — end of day', 60.0, 4.0, 5.0, 'cold_water', (t - interval '3 days' + interval '14 hours')::timestamptz, s1, 'Sarah Mitchell', (t - interval '3 days' + interval '16 hours')::timestamptz);

  -- ── 20. Waste logs ────────────────────────────────────────────────────────
  INSERT INTO waste_logs (venue_id, item_name, quantity, unit, reason, recorded_by, recorded_by_name, recorded_at)
  SELECT vid, iname, qty, unit_, reason_, rby, rbname,
    (t - (day_offset || ' days')::interval + interval '16 hours')::timestamptz
  FROM (VALUES
    (v1, 'Mixed salad leaves', 0.3, 'kg',     'expired',        s2, 'James O''Brien'),
    (v1, 'Croissants',         3,   'items',  'overproduction', s2, 'James O''Brien'),
    (v1, 'Hollandaise sauce',  0.2, 'litres', 'spoiled',        s4, 'Tom Clarke'),
    (v2, 'Banana bread slice', 2,   'items',  'overproduction', s3, 'Emma Walsh'),
    (v2, 'Whole milk',         0.5, 'litres', 'expired',        s6, 'Ryan Murphy')
  ) wl(vid, iname, qty, unit_, reason_, rby, rbname)
  CROSS JOIN generate_series(1, 7) day_offset;

  -- ── 21. Corrective actions ────────────────────────────────────────────────
  INSERT INTO corrective_actions (venue_id, category, title, description, action_taken, severity, status, reported_by, reported_at)
  VALUES
    (v1, 'temperature', 'Prep Fridge temperature exceeded 5°C',
     'Prep fridge recorded 6.8°C on morning check. All chilled stock quarantined.',
     'Fridge thermostat adjusted. Engineer booked for service.',
     'critical', 'open', s4, (t - interval '2 days')::timestamptz),
    (v1, 'cleaning', 'Monthly fridge deep clean overdue',
     'Deep clean not completed within the 30-day schedule.',
     'Scheduled for this Saturday.',
     'major', 'open', s1, (t - interval '1 day')::timestamptz),
    (v2, 'delivery', 'Chilled delivery arrived at 5.1°C',
     'Milk delivery from Meadow Fresh Dairy arrived above 5°C. Batch rejected.',
     'Supplier contacted. Replacement arranged.',
     'major', 'resolved', s3, (t - interval '1 day')::timestamptz),
    (v1, 'pest', 'Mouse droppings found near dry store',
     'Single sighting near flour bins.',
     'Pest contractor attended same day. Traps placed.',
     'critical', 'resolved', s1, (t - interval '8 days')::timestamptz);

  UPDATE corrective_actions SET status = 'resolved', resolved_by = s3,
    resolved_at = (t - interval '12 hours')::timestamptz
  WHERE title = 'Chilled delivery arrived at 5.1°C' AND venue_id = v2;

  UPDATE corrective_actions SET status = 'resolved', resolved_by = s1,
    resolved_at = (t - interval '6 days')::timestamptz
  WHERE title = 'Mouse droppings found near dry store' AND venue_id = v1;

  -- ── 22. Pest control ──────────────────────────────────────────────────────
  INSERT INTO pest_control_logs (venue_id, log_type, pest_type, location, description, action_taken, severity, status, logged_by, logged_by_name, logged_at)
  VALUES
    (v1, 'inspection', 'rodent', 'Kitchen & dry store',
     'Scheduled quarterly inspection. No live activity. Traps effective.',
     'Traps replaced, entry points re-sealed.', 'low', 'resolved',
     s1, 'Sarah Mitchell', (t - interval '14 days')::timestamptz),
    (v1, 'sighting',   'rodent', 'Dry store — near flour bins',
     'Mouse droppings found during stock rotation. ~6 droppings.',
     'Emergency contractor called. Deep clean completed.', 'high', 'resolved',
     s4, 'Tom Clarke',      (t - interval '8 days')::timestamptz),
    (v2, 'inspection', 'fly',    'General kitchen area',
     'Seasonal inspection — minor fruit fly presence near waste bins.',
     'Bins relocated. UV trap installed.', 'low', 'resolved',
     s3, 'Emma Walsh',      (t - interval '10 days')::timestamptz);

  -- ── 23. Staff training ────────────────────────────────────────────────────
  INSERT INTO staff_training (venue_id, staff_id, title, issued_date, expiry_date, notes) VALUES
    (v1, s1, 'Level 3 Award in Food Safety',  (t - interval '2 years')::date,   (t + interval '1 year')::date,    'Highfield qualification'),
    (v1, s1, 'COSHH Awareness',                (t - interval '1 year')::date,    (t + interval '20 days')::date,   'Due for renewal'),
    (v1, s2, 'Level 2 Award in Food Safety',  (t - interval '18 months')::date, (t + interval '6 months')::date,  null),
    (v1, s2, 'Emergency First Aid at Work',    (t - interval '3 years')::date,   (t - interval '5 days')::date,    'Expired — renewal needed'),
    (v2, s3, 'Level 3 Award in Food Safety',  (t - interval '1 year')::date,    (t + interval '2 years')::date,   null),
    (v2, s3, 'Allergen Awareness Level 2',     (t - interval '6 months')::date,  (t + interval '18 months')::date, null),
    (v1, s4, 'Level 2 Award in Food Safety',  (t - interval '1 year')::date,    (t + interval '2 years')::date,   null),
    (v1, s5, 'Level 2 Award in Food Safety',  (t - interval '2 years')::date,   (t + interval '8 months')::date,  null),
    (v1, s5, 'Allergen Awareness',             (t - interval '1 year')::date,    (t + interval '25 days')::date,   'Booked for refresh'),
    (v2, s6, 'Level 2 Award in Food Safety',  (t - interval '8 months')::date,  (t + interval '16 months')::date, null),
    (v1, s7, 'Level 2 Award in Food Safety',  (t - interval '6 months')::date,  (t + interval '18 months')::date, null),
    (v1, s7, 'Allergen Awareness Level 2',     (t - interval '3 months')::date,  (t + interval '21 months')::date, null),
    (v2, s8, 'Level 2 Award in Food Safety',  (t - interval '1 year')::date,    (t + interval '2 years')::date,   null);

  INSERT INTO training_sign_offs (venue_id, staff_id, training_date, trainer_name, topics, notes, manager_name, staff_acknowledged, staff_acknowledged_at)
  VALUES
    (v1, s4, (t - interval '30 days')::date, 'Sarah Mitchell',
     ARRAY['Food safety basics','Cross-contamination','Temperature control'],
     'Induction training.', 'Sarah Mitchell', true, (t - interval '29 days')::timestamptz),
    (v2, s8, (t - interval '14 days')::date, 'Emma Walsh',
     ARRAY['Allergen awareness','COSHH','Personal hygiene'],
     'Monthly training session.', 'Emma Walsh', true, (t - interval '13 days')::timestamptz);

  -- ── 24. Probe calibrations ────────────────────────────────────────────────
  INSERT INTO probe_calibrations (venue_id, probe_name, method, expected_temp, actual_reading, calibrated_by, calibrated_at, notes)
  VALUES
    (v1, 'Probe A (kitchen)', 'ice_water', 0.0, 0.3, s1, (t - interval '10 days')::timestamptz, 'Within tolerance. OK.'),
    (v2, 'Probe A (kitchen)', 'ice_water', 0.0, 0.5, s3, (t - interval '35 days')::timestamptz, 'Calibration overdue — schedule check');

  -- ── 25. Shift swaps ───────────────────────────────────────────────────────
  INSERT INTO shift_swaps (venue_id, shift_id, requester_id, requester_name, target_staff_id, target_staff_name, status, message)
  SELECT v1,
    (SELECT id FROM shifts WHERE venue_id = v1 AND staff_id = s5 AND shift_date = (t + interval '3 days')::date LIMIT 1),
    s5, 'Lucy Brennan', s7, 'Aoife Kelly', 'pending',
    'I have a family commitment — can you cover?';

  INSERT INTO shift_swaps (venue_id, shift_id, requester_id, requester_name, target_staff_id, target_staff_name, status, message)
  SELECT v2,
    (SELECT id FROM shifts WHERE venue_id = v2 AND staff_id = s8 AND shift_date = (t + interval '5 days')::date LIMIT 1),
    s8, 'Conor Hayes', s6, 'Ryan Murphy', 'pending',
    'Could we swap? I have a hospital appointment.';

  -- ── 26. Time-off requests ─────────────────────────────────────────────────
  INSERT INTO time_off_requests (venue_id, staff_id, start_date, end_date, reason, status)
  VALUES
    (v1, s4, (t + interval '14 days')::date, (t + interval '16 days')::date,
     'Family holiday — booked months ago', 'pending'),
    (v1, s7, (t + interval '7 days')::date, (t + interval '7 days')::date,
     'Attending a wedding', 'approved');

  -- ── 27. Hour edit log ─────────────────────────────────────────────────────
  INSERT INTO hour_edit_log (venue_id, staff_id, staff_name, shift_date)
  VALUES (v1, s2, 'James O''Brien', (t - interval '3 days')::date);

END;
$$;
