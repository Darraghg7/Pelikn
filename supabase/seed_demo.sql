-- ============================================================================
-- Pelikn Demo Seed Data
-- ============================================================================
-- Run this on a FRESH Supabase instance to create a demo environment.
-- DO NOT run on a production database — it will conflict with existing data.
--
-- Usage: Paste into the Supabase SQL Editor and run.
--
-- Demo Logins:
--   Emma Richardson (Owner)   — PIN: 1111
--   James Wilson   (Manager)  — PIN: 2222
--   Sophie Chen    (Staff)    — PIN: 3333
--   Liam O'Brien   (Staff)    — PIN: 4444
--   Priya Patel    (Staff)    — PIN: 5555
--   Oliver Thomas  (Staff)    — PIN: 6666
-- ============================================================================

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── App Settings ─────────────────────────────────────────────────────────────
INSERT INTO app_settings (key, value) VALUES
  ('venue_name', 'The Corner Cafe')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO app_settings (key, value) VALUES
  ('manager_email', 'demo@pelikn.app')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO app_settings (key, value) VALUES
  ('custom_roles', '[{"value":"chef","label":"Chef","color":"bg-orange-100 text-orange-800"},{"value":"sous_chef","label":"Sous Chef","color":"bg-amber-100 text-amber-800"},{"value":"kitchen_porter","label":"Kitchen Porter","color":"bg-yellow-100 text-yellow-800"},{"value":"foh","label":"Front of House","color":"bg-blue-100 text-blue-800"},{"value":"barista","label":"Barista","color":"bg-teal-100 text-teal-800"},{"value":"supervisor","label":"Supervisor","color":"bg-indigo-100 text-indigo-800"}]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO app_settings (key, value) VALUES
  ('closed_days', '[]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── Staff ────────────────────────────────────────────────────────────────────
INSERT INTO staff (id, name, email, pin_hash, role, job_role, hourly_rate, is_active, show_temp_logs, show_allergens) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'Emma Richardson', 'emma@cornercafe.co.uk', crypt('1111', gen_salt('bf', 8)), 'owner',   'manager',  0,     true, true, true),
  ('d0000001-0000-0000-0000-000000000002', 'James Wilson',    'james@cornercafe.co.uk', crypt('2222', gen_salt('bf', 8)), 'manager', 'manager',  14.50, true, true, true),
  ('d0000001-0000-0000-0000-000000000003', 'Sophie Chen',     NULL, crypt('3333', gen_salt('bf', 8)), 'staff', 'kitchen', 12.00, true, true,  true),
  ('d0000001-0000-0000-0000-000000000004', 'Liam O''Brien',   NULL, crypt('4444', gen_salt('bf', 8)), 'staff', 'kitchen', 11.50, true, true,  false),
  ('d0000001-0000-0000-0000-000000000005', 'Priya Patel',     NULL, crypt('5555', gen_salt('bf', 8)), 'staff', 'foh',     11.00, true, false, true),
  ('d0000001-0000-0000-0000-000000000006', 'Oliver Thomas',   NULL, crypt('6666', gen_salt('bf', 8)), 'staff', 'foh',     11.00, true, false, true)
ON CONFLICT (id) DO NOTHING;

-- ── Fridges ──────────────────────────────────────────────────────────────────
INSERT INTO fridges (id, name, min_temp, max_temp, is_active) VALUES
  ('f0000001-0000-0000-0000-000000000001', 'Walk-in Fridge',  0, 5,   true),
  ('f0000001-0000-0000-0000-000000000002', 'Display Fridge',  0, 5,   true),
  ('f0000001-0000-0000-0000-000000000003', 'Prep Fridge',     0, 5,   true),
  ('f0000001-0000-0000-0000-000000000004', 'Chest Freezer',  -22, -18, true)
ON CONFLICT (id) DO NOTHING;

-- ── Fridge Temperature Logs (7 days, AM + PM) ───────────────────────────────
-- Generate logs for the past 7 days with realistic temperatures
DO $$
DECLARE
  d DATE;
  fridge RECORD;
  staff_ids UUID[] := ARRAY[
    'd0000001-0000-0000-0000-000000000003'::UUID,
    'd0000001-0000-0000-0000-000000000004'::UUID,
    'd0000001-0000-0000-0000-000000000005'::UUID
  ];
  staff_names TEXT[] := ARRAY['Sophie Chen', 'Liam O''Brien', 'Priya Patel'];
  temp_val NUMERIC;
  idx INT;
BEGIN
  FOR d IN SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::INTERVAL)::DATE
  LOOP
    FOR fridge IN SELECT * FROM fridges WHERE is_active = true
    LOOP
      -- AM check
      idx := (EXTRACT(DOY FROM d)::INT + fridge.id::TEXT::INT % 3) % 3 + 1;
      IF fridge.min_temp < 0 THEN
        temp_val := -18 + (random() * 4 - 2)::NUMERIC(4,1);
      ELSE
        temp_val := 1 + (random() * 4)::NUMERIC(4,1);
      END IF;
      INSERT INTO fridge_temperature_logs (fridge_id, fridge_name, temperature, logged_by, logged_by_name, logged_at, check_period)
      VALUES (
        fridge.id, fridge.name,
        ROUND(temp_val, 1),
        staff_ids[idx], staff_names[idx],
        d + '08:30:00'::TIME + (random() * 60 || ' minutes')::INTERVAL,
        'am'
      );
      -- PM check
      idx := (EXTRACT(DOY FROM d)::INT + fridge.id::TEXT::INT % 3 + 1) % 3 + 1;
      IF fridge.min_temp < 0 THEN
        temp_val := -18 + (random() * 4 - 2)::NUMERIC(4,1);
      ELSE
        temp_val := 1 + (random() * 4)::NUMERIC(4,1);
      END IF;
      INSERT INTO fridge_temperature_logs (fridge_id, fridge_name, temperature, logged_by, logged_by_name, logged_at, check_period)
      VALUES (
        fridge.id, fridge.name,
        ROUND(temp_val, 1),
        staff_ids[idx], staff_names[idx],
        d + '14:00:00'::TIME + (random() * 60 || ' minutes')::INTERVAL,
        'pm'
      );
    END LOOP;
  END LOOP;

  -- Add one out-of-range reading 3 days ago
  INSERT INTO fridge_temperature_logs (fridge_id, fridge_name, temperature, logged_by, logged_by_name, notes, logged_at, check_period)
  VALUES (
    'f0000001-0000-0000-0000-000000000001', 'Walk-in Fridge', 8.2,
    'd0000001-0000-0000-0000-000000000003', 'Sophie Chen',
    'Door was propped open during delivery. Closed and will re-check in 30 mins.',
    CURRENT_DATE - 3 + '09:15:00'::TIME, 'am'
  );
