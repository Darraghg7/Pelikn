/**
 * pin-login — issues a venue-scoped JWT after PIN verification
 *
 * Two actions:
 *   { action: 'login',     staff_id, pin, venue_id }
 *     → validates PIN via existing verify_staff_pin_and_create_session RPC
 *     → returns { jwt, session_token }
 *
 *   { action: 'issue_jwt', session_token, venue_id }
 *     → validates an existing session token (used after switchVenue)
 *     → returns { jwt }
 *
 * The JWT is signed with SUPABASE_JWT_SECRET so Supabase PostgREST accepts
 * it as 'authenticated'. The venue_id claim enables venue-scoped RLS without
 * the paid pre-request hook.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const JWT_SECRET       = Deno.env.get('JWT_SIGNING_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? ''

const ALLOWED_ORIGINS = [
  'https://get-pelikn.com',
  'https://pelikn.app',
  'https://pelikn.vercel.app',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
]

// ── JWT signing ───────────────────────────────────────────────────────────────

function b64url(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  // btoa only handles Latin-1; UUIDs and JSON are ASCII-safe
  let b64 = ''
  for (let i = 0; i < bytes.length; i += 1024) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + 1024))
  }
  return btoa(b64).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = b64url(JSON.stringify(payload))
  const input   = `${header}.${body}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  return `${input}.${b64url(new Uint8Array(sig))}`
}

function makeJwt(staffId: string, venueId: string, sessionToken: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signJwt({
    aud:           'authenticated',
    iss:           'supabase',
    sub:           staffId,
    role:          'authenticated',
    venue_id:      venueId,
    session_token: sessionToken,
    iat:           now,
    exp:           now + 60 * 60 * 24 * 30, // 30 days
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json()
    const { action } = body

    if (!JWT_SECRET) return json({ error: 'JWT_SECRET not configured' }, 500)

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // ── action: login (PIN → session_token + JWT) ─────────────────────────
    if (action === 'login') {
      const { staff_id, pin, venue_id } = body
      if (!staff_id || !pin || !venue_id) return json({ error: 'staff_id, pin, venue_id required' }, 400)

      const { data: sessionToken, error } = await db.rpc('verify_staff_pin_and_create_session', {
        p_staff_id: staff_id,
        p_pin:      pin,
        p_venue_id: venue_id,
      })

      if (error || !sessionToken) {
        const msg = error?.message ?? 'Invalid PIN'
        const status = msg.toLowerCase().includes('too many') ? 429
          : msg.toLowerCase().includes('inactive')           ? 403
          : 401
        return json({ error: msg }, status)
      }

      const jwt = await makeJwt(staff_id, venue_id, sessionToken)
      return json({ jwt, session_token: sessionToken })
    }

    // ── action: verify_pin (PIN check without creating a session) ────────
    if (action === 'verify_pin') {
      const { staff_id, pin, venue_id } = body
      if (!staff_id || !pin || !venue_id) return json({ error: 'staff_id, pin, venue_id required' }, 400)

      const { data: sessionToken, error } = await db.rpc('verify_staff_pin_and_create_session', {
        p_staff_id: staff_id,
        p_pin:      pin,
        p_venue_id: venue_id,
      })

      if (error || !sessionToken) {
        const msg = error?.message ?? 'Invalid PIN'
        const status = msg.toLowerCase().includes('too many') ? 429
          : msg.toLowerCase().includes('inactive')           ? 403
          : 401
        return json({ error: msg }, status)
      }

      // PIN valid — delete the temporary session so it doesn't linger
      db.from('staff_sessions').delete().eq('token', sessionToken).then(() => {})

      // Return the staff role so the caller can confirm manager access
      const { data: staff } = await db
        .from('staff')
        .select('role, name')
        .eq('id', staff_id)
        .single()

      return json({ ok: true, role: staff?.role ?? 'staff', name: staff?.name ?? '' })
    }

    // ── action: issue_jwt (existing session_token → new JWT for venue) ────
    if (action === 'issue_jwt') {
      const { session_token, venue_id } = body
      if (!session_token || !venue_id) return json({ error: 'session_token, venue_id required' }, 400)

      const { data: row } = await db
        .from('staff_sessions')
        .select('staff_id, venue_id, expires_at')
        .eq('token', session_token)
        .eq('is_active', true)
        .single()

      if (!row) return json({ error: 'Invalid or expired session' }, 401)
      if (new Date(row.expires_at) < new Date()) return json({ error: 'Session expired' }, 401)

      // The session's venue_id must match the requested venue_id
      // (switch_staff_venue already updated this before calling issue_jwt)
      if (row.venue_id !== venue_id) return json({ error: 'Venue mismatch' }, 403)

      const jwt = await makeJwt(row.staff_id, venue_id, session_token)
      return json({ jwt })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('pin-login error:', err)
    return json({ error: 'Internal error' }, 500)
  }
})
