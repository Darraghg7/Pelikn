-- ============================================================
-- Migration 015 — Staff skills + break cover availability type
-- ============================================================

-- 1. Add skills array to staff (e.g. ['barista', 'till'])
ALTER TABLE staff ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';

-- 2. Add availability_type to staff_availability
--    'unavailable' = not working (default, preserves existing rows)
--    'break_cover' = available for short break-cover shifts only
ALTER TABLE staff_availability
  ADD COLUMN IF NOT EXISTS availability_type text NOT NULL DEFAULT 'unavailable';

ALTER TABLE staff_availability
  DROP CONSTRAINT IF EXISTS staff_avail_type_check;

ALTER TABLE staff_availability
  ADD CONSTRAINT staff_avail_type_check
  CHECK (availability_type IN ('unavailable', 'break_cover'));

-- 3. Recreate create_staff_member with skills parameter
DROP FUNCTION IF EXISTS create_staff_member(uuid, text, text, text, text, text, numeric);

CREATE FUNCTION create_staff_member(
  p_session_token UUID,
  p_name          TEXT,
  p_job_role      TEXT,
  p_pin           TEXT,
  p_role          TEXT     DEFAULT 'staff',
  p_email         TEXT     DEFAULT NULL,
  p_hourly_rate   NUMERIC  DEFAULT 0,
  p_skills        text[]   DEFAULT '{}'
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, extensions
AS $$
DECLARE v_new_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token = p_session_token
      AND ss.expires_at > now()
      AND s.role IN ('manager', 'owner')
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_role NOT IN ('staff', 'manager', 'owner') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO staff (name, email, pin_hash, role, job_role, hourly_rate, skills, is_active)
  VALUES (p_name, p_email, crypt(p_pin, gen_salt('bf')), p_role, p_job_role, p_hourly_rate, p_skills, true)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

-- 4. Recreate update_staff_member with skills parameter
DROP FUNCTION IF EXISTS update_staff_member(uuid, uuid, text, text, text, text, numeric, text, boolean, boolean);

CREATE FUNCTION update_staff_member(
  p_session_token  UUID,
  p_staff_id       UUID,
  p_name           TEXT,
  p_job_role       TEXT,
  p_role           TEXT     DEFAULT NULL,
  p_email          TEXT     DEFAULT NULL,
  p_hourly_rate    NUMERIC  DEFAULT NULL,
  p_new_pin        TEXT     DEFAULT NULL,
  p_show_temp_logs BOOLEAN  DEFAULT NULL,
  p_show_allergens BOOLEAN  DEFAULT NULL,
  p_skills         text[]   DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token = p_session_token
      AND ss.expires_at > now()
      AND s.role IN ('manager', 'owner')
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff SET
    name           = p_name,
    job_role       = p_job_role,
    role           = COALESCE(p_role,           role),
    email          = COALESCE(p_email,          email),
    hourly_rate    = COALESCE(p_hourly_rate,    hourly_rate),
    pin_hash       = CASE WHEN p_new_pin IS NOT NULL
                      THEN crypt(p_new_pin, gen_salt('bf'))
                      ELSE pin_hash END,
    show_temp_logs = COALESCE(p_show_temp_logs, show_temp_logs),
    show_allergens = COALESCE(p_show_allergens, show_allergens),
    skills         = COALESCE(p_skills,         skills)
  WHERE id = p_staff_id;
END;
$$;
