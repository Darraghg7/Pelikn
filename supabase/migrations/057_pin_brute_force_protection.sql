-- ============================================================================
-- 057: PIN brute-force protection
--
-- Adds failed-attempt tracking to the staff table and updates
-- verify_staff_pin_and_create_session to enforce a 15-minute lockout
-- after 5 consecutive wrong PINs.
--
-- Lockout resets on a successful login.
-- ============================================================================

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS pin_failed_attempts int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until    timestamptz;

-- Replace function with brute-force protection
DROP FUNCTION IF EXISTS verify_staff_pin_and_create_session(uuid, text, uuid);
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
  v_pin_hash    text;
  v_is_active   boolean;
  v_locked_until timestamptz;
  v_token       uuid;
BEGIN
  -- Fetch the staff record
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

  -- Check lockout
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RAISE EXCEPTION 'Too many failed attempts — try again after %',
      to_char(v_locked_until AT TIME ZONE 'UTC', 'HH24:MI UTC');
  END IF;

  -- Verify PIN
  IF v_pin_hash <> crypt(p_pin, v_pin_hash) THEN
    -- Increment failure counter; lock after 5 consecutive failures
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

  -- PIN correct — reset failure counter
  UPDATE staff
     SET pin_failed_attempts = 0,
         pin_locked_until    = NULL
   WHERE id = p_staff_id;

  -- Clean up expired sessions for this staff member (keep active sessions for other devices)
  DELETE FROM staff_sessions
   WHERE staff_id = p_staff_id AND expires_at < now();

  -- Create a fresh 30-day session
  INSERT INTO staff_sessions (staff_id, venue_id, expires_at)
  VALUES (p_staff_id, p_venue_id, now() + interval '30 days')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;
