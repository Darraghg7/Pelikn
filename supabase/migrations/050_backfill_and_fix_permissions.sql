-- 050: Backfill missing staff permissions and fix create_staff_member.
--
-- Migration 048 introduced the staff_permissions table but the seed logic had
-- two gaps that left most staff unable to do anything:
--   1. The default-grant set required is_active = true and only inserted
--      'log_temps' / 'manage_cleaning' / 'manage_tasks' / 'manage_opening' —
--      it did NOT include 'view_temp_logs', which AppShell.jsx requires to
--      show the Temp Logs sidebar item.
--   2. create_staff_member (last redefined in 049) inserts a staff row but
--      never seeds any permissions, so any staff created via the manager
--      Settings UI after 048 ran has zero permissions and is locked out.
--
-- This migration backfills permissions for every existing staff and patches
-- create_staff_member so future inserts seed the same defaults.

-- 1) Backfill: ensure every staff-role member has the daily-essentials set.
INSERT INTO staff_permissions (staff_id, venue_id, permission)
SELECT s.id, s.venue_id, p.permission
FROM staff s
CROSS JOIN (VALUES
  ('log_temps'),
  ('view_temp_logs'),
  ('manage_cleaning'),
  ('manage_tasks'),
  ('manage_opening')
) AS p(permission)
WHERE s.role = 'staff'
ON CONFLICT (staff_id, venue_id, permission) DO NOTHING;

-- 2) Patch create_staff_member to seed default permissions for new staff.
DROP FUNCTION IF EXISTS create_staff_member(uuid, text, text, text, text, text, numeric, text[], text);

CREATE OR REPLACE FUNCTION create_staff_member(
  p_session_token uuid,
  p_name          text,
  p_job_role      text,
  p_pin           text,
  p_role          text     DEFAULT 'staff',
  p_email         text     DEFAULT NULL,
  p_hourly_rate   numeric  DEFAULT 0,
  p_skills        text[]   DEFAULT '{}',
  p_colour        text     DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_new_id   uuid;
  v_venue_id uuid;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_role NOT IN ('staff', 'manager', 'owner') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO staff (name, email, pin_hash, role, job_role, hourly_rate, skills, colour, is_active, venue_id)
  VALUES (p_name, p_email, crypt(p_pin, gen_salt('bf')), p_role, p_job_role, p_hourly_rate, p_skills, NULLIF(p_colour, ''), true, v_venue_id)
  RETURNING id INTO v_new_id;

  -- Seed default permissions so staff can do their daily work immediately.
  -- Managers/owners short-circuit to all permissions in hasPermission(), so
  -- only 'staff' needs the explicit grants.
  IF p_role = 'staff' THEN
    INSERT INTO staff_permissions (staff_id, venue_id, permission)
    SELECT v_new_id, v_venue_id, perm
    FROM (VALUES
      ('log_temps'),
      ('view_temp_logs'),
      ('manage_cleaning'),
      ('manage_tasks'),
      ('manage_opening')
    ) AS p(perm)
    ON CONFLICT (staff_id, venue_id, permission) DO NOTHING;
  END IF;

  RETURN v_new_id;
END;
$$;
