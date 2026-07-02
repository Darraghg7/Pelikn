/**
 * signup-guard — IP-based rate limit for new account creation.
 *
 * Called by SignupFlowPage before supabase.auth.signUp.
 * Allows max 5 signup attempts per IP per hour.
 * Uses a hashed IP (SHA-256) so no raw IPs are stored.
 *
 * POST { email: string }
 * → 200 { ok: true }
 * → 429 { error: 'Too many signup attempts...' }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const MAX_ATTEMPTS  = 5
const WINDOW_HOURS  = 1

const ALLOWED_ORIGINS = [
  'https://get-pelikn.com',
  'https://pelikn.app',
  'https://pelikn.vercel.app',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
]

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + ':pelikn_rate_v1'))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

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
    // Get IP from Cloudflare header → standard forward header → fallback
    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    const ipHash  = await hashIp(ip)
    const db      = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    // Count recent attempts from this IP
    const { count } = await db
      .from('signup_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStart)

    if ((count ?? 0) >= MAX_ATTEMPTS) {
      return json({ error: `Too many signup attempts. Please try again in ${WINDOW_HOURS} hour.` }, 429)
    }

    // Record this attempt and prune old rows (keep table small)
    await db.from('signup_rate_limits').insert({ ip_hash: ipHash })
    db.from('signup_rate_limits')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .then(() => {})

    return json({ ok: true })
  } catch (err) {
    console.error('signup-guard error:', err)
    // Fail open — don't block legitimate signups on infra errors
    return json({ ok: true })
  }
})
