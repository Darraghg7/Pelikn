import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY          = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL              = Deno.env.get('FROM_EMAIL') ?? 'rota@safeserv.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify the caller is an authenticated manager
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('Unauthorised', 401)

    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return errorResponse('Unauthorised', 401)

    // 2. Parse request
    const { weekStart } = await req.json() as { weekStart: string }
    if (!weekStart) return errorResponse('Missing weekStart', 400)

    // 3. Fetch shifts + staff for this week using service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

    const { data: shifts, error: shiftsErr } = await admin
      .from('shifts')
      .select('*, staff(name, email)')
      .eq('week_start', weekStart)
      .order('shift_date')
      .order('start_time')

    if (shiftsErr) return errorResponse(shiftsErr.message, 500)
    if (!shifts || shifts.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No shifts for this week — skipped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Group shifts by staff member
    const byStaff: Record<string, { name: string; email: string; shifts: typeof shifts }> = {}
    for (const sh of shifts) {
      const sid  = sh.staff_id
      const name = sh.staff?.name ?? 'Team Member'
      const email = sh.staff?.email ?? ''
      if (!email) continue
      if (!byStaff[sid]) byStaff[sid] = { name, email, shifts: [] }
      byStaff[sid].shifts.push(sh)
    }

    const entries = Object.values(byStaff)
    if (entries.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No staff with email addresses — skipped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Format dates
    const [y, m, d] = weekStart.split('-').map(Number)
    const weekDate  = new Date(y, m - 1, d)
    const weekLabel = weekDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const dayNames  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    const getDayName = (dateStr: string) => {
      const [py, pm, pd] = dateStr.split('-').map(Number)
      const date = new Date(py, pm - 1, pd)
      const dow  = (date.getDay() + 6) % 7  // 0=Mon
      return `${dayNames[dow]} ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    }

    // 6. Send one email per staff member
    const errors: string[] = []
    let sent = 0

    for (const { name, email, shifts: staffShifts } of entries) {
      const rows = staffShifts.map((sh) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e8e2d8;">${getDayName(sh.shift_date)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e8e2d8;">${sh.start_time.slice(0,5)} – ${sh.end_time.slice(0,5)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e8e2d8;">${sh.role_label}</td>
        </tr>
      `).join('')

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f0e8;padding:24px;margin:0;">
          <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
            <div style="background:#1a1a18;padding:24px 32px;">
              <h1 style="color:#f5f0e8;margin:0;font-size:22px;">SafeServ</h1>
              <p style="color:rgba(245,240,232,0.6);margin:4px 0 0;font-size:14px;">Your rota for the week of ${weekLabel}</p>
            </div>
            <div style="padding:24px 32px;">
              <p style="color:#1a1a18;font-size:16px;">Hi ${name},</p>
              <p style="color:#555;font-size:14px;margin-bottom:20px;">Here are your shifts for the week starting ${weekLabel}:</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead>
                  <tr style="background:#f5f0e8;">
                    <th style="text-align:left;padding:10px 16px;color:#666;font-weight:600;">Day</th>
                    <th style="text-align:left;padding:10px 16px;color:#666;font-weight:600;">Time</th>
                    <th style="text-align:left;padding:10px 16px;color:#666;font-weight:600;">Role</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div style="padding:16px 32px;background:#f5f0e8;">
              <p style="color:#999;font-size:12px;margin:0;">Sent via SafeServ. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      [email],
          subject: `Your rota — week of ${weekLabel}`,
          html,
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        errors.push(`${name} (${email}): ${errBody}`)
      } else {
        sent++
      }
    }

    return new Response(
      JSON.stringify({ sent, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return errorResponse(String(err), 500)
  }
})

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