END $$;

-- ── Cleaning Tasks ───────────────────────────────────────────────────────────
INSERT INTO cleaning_tasks (id, title, frequency, assigned_role, is_active) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Wipe down prep surfaces',       'daily',       'all', true),
  ('c0000001-0000-0000-0000-000000000002', 'Clean coffee machine',          'daily',       'foh', true),
  ('c0000001-0000-0000-0000-000000000003', 'Mop kitchen floor',             'daily',       'kitchen', true),
  ('c0000001-0000-0000-0000-000000000004', 'Empty all bins',                'daily',       'all', true),
  ('c0000001-0000-0000-0000-000000000005', 'Deep clean fryers',             'weekly',      'kitchen', true),
  ('c0000001-0000-0000-0000-000000000006', 'Clean walk-in fridge shelves',  'weekly',      'kitchen', true),
  ('c0000001-0000-0000-0000-000000000007', 'Descale dishwasher',            'monthly',     'kitchen', true),
  ('c0000001-0000-0000-0000-000000000008', 'Clean extraction hood filters', 'quarterly',   'kitchen', true)
ON CONFLICT (id) DO NOTHING;

-- Completions: most daily tasks done recently, a couple overdue
INSERT INTO cleaning_completions (cleaning_task_id, completed_by, completed_by_name, completed_at) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000003', 'Sophie Chen', NOW() - INTERVAL '4 hours'),
  ('c0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000005', 'Priya Patel', NOW() - INTERVAL '5 hours'),
  ('c0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000006', 'Oliver Thomas', NOW() - INTERVAL '3 hours'),
  -- Mop kitchen floor: last done 2 days ago (overdue for daily)
  ('c0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000004', 'Liam O''Brien', NOW() - INTERVAL '2 days'),
  -- Deep clean fryers: done 5 days ago (ok for weekly)
  ('c0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000004', 'Liam O''Brien', NOW() - INTERVAL '5 days'),
  -- Fridge shelves: done 10 days ago (overdue for weekly)
  ('c0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000003', 'Sophie Chen', NOW() - INTERVAL '10 days'),
  -- Descale dishwasher: done 20 days ago (ok for monthly)
  ('c0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000004', 'Liam O''Brien', NOW() - INTERVAL '20 days');
  -- Extraction hood filters: never done (will be overdue)

