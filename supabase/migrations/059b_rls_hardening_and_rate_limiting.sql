-- ============================================================================
-- 059: RLS hardening + Claude API rate limiting
--
-- 1. ai_usage_log table  — tracks Claude calls per venue for rate limiting
-- 2. save_staff_permissions RPC — moves permission writes into a SECURITY
--    DEFINER function so the anon role can no longer directly modify them
-- 3. staff_permissions RLS — enable row-level security; restrict writes to
--    service role / SECURITY DEFINER RPCs only (was fully open — no RLS at all)
-- 4. venues write policy — remove blanket public write; venue creation and
--    updates already go exclusively through SECURITY DEFINER RPCs
-- ============================================================================

-- ── 1. AI usage log for rate limiting ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id      uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  function_name text        NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_lookup
  ON ai_usage_log (venue_id, function_name, created_at);

-- Only the service role (edge functions) can write; anon role can read nothing
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy — usage data is internal only


-- ── 2. save_staff_permissions RPC ────────────────────────────────────────────
-- Replaces direct table writes in the manager UI with a verified server-side
-- function. Validates session token and venue ownership before mutating.
CREATE OR REPLACE FUNCTION save_staff_permissions(
  p_session_token uuid,
  p_staff_id      uuid,
  p_permissions   text[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue uuid;
BEGIN
  -- Verify caller is an active manager/owner at this venue
  SELECT ss.venue_id INTO v_venue
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token    = p_session_token
    AND ss.expires_at > now()
    AND s.role       IN ('manager', 'owner')
    AND s.is_active  = true;

  IF v_venue IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Ensure the target staff member belongs to this venue
  IF NOT EXISTS (
    SELECT 1 FROM staff WHERE id = p_staff_id AND venue_id = v_venue
  ) THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  -- Replace all permissions atomically
  DELETE FROM staff_permissions
  WHERE staff_id = p_staff_id
    AND venue_id = v_venue;

  IF p_permissions IS NOT NULL AND array_length(p_permissions, 1) > 0 THEN
    INSERT INTO staff_permissions (staff_id, venue_id, permission)
    SELECT p_staff_id, v_venue, perm
    FROM   unnest(p_permissions) AS perm
    ON CONFLICT (staff_id, venue_id, permission) DO NOTHING;
  END IF;
END;
$$;


-- ── 3. Enable RLS on staff_permissions ───────────────────────────────────────
-- This table had NO RLS — any anon user could grant themselves any permission.
ALTER TABLE staff_permissions ENABLE ROW LEVEL SECURITY;

-- Staff can read their own permissions (needed for hasPermission() checks)
DROP POLICY IF EXISTS "sp_read" ON staff_permissions;
CREATE POLICY "sp_read" ON staff_permissions
  FOR SELECT USING (true);

-- No INSERT / UPDATE / DELETE policy for the anon role.
-- All writes go through save_staff_permissions (SECURITY DEFINER above)
-- or through create_staff_member which also runs as SECURITY DEFINER.


-- ── 4. Remove blanket venue write policy ─────────────────────────────────────
-- Venue creation and updates already require a Supabase Auth user via the
-- create_venue_with_owner() SECURITY DEFINER RPC. There is no legitimate path
-- for the anon role to write directly to the venues table.
DROP POLICY IF EXISTS "venues_public_write" ON venues;
