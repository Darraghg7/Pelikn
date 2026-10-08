-- 146 — a revoked or signed-out device stops seeing venue data straight away.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN THE SUPABASE SQL EDITOR.                              ║
-- ║  ROLLBACK: 146_rollback.sql (same folder).                               ║
-- ║  Ship the app change (PR "Revoked devices go back to the PIN screen")    ║
-- ║  first, or at the same time: without it a revoked device shows load      ║
-- ║  errors instead of returning to the PIN screen.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- What was wrong: a PIN sign-in gives the device a venue JWT (pin-login, 30
-- days) that carries the staff_sessions token it was issued for. Every table
-- read goes through has_venue_access → current_venue_id(), which trusted the
-- JWT's venue_id claim on its signature and expiry alone. So when a manager
-- revoked a device (085's revoke_staff_session deletes the row), or someone
-- signed out, or a staff member was deactivated, the device's JWT kept reading
-- the whole venue for up to 30 days. 145 made this matter more: pay and
-- contract details now trust the JWT too.
--
-- The fix: current_venue_id() — the one function every venue-scoped policy,
-- storage policy and session_actor uses — now also checks that the JWT's
-- session is still alive:
--
--   • the staff_sessions row for the token in the JWT still exists,
--   • it has not reached expires_at,
--   • it is for the same venue as the JWT,
--   • the staff member is still active.
--
-- If any of those fail the JWT no longer opens the venue:
--
--   • On an app (PostgREST) request the whole request fails with HTTP 401,
--     "Session ended". The app asks pin-login for a fresh JWT, pin-login says
--     the session is gone, and the app returns to the PIN screen. A 401 rather
--     than empty results is deliberate: an empty rota looks like real data.
--   • Anywhere else (realtime, which checks every change against every open
--     subscription in one go) it quietly returns NULL, which denies the row.
--     Raising there would stop live updates for every other device too.
--
-- Cost: current_venue_id() runs once per row under RLS. The session lookup
-- (two primary-key reads) happens once per request; the answer is cached in a
-- transaction-local setting keyed by token + venue, so the other rows cost a
-- settings read and a string compare. The cache cannot leak between requests
-- or devices: PostgREST runs each request in its own transaction, and the key
-- includes the token.
--
-- JWTs without a session_token claim (an owner's Supabase-Auth login) are not
-- affected: they never had a venue_id claim either, and keep the owner path in
-- has_venue_access. has_venue_access itself is unchanged.

CREATE OR REPLACE FUNCTION current_venue_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claims jsonb := auth.jwt();
  v_venue  uuid  := NULLIF(v_claims ->> 'venue_id', '')::uuid;
  v_token  text  := NULLIF(v_claims ->> 'session_token', '');
  v_key    text;
  v_cached text;
  v_live   boolean;
BEGIN
  -- No venue claim (anon, owner email login), or a JWT minted without a
  -- session token: exactly what 091 returned.
  IF v_venue IS NULL OR v_token IS NULL THEN
    RETURN v_venue;
  END IF;

  v_key    := v_token || '/' || v_venue::text;
  v_cached := current_setting('pelikn.venue_jwt_session', true);

  IF v_cached = 'live:' || v_key THEN
    RETURN v_venue;
  ELSIF v_cached = 'dead:' || v_key THEN
    v_live := false;
  ELSE
    -- Only ever signed by pin-login, so always a uuid; checked anyway so a
    -- malformed claim denies rather than erroring on the cast.
    v_live := v_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM staff_sessions ss
        JOIN staff s ON s.id = ss.staff_id
        WHERE ss.token      = v_token::uuid
          AND ss.venue_id   = v_venue
          AND ss.expires_at > now()
          AND s.is_active   = true
      );
    PERFORM set_config(
      'pelikn.venue_jwt_session',
      CASE WHEN v_live THEN 'live:' ELSE 'dead:' END || v_key,
      true
    );
  END IF;

  IF v_live THEN
    RETURN v_venue;
  END IF;

  -- The session behind this JWT is gone. PostgREST sets request.method on
  -- every request; realtime does not.
  IF NULLIF(current_setting('request.method', true), '') IS NOT NULL THEN
    RAISE SQLSTATE 'PGRST' USING
      MESSAGE = json_build_object(
        'code',    'PK401',
        'message', 'Session ended',
        'details', 'This device was signed out or its session was revoked.',
        'hint',    'Sign in again with your PIN.'
      )::text,
      DETAIL = json_build_object('status', 401, 'headers', json_build_object())::text;
  END IF;

  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION current_venue_id() TO anon, authenticated;

COMMENT ON FUNCTION current_venue_id() IS
  'Venue from the venue JWT, only while the staff_sessions row it was issued '
  'for is alive (146). Dead session: HTTP 401 on PostgREST, NULL elsewhere. '
  'Session lookup cached per transaction in pelikn.venue_jwt_session.';
