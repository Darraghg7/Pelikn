-- Rollback for 161_security_hardening.sql.
-- Puts back the pre-161 behaviour, including the holes 161 closed. Only use
-- this if 161 breaks sign-in or staff management.

-- 1. PIN verification as in 057 (failure count is rolled back by the RAISE).
CREATE OR REPLACE FUNCTION verify_staff_pin_and_create_session(
  p_staff_id uuid,
  p_pin      text,
  p_venue_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin_hash     text;
  v_is_active    boolean;
  v_locked_until timestamptz;
  v_token        uuid;
BEGIN
  SELECT pin_hash, is_active, pin_locked_until
    INTO v_pin_hash, v_is_active, v_locked_until
    FROM staff
   WHERE id = p_staff_id AND venue_id = p_venue_id;

  IF v_pin_hash IS NULL THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Account inactive';
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RAISE EXCEPTION 'Too many failed attempts — try again after %',
      to_char(v_locked_until AT TIME ZONE 'UTC', 'HH24:MI UTC');
  END IF;

  IF v_pin_hash <> crypt(p_pin, v_pin_hash) THEN
    UPDATE staff
       SET pin_failed_attempts = pin_failed_attempts + 1,
           pin_locked_until    = CASE
                                   WHEN pin_failed_attempts + 1 >= 5
                                   THEN now() + interval '15 minutes'
                                   ELSE NULL
                                 END
     WHERE id = p_staff_id;
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;

  UPDATE staff
     SET pin_failed_attempts = 0,
         pin_locked_until    = NULL
   WHERE id = p_staff_id;

  DELETE FROM staff_sessions
   WHERE staff_id = p_staff_id AND expires_at < now();

  INSERT INTO staff_sessions (staff_id, venue_id, expires_at)
  VALUES (p_staff_id, p_venue_id, now() + interval '30 days')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- 2. Owner protection off; reset_staff_pin_lock as in 059.
DROP TRIGGER IF EXISTS protect_owner_rows ON staff;
DROP FUNCTION IF EXISTS protect_owner_rows();
DROP FUNCTION IF EXISTS caller_is_venue_owner(uuid);

CREATE OR REPLACE FUNCTION reset_staff_pin_lock(
  p_session_token uuid,
  p_staff_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue uuid;
BEGIN
  SELECT ss.venue_id INTO v_venue
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
   WHERE ss.token      = p_session_token
     AND ss.expires_at > now()
     AND s.role IN ('manager', 'owner')
     AND s.is_active = true;

  IF v_venue IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff
     SET pin_failed_attempts = 0,
         pin_locked_until    = NULL
   WHERE id        = p_staff_id
     AND venue_id  = v_venue;
END;
$$;

-- 3. staff_disciplinary_log back to no RLS.
DROP POLICY IF EXISTS "staff_disciplinary_log_select" ON staff_disciplinary_log;
DROP POLICY IF EXISTS "staff_disciplinary_log_update" ON staff_disciplinary_log;
DROP POLICY IF EXISTS "staff_disciplinary_log_delete" ON staff_disciplinary_log;
ALTER TABLE staff_disciplinary_log DISABLE ROW LEVEL SECURITY;

-- 4. Tips back to venue-wide access (091 / 128).
DROP POLICY IF EXISTS "tip_splits_manager_access" ON tip_splits;
CREATE POLICY "tip_splits_venue_access" ON tip_splits
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

DROP POLICY IF EXISTS "tip_allocations_select" ON tip_allocations;
CREATE POLICY "tip_allocations_select" ON tip_allocations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM tip_splits ts
    WHERE ts.id = tip_allocations.tip_split_id AND has_venue_access(ts.venue_id)
  ));

-- 5. Public read of every dish (091).
DROP POLICY IF EXISTS "food_items_public_read" ON food_items;
CREATE POLICY "food_items_public_read" ON food_items FOR SELECT USING (true);
