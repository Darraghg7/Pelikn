-- ============================================================
-- Migration 003 — Unified PIN-based auth
-- ============================================================

-- 1. Configurable tabs per staff member
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS show_temp_logs BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_allergens BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop old function signatures so we can recreate with new params
DROP FUNCTION IF EXISTS create_staff_member(uuid, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS update_staff_member(uuid, uuid, text, text, text, numeric, text);
DROP FUNCTION IF EXISTS deactivate_staff_member(uuid, uuid);
DROP FUNCTION IF EXISTS reactivate_staff_member(uuid, uuid);
DROP FUNCTION IF EXISTS resolve_swap_request(uuid, text, text);

-- 3. create_staff_member
CREATE FUNCTION create_staff_member(
  p_session_token UUID,
  p_name          TEXT,
  p_job_role      TEXT,
  p_pin           TEXT,
  p_email         TEXT    DEFAULT NULL,
  p_hourly_rate   NUMERIC DEFAULT 0
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
      AND s.role = 'manager'
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO staff (name, email, pin_hash, role, job_role, hourly_rate, is_active)
  VALUES (p_name, p_email, crypt(p_pin, gen_salt('bf')), 'staff', p_job_role, p_hourly_rate, true)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

-- 4. update_staff_member
CREATE FUNCTION update_staff_member(
  p_session_token  UUID,
  p_staff_id       UUID,
  p_name           TEXT,
  p_job_role       TEXT,
  p_email          TEXT    DEFAULT NULL,
  p_hourly_rate    NUMERIC DEFAULT NULL,
  p_new_pin        TEXT    DEFAULT NULL,
  p_show_temp_logs BOOLEAN DEFAULT NULL,
  p_show_allergens BOOLEAN DEFAULT NULL
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
      AND s.role = 'manager'
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff SET
    name           = p_name,
    email          = COALESCE(p_email,          email),
    job_role       = p_job_role,
    hourly_rate    = COALESCE(p_hourly_rate,    hourly_rate),
    pin_hash       = CASE WHEN p_new_pin IS NOT NULL
                      THEN crypt(p_new_pin, gen_salt('bf'))
                      ELSE pin_hash END,
    show_temp_logs = COALESCE(p_show_temp_logs, show_temp_logs),
    show_allergens = COALESCE(p_show_allergens, show_allergens)
  WHERE id = p_staff_id;
END;
$$;

-- 5. deactivate_staff_member
CREATE FUNCTION deactivate_staff_member(
  p_session_token UUID,
  p_staff_id      UUID
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token = p_session_token
      AND ss.expires_at > now()
      AND s.role = 'manager'
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE staff SET is_active = false WHERE id = p_staff_id;
END;
$$;

-- 6. reactivate_staff_member
CREATE FUNCTION reactivate_staff_member(
  p_session_token UUID,
  p_staff_id      UUID
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token = p_session_token
      AND ss.expires_at > now()
      AND s.role = 'manager'
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE staff SET is_active = true WHERE id = p_staff_id;
END;
$$;

-- 7. resolve_swap_request
CREATE FUNCTION resolve_swap_request(
  p_session_token UUID,
  p_swap_id       UUID,
  p_action        TEXT,
  p_manager_note  TEXT DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE v_shift_id UUID; v_target_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token = p_session_token
      AND ss.expires_at > now()
      AND s.role = 'manager'
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_action = 'approved' THEN
    SELECT shift_id, target_staff_id INTO v_shift_id, v_target_id
    FROM shift_swaps WHERE id = p_swap_id;
    UPDATE shifts SET staff_id = v_target_id WHERE id = v_shift_id;
  END IF;

  UPDATE shift_swaps SET
    status       = p_action,
    manager_note = p_manager_note,
    resolved_at  = now()
  WHERE id = p_swap_id;
END;
$$;
