import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEMO_EMAIL      = 'demo@safeserv.com'
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')    ?? ''
const SUPABASE_ANON   = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const ALLOWED_ORIGINS = ['https://safeserv.app', 'http://localhost:5173', 'capacitor://localhost', 'ionic://localhost']

serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Identify the calling user via their JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (user.email !== DEMO_EMAIL) {
      return new Response(JSON.stringify({ error: 'Not a demo account' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Run the seed with the service role (bypasses RLS)
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const { error: seedErr } = await db.rpc('seed_demo_data', { p_owner_id: user.id })
    if (seedErr) {
      console.error('Seed error:', seedErr)
      return new Response(JSON.stringify({ error: seedErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
