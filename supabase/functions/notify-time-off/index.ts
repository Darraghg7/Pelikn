/**
 * notify-time-off — Supabase Edge Function
 *
 * Called from the frontend after a time-off request is successfully inserted.
 * Sends an email to the venue manager via Resend.
 *
 * Setup:
 *   1. Create a free account at https://resend.com
 *   2. Verify a sending domain (or use resend's sandbox domain for testing)
 *   3. Run: supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
 *   4. Deploy: supabase functions deploy notify-time-off
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = 'Pelikn <onboarding@resend.dev>'

const ALLOWED_ORIGINS = ['https://pelikn.app', 'http://localhost:5173', 'capacitor://localhost', 'ionic://localhost']

serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { managerEmail, venueName, staffName, startDate, endDate, reason } = await req.json()

    if (!managerEmail) {
      return new Response(JSON.stringify({ error: 'managerEmail is required' }), { status: 400 })
    }

    const formattedStart = new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const formattedEnd   = new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a18;">
        <h2 style="font-size: 20px; margin: 0 0 8px;">New Leave Request</h2>
        <p style="color: #888; margin: 0 0 24px; font-size: 14px;">${venueName}</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #888; width: 120px;">Staff member</td>
            <td style="padding: 8px 0; font-weight: 600;">${staffName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">From</td>
            <td style="padding: 8px 0;">${formattedStart}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">To</td>
            <td style="padding: 8px 0;">${formattedEnd}</td>
          </tr>
          ${reason ? `
          <tr>
            <td style="padding: 8px 0; color: #888;">Reason</td>
            <td style="padding: 8px 0; font-style: italic;">"${reason}"</td>
          </tr>` : ''}
        </table>

        <div style="margin-top: 24px; padding: 16px; background: #f5f1ec; border-radius: 8px; font-size: 13px; color: #666;">
          Log in to Pelikn to approve or decline this request.
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [managerEmail],
        subject: `Leave request from ${staffName} — ${venueName}`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', body)
      return new Response(JSON.stringify({ error: body }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Access-Control-Allow-Origin': allowedOrigin },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
