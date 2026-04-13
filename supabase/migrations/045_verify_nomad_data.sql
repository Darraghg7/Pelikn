-- Verify Nomad Café data integrity and update manager_email
-- Venue ID: 00000000-0000-0000-0000-000000000001

DO $$
DECLARE
  v_id uuid := '00000000-0000-0000-0000-000000000001';
  v_name text;
  v_email text;
  n_staff int;
  n_shifts int;
  n_clock int;
  n_fridges int;
  n_fridge_logs int;
  n_cleaning int;
  n_checks int;
  n_tasks int;
  n_suppliers int;
  n_food int;
  n_training int;
  n_corrective int;
BEGIN
  SELECT name INTO v_name FROM venues WHERE id = v_id;
  SELECT value INTO v_email FROM app_settings WHERE venue_id = v_id AND key = 'manager_email';
  SELECT COUNT(*) INTO n_staff      FROM staff            WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_shifts     FROM shifts           WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_clock      FROM clock_events     WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_fridges    FROM fridges          WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_fridge_logs FROM fridge_temperature_logs WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_cleaning   FROM cleaning_tasks   WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_checks     FROM opening_closing_checks WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_tasks      FROM task_templates   WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_suppliers  FROM suppliers        WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_food       FROM food_items       WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_training   FROM staff_training   WHERE venue_id = v_id;
  SELECT COUNT(*) INTO n_corrective FROM corrective_actions WHERE venue_id = v_id;

  RAISE NOTICE '=== Nomad Café Data Verification ===';
  RAISE NOTICE 'Venue:          %', v_name;
  RAISE NOTICE 'Manager email:  %', v_email;
  RAISE NOTICE 'Staff:          %', n_staff;
  RAISE NOTICE 'Shifts:         %', n_shifts;
  RAISE NOTICE 'Clock events:   %', n_clock;
  RAISE NOTICE 'Fridges:        %', n_fridges;
  RAISE NOTICE 'Fridge logs:    %', n_fridge_logs;
  RAISE NOTICE 'Cleaning tasks: %', n_cleaning;
  RAISE NOTICE 'Opening checks: %', n_checks;
  RAISE NOTICE 'Task templates: %', n_tasks;
  RAISE NOTICE 'Suppliers:      %', n_suppliers;
  RAISE NOTICE 'Food items:     %', n_food;
  RAISE NOTICE 'Training certs: %', n_training;
  RAISE NOTICE 'Corrective:     %', n_corrective;
  RAISE NOTICE '=====================================';

  -- Update manager_email to darraghguy1@gmail.com (confirm it is correct)
  UPDATE app_settings
  SET value = '"darraghguy1@gmail.com"'
  WHERE venue_id = v_id AND key = 'manager_email';

  RAISE NOTICE 'manager_email confirmed as darraghguy1@gmail.com';
END;
$$;
