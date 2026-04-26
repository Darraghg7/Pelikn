/**
 * send-apns — Native iOS Push Notification sender via Apple APNs HTTP/2 API
 *
 * Sends a push notification to all registered iOS devices for the target
 * staff members. Mirrors the send-push interface so both can be called in
 * parallel from src/lib/sendPush.js.
 *
 * Body: { venueId, title, body, url, roles?, staffIds? }
 *
 * Required Supabase secrets:
 *   APNS_KEY_ID    — 10-char Key ID from Apple Developer portal
 *   APNS_TEAM_ID   — 10-char Team ID from Apple Developer portal
 *   APNS_PRIVATE_KEY — Full contents of your AuthKey_XXXXXXXXXX.p8 file
 *   APNS_BUNDLE_ID — e.g. app.pelikn
 *
 * To set secrets:
 *   supabase secrets set APNS_KEY_ID=XXXXXXXXXX
 *   supabase secrets set APNS_TEAM_ID=XXXXXXXXXX
 *   supabase secrets set APNS_BUNDLE_ID=app.pelikn
 *   supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
 *
 * Deploy:
 *   supabase functions deploy send-apns
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APNS_KEY_ID     = Deno.env.get('APNS_KEY_ID')     ?? ''
const APNS_TEAM_ID    = Deno.env.get('APNS_TEAM_ID')    ?? ''
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY') ?? ''
const APNS_BUNDLE_ID  = Deno.env.get('APNS_BUNDLE_ID')  ?? 'app.pelikn'
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')    ?? ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const ALLOWED_ORIGINS = [
  'https://pelikn.app',
  'https://pelikn.app',
  'http://localhost:5173',
  'capacitor://localhost',
  'ionic://localhost',
]

// ── APNs JWT helpers ──────────────────────────────────────────────────────────

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  bytes.forEach(b => str += String.fromCharCode(b))
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Strip PEM headers/footers and decode the raw base64 key bytes */
function pemToBytes(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  return Uint8Array.from([...bin].map(c => c.charCodeAt(0)))
}

/**
 * Build a signed APNs provider authentication JWT valid for 60 minutes.
 * Apple requires a fresh token at most every 60 minutes and at least every hour.
 */
async function buildApnsJwt(): Promise<string> {
  const header  = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID })))
  const iat     = Math.floor(Date.now() / 1000)
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ iss: APNS_TEAM_ID, iat })))
  const signingInput = `${header}.${payload}`

  // Import the EC private key from the .p8 PEM
  const keyBytes = pemToBytes(APNS_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${base64url(sigBytes)}`
}

/** Send a single APNs push; returns true on success, false on failure */
async function sendOne(token: string, jwt: string, notification: {
  title: string
  body: string
  url: string
}): Promise<'ok' | 'expired' | 'error'> {
  const apnsUrl = `https://api.push.apple.com/3/device/${token}`
  const payload = JSON.stringify({
    aps: {
      alert: { title: notification.title, body: notification.body },
      sound: 'default',
      badge: 1,
    },
    url: notification.url,
  })

  try {
    const res = await fetch(apnsUrl, {
      method: 'POST',
      headers: {
        'authorization':  `bearer ${jwt}`,
        'apns-topic':     APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority':  '10',
        'content-type':   'application/json',
      },
      body: payload,
    })

    if (res.ok) return 'ok'

    // 410 = token no longer valid, 400 BadDeviceToken = also invalid
    const resBody = await res.json().catch(() => ({}))
    const reason  = (resBody as any)?.reason ?? ''
    if (res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
      return 'expired'
    }

    console.error(`APNs error ${res.status}: ${reason}`)
    return 'error'
  } catch (err) {
    console.error('APNs fetch error:', err)
    return 'error'
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { venueId, title, body, url = '/', roles, staffIds } = await req.json()

    if (!venueId || !title || !body) {
      return new Response(JSON.stringify({ error: 'venueId, title and body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
      console.warn('APNs credentials not configured — skipping native push')
      return new Response(JSON.stringify({ sent: 0, message: 'APNs not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // ── Resolve which staff to notify ─────────────────────────────────────────
    let targetStaffIds: string[] = staffIds ?? []

    if (!targetStaffIds.length) {
      const targetRoles = roles ?? ['manager', 'owner']
      const { data: staffAtVenue } = await db
        .from('staff')
        .select('id')
        .eq('venue_id', venueId)
        .in('role', targetRoles)
        .eq('is_active', true)

      targetStaffIds = (staffAtVenue ?? []).map((s: any) => s.id)
    }

    if (!targetStaffIds.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No matching staff' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Look up APNs tokens ───────────────────────────────────────────────────
    const { data: tokenRows, error: tokenErr } = await db
      .from('apns_tokens')
      .select('id, token')
      .in('staff_id', targetStaffIds)

    if (tokenErr) throw tokenErr
    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No APNs tokens registered' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Build JWT once and reuse for all sends ────────────────────────────────
    const jwt = await buildApnsJwt()

    let sent = 0
    const expiredIds: string[] = []

    await Promise.all(tokenRows.map(async (row: any) => {
      const result = await sendOne(row.token, jwt, { title, body, url })
      if (result === 'ok') { sent++ }
      else if (result === 'expired') { expiredIds.push(row.id) }
    }))

    // ── Clean up expired tokens ───────────────────────────────────────────────
    if (expiredIds.length) {
      await db.from('apns_tokens').delete().in('id', expiredIds)
    }

    return new Response(JSON.stringify({ sent, expired: expiredIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-apns error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
