-- ============================================================================
-- 161: Security hardening from the 23 Oct 2026 pre-launch audit
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN THE SUPABASE SQL EDITOR. ROLLBACK: 161_rollback.sql.  ║
-- ║  Safe to run more than once. No data is changed except PIN lock counters.║
-- ║  Deploy the pin-login function from the same branch alongside it.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 1. PIN lockout never fired. 057 incremented pin_failed_attempts and then
--    raised 'Incorrect PIN' in the same transaction, so the exception rolled
--    the count back: every guess was free and a 4-digit PIN could be found in
--    minutes. A wrong PIN now records the failure and returns NULL (callers
--    already treat "no token" as a wrong PIN). Attempts on one person are
--    serialised with FOR UPDATE so parallel guesses can't race past the lock,
--    and the lock escalates: 5 wrong → 15 min, 10 → 1 hour, 15+ → 24 hours.
--    A manager's "Unlock PIN" (or a correct PIN) resets it.
--
-- 2. A manager could take over the owner: update_staff_member and friends
--    only checked that the caller was a manager, so a manager could set the
--    owner's PIN, demote or delete them, or make themselves owner. A trigger
--    on staff now requires an owner (or the venue's account holder) for any
--    change to an owner's role, PIN, active flag, email, name or venue, for
--    deleting an owner, and for making anyone an owner. Requests with no
--    PostgREST context (SQL editor, pg_cron) and the service role are trusted.
--    reset_staff_pin_lock gets the same rule so a manager can't keep clearing
--    the owner's lockout while guessing.
--
-- 3. staff_disciplinary_log never had RLS (081 created it; 091's list missed
--    it). Managers keep full read and dismiss; staff read only their own
--    strikes (useClockAlerts counts them). Rows are only ever inserted by
--    SECURITY DEFINER RPCs, which bypass RLS.
--
-- 4. Tips: any staff member could read every colleague's tip allocations and
--    delete tip splits. Splits are now manager-only; staff may read only their
--    own allocations. Only managers use the Tips page.
--
-- 5. Hidden ("off the QR menu") dishes were readable by anyone with the
--    public key. The public read now returns active dishes only; venue members
--    still see everything.
-- ============================================================================


-- ── 1. PIN verification with a lockout that sticks ─────────────────────────
CREATE OR REPLACE FUNCTION verify_staff_pin_and_create_session(
  p_staff_id uuid,
  p_pin      text,
  p_venue_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pin_hash     text;
  v_is_active    boolean;
  v_locked_until timestamptz;
  v_failed       int;
  v_token        uuid;
BEGIN
  -- FOR UPDATE: concurrent attempts on the same person queue up here, so a
  -- burst of parallel guesses can't all pass the lock check at once.
  SELECT pin_hash, is_active, pin_locked_until, COALESCE(pin_failed_attempts, 0)
    INTO v_pin_hash, v_is_active, v_locked_until, v_failed
    FROM staff
   WHERE id = p_staff_id AND venue_id = p_venue_id
     FOR UPDATE;

  IF v_pin_hash IS NULL THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Account inactive';
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RAISE EXCEPTION 'Too many failed attempts — try again after %',
      to_char(v_locked_until AT TIME ZONE 'Europe/London', 'HH24:MI');
  END IF;

  IF v_pin_hash <> crypt(p_pin, v_pin_hash) THEN
    v_failed := v_failed + 1;
    UPDATE staff
       SET pin_failed_attempts = v_failed,
           pin_locked_until    = CASE
             WHEN v_failed >= 15 THEN now() + interval '24 hours'
             WHEN v_failed >= 10 THEN now() + interval '1 hour'
             WHEN v_failed >= 5  THEN now() + interval '15 minutes'
             ELSE NULL
           END
     WHERE id = p_staff_id;
    -- Return, don't RAISE: an exception would roll back the count above.
    RETURN NULL;
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


-- ── 2a. Is the caller an owner of this venue? ──────────────────────────────
-- PIN sessions carry the staff id as auth.uid() and the venue in the JWT;
-- email sign-ins carry the account holder's id.
CREATE OR REPLACE FUNCTION caller_is_venue_owner(p_venue uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_venue IS NOT NULL AND (
      EXISTS (SELECT 1 FROM venues v WHERE v.id = p_venue AND v.owner_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = auth.uid()
          AND s.role = 'owner'
          AND s.is_active = true
          AND (s.venue_id = p_venue OR current_venue_id() = p_venue)
      )
    ),
    false)
$$;
REVOKE ALL ON FUNCTION caller_is_venue_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION caller_is_venue_owner(uuid) TO anon, authenticated;


-- ── 2b. Only an owner may change an owner, or make one ─────────────────────
CREATE OR REPLACE FUNCTION protect_owner_rows()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claims  text := current_setting('request.jwt.claims', true);
  v_venue   uuid;
  v_guarded boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_venue   := OLD.venue_id;
    v_guarded := OLD.role = 'owner';
  ELSIF TG_OP = 'INSERT' THEN
    v_venue   := NEW.venue_id;
    v_guarded := NEW.role = 'owner';
  ELSE
    v_venue   := OLD.venue_id;
    -- Login bookkeeping (failed attempts, lock, last seen) and cosmetic
    -- fields stay open; anything that controls the account does not.
    v_guarded := (NEW.role = 'owner' AND OLD.role IS DISTINCT FROM 'owner')
      OR (OLD.role = 'owner' AND (
            NEW.role      IS DISTINCT FROM OLD.role
         OR NEW.pin_hash  IS DISTINCT FROM OLD.pin_hash
         OR NEW.is_active IS DISTINCT FROM OLD.is_active
         OR NEW.email     IS DISTINCT FROM OLD.email
         OR NEW.name      IS DISTINCT FROM OLD.name
         OR NEW.venue_id  IS DISTINCT FROM OLD.venue_id));
  END IF;

  IF NOT v_guarded
     OR NULLIF(v_claims, '') IS NULL                      -- SQL editor, pg_cron
     OR (v_claims::jsonb ->> 'role') = 'service_role'     -- edge functions
     OR caller_is_venue_owner(v_venue)
  THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'Only an owner can change an owner''s account'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS protect_owner_rows ON staff;
CREATE TRIGGER protect_owner_rows
  BEFORE INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION protect_owner_rows();


-- ── 2c. Unlocking an owner's PIN needs an owner too ────────────────────────
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
  v_venue       uuid;
  v_caller_role text;
BEGIN
  SELECT ss.venue_id, s.role INTO v_venue, v_caller_role
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
   WHERE ss.token      = p_session_token
     AND ss.expires_at > now()
     AND s.role IN ('manager', 'owner')
     AND s.is_active = true;

  IF v_venue IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role <> 'owner' AND EXISTS (
    SELECT 1 FROM staff WHERE id = p_staff_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only an owner can unlock an owner''s PIN' USING ERRCODE = '42501';
  END IF;

  UPDATE staff
     SET pin_failed_attempts = 0,
         pin_locked_until    = NULL
   WHERE id       = p_staff_id
     AND venue_id = v_venue;
END;
$$;


-- ── 3. staff_disciplinary_log: managers, plus staff reading their own ──────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'staff_disciplinary_log'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_disciplinary_log', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "staff_disciplinary_log_select" ON staff_disciplinary_log
  FOR SELECT USING (
    is_venue_hr_manager(venue_id)
    OR (staff_id = auth.uid() AND venue_id = current_venue_id())
  );

CREATE POLICY "staff_disciplinary_log_update" ON staff_disciplinary_log
  FOR UPDATE
  USING      (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

CREATE POLICY "staff_disciplinary_log_delete" ON staff_disciplinary_log
  FOR DELETE USING (is_venue_hr_manager(venue_id));

ALTER TABLE staff_disciplinary_log ENABLE ROW LEVEL SECURITY;


-- ── 4. Tips: managers only; staff see their own allocations ────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'tip_splits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tip_splits', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "tip_splits_manager_access" ON tip_splits
  FOR ALL
  USING      (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

ALTER TABLE tip_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tip_allocations_select" ON tip_allocations;
CREATE POLICY "tip_allocations_select" ON tip_allocations
  FOR SELECT USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tip_splits ts
      WHERE ts.id = tip_allocations.tip_split_id AND is_venue_hr_manager(ts.venue_id)
    )
  );


-- ── 5. Public allergen menu: active dishes only ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'food_items' AND column_name = 'is_active') THEN
    DROP POLICY IF EXISTS "food_items_public_read" ON food_items;
    CREATE POLICY "food_items_public_read" ON food_items
      FOR SELECT USING (is_active OR has_venue_access(venue_id));
  ELSE
    RAISE NOTICE 'food_items.is_active missing: public read left unchanged';
  END IF;
END $$;
