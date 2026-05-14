-- ============================================================================
-- 023: Fix create_venue_with_owner to store the actual manager email
-- and backfill owner_id on the Nomad Bakes venue from the existing auth user.
-- ============================================================================

-- Replace the RPC so it accepts the owner's email and stores it properly
CREATE OR REPLACE FUNCTION create_venue_with_owner(
  p_venue_name   text,
  p_slug         text,
  p_owner_name   text,
  p_owner_pin    text,
  p_owner_email  text DEFAULT NULL   -- NEW: caller passes their email
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id uuid;
  v_email    text;
BEGIN
  -- Require Supabase Auth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve email: use param if supplied, else fall back to auth.email()
  v_email := COALESCE(NULLIF(p_owner_email, ''), auth.email());

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM venues WHERE lower(slug) = lower(p_slug)) THEN
    RAISE EXCEPTION 'Venue slug already taken';
  END IF;

  -- Create venue, recording owner_id
  INSERT INTO venues (name, slug, owner_id)
  VALUES (p_venue_name, p_slug, auth.uid())
  RETURNING id INTO v_venue_id;

  -- Create owner as staff member
  INSERT INTO staff (name, pin_hash, role, job_role, venue_id, is_active)
  VALUES (p_owner_name, crypt(p_owner_pin, gen_salt('bf')), 'owner', 'foh', v_venue_id, true);

  -- Seed settings — store the real email this time
  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v_venue_id, 'venue_name', p_venue_name),
    (v_venue_id, 'manager_email', COALESCE(v_email, ''))
  ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;

  RETURN v_venue_id;
END;
$$;

-- Backfill owner_id for Nomad Bakes from the existing auth user whose email
-- matches the stored manager_email (safe to re-run — no-op if already set).
UPDATE venues
SET owner_id = (
  SELECT au.id
  FROM auth.users au
  WHERE lower(au.email) = (
    SELECT lower(value)
    FROM app_settings
    WHERE key = 'manager_email'
      AND venue_id = '00000000-0000-0000-0000-000000000001'
    LIMIT 1
  )
  LIMIT 1
)
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND owner_id IS NULL;