-- ── Food Items with Allergens ────────────────────────────────────────────────
INSERT INTO food_items (id, name, description, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Full English Breakfast',     'Eggs, bacon, sausage, beans, toast, tomato, mushrooms', true),
  ('a0000001-0000-0000-0000-000000000002', 'Smoked Salmon Bagel',       'Cream cheese, capers, red onion on a sesame bagel',     true),
  ('a0000001-0000-0000-0000-000000000003', 'Victoria Sponge',           'Classic sponge with jam and buttercream',                true),
  ('a0000001-0000-0000-0000-000000000004', 'Caesar Salad',              'Romaine, croutons, parmesan, anchovy dressing',          true),
  ('a0000001-0000-0000-0000-000000000005', 'Fish Finger Sandwich',      'Breaded cod fingers in a brioche bun with tartare sauce', true),
  ('a0000001-0000-0000-0000-000000000006', 'Mushroom Risotto',          'Arborio rice, mixed mushrooms, parmesan, truffle oil',   true),
  ('a0000001-0000-0000-0000-000000000007', 'Prawn & Avocado Wrap',      'Tiger prawns, avocado, sweet chilli sauce, flour tortilla', true),
  ('a0000001-0000-0000-0000-000000000008', 'Chocolate Brownie',         'Rich dark chocolate brownie with walnuts',               true),
  ('a0000001-0000-0000-0000-000000000009', 'Tomato & Basil Soup',       'Roasted tomato soup with fresh basil (vegan)',            true),
  ('a0000001-0000-0000-0000-000000000010', 'Chicken Club Sandwich',     'Grilled chicken, bacon, lettuce, tomato, mayo on sourdough', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO food_allergens (food_item_id, allergen) VALUES
  -- Full English
  ('a0000001-0000-0000-0000-000000000001', 'gluten'),
  ('a0000001-0000-0000-0000-000000000001', 'eggs'),
  ('a0000001-0000-0000-0000-000000000001', 'milk'),
  -- Smoked Salmon Bagel
  ('a0000001-0000-0000-0000-000000000002', 'gluten'),
  ('a0000001-0000-0000-0000-000000000002', 'fish'),
  ('a0000001-0000-0000-0000-000000000002', 'milk'),
  ('a0000001-0000-0000-0000-000000000002', 'sesame'),
  -- Victoria Sponge
  ('a0000001-0000-0000-0000-000000000003', 'gluten'),
  ('a0000001-0000-0000-0000-000000000003', 'eggs'),
  ('a0000001-0000-0000-0000-000000000003', 'milk'),
  -- Caesar Salad
  ('a0000001-0000-0000-0000-000000000004', 'gluten'),
  ('a0000001-0000-0000-0000-000000000004', 'eggs'),
  ('a0000001-0000-0000-0000-000000000004', 'milk'),
  ('a0000001-0000-0000-0000-000000000004', 'fish'),
  -- Fish Finger Sandwich
  ('a0000001-0000-0000-0000-000000000005', 'gluten'),
  ('a0000001-0000-0000-0000-000000000005', 'fish'),
  ('a0000001-0000-0000-0000-000000000005', 'eggs'),
  ('a0000001-0000-0000-0000-000000000005', 'milk'),
  -- Mushroom Risotto
  ('a0000001-0000-0000-0000-000000000006', 'milk'),
  ('a0000001-0000-0000-0000-000000000006', 'celery'),
  -- Prawn & Avocado Wrap
  ('a0000001-0000-0000-0000-000000000007', 'gluten'),
  ('a0000001-0000-0000-0000-000000000007', 'crustaceans'),
  -- Chocolate Brownie
  ('a0000001-0000-0000-0000-000000000008', 'gluten'),
  ('a0000001-0000-0000-0000-000000000008', 'eggs'),
  ('a0000001-0000-0000-0000-000000000008', 'milk'),
  ('a0000001-0000-0000-0000-000000000008', 'nuts'),
  -- Tomato & Basil Soup (vegan — celery only)
  ('a0000001-0000-0000-0000-000000000009', 'celery'),
  -- Chicken Club
  ('a0000001-0000-0000-0000-000000000010', 'gluten'),
  ('a0000001-0000-0000-0000-000000000010', 'eggs'),
  ('a0000001-0000-0000-0000-000000000010', 'milk')
ON CONFLICT DO NOTHING;

-- ── Opening / Closing Checks ─────────────────────────────────────────────────
INSERT INTO opening_closing_checks (id, title, type, sort_order, is_active) VALUES
  ('oc000001-0000-0000-0000-000000000001', 'Turn on ovens and grills',              'opening', 0, true),
  ('oc000001-0000-0000-0000-000000000002', 'Check fridge temperatures (AM)',        'opening', 1, true),
  ('oc000001-0000-0000-0000-000000000003', 'Set up coffee machine and grinder',     'opening', 2, true),
  ('oc000001-0000-0000-0000-000000000004', 'Check and prep mise en place',          'opening', 3, true),
  ('oc000001-0000-0000-0000-000000000005', 'Turn off all ovens and grills',         'closing', 0, true),
  ('oc000001-0000-0000-0000-000000000006', 'Check fridge temperatures (PM)',        'closing', 1, true),
  ('oc000001-0000-0000-0000-000000000007', 'Empty and clean coffee machine',        'closing', 2, true),
  ('oc000001-0000-0000-0000-000000000008', 'Wipe down all surfaces and lock up',    'closing', 3, true)
ON CONFLICT (id) DO NOTHING;

-- ── Shifts for current week ──────────────────────────────────────────────────
DO $$
DECLARE
  d DATE;
  dow INT;
BEGIN
  -- Monday through Saturday of this week
  FOR d IN SELECT generate_series(
    date_trunc('week', CURRENT_DATE)::DATE,
    date_trunc('week', CURRENT_DATE)::DATE + 5,
    '1 day'::INTERVAL
  )::DATE
  LOOP
    dow := EXTRACT(ISODOW FROM d)::INT; -- 1=Mon, 7=Sun

    -- Emma (owner): Mon-Fri mornings
    IF dow <= 5 THEN
      INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role_label)
      VALUES ('d0000001-0000-0000-0000-000000000001', d, '06:00', '14:00', 'Manager');
    END IF;

    -- James (manager): Tue-Sat
    IF dow >= 2 AND dow <= 6 THEN
      INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role_label)
      VALUES ('d0000001-0000-0000-0000-000000000002', d, '08:00', '16:00', 'Manager');
    END IF;

    -- Sophie (kitchen): Mon-Fri
    IF dow <= 5 THEN
      INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role_label)
      VALUES ('d0000001-0000-0000-0000-000000000003', d, '07:00', '15:00', 'Chef');
    END IF;

    -- Liam (kitchen): Tue-Sat
    IF dow >= 2 AND dow <= 6 THEN
      INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role_label)
      VALUES ('d0000001-0000-0000-0000-000000000004', d, '08:00', '16:00', 'Kitchen Porter');
    END IF;

    -- Priya (foh): Mon, Wed, Fri, Sat
    IF dow IN (1, 3, 5, 6) THEN
      INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role_label)
      VALUES ('d0000001-0000-0000-0000-000000000005', d, '07:00', '15:30', 'Front of House');
    END IF;

    -- Oliver (foh): Tue, Thu, Sat
    IF dow IN (2, 4, 6) THEN
      INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role_label)
      VALUES ('d0000001-0000-0000-0000-000000000006', d, '09:00', '17:00', 'Barista');
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Done! Log in as Emma (Owner, PIN 1111) or James (Manager, PIN 2222) to
-- explore the full manager experience, or as any staff member for the staff view.
-- ============================================================================
