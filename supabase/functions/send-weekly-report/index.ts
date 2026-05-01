import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const DEV_ORIGIN = Deno.env.get('DEV_ORIGIN')
const ALLOWED_ORIGINS = ['https://pelikn.app', 'capacitor://localhost', 'ionic://localhost', ...(DEV_ORIGIN ? [DEV_ORIGIN] : [])]

function fmt(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function settingValue(value: unknown) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to, venueId, sessionToken } = await req.json().catch(() => ({}))
    if (!to) return jsonResponse({ error: 'No recipient' }, 400, corsHeaders)
    if (!venueId) return jsonResponse({ error: 'No venueId' }, 400, corsHeaders)
    if (!sessionToken) return jsonResponse({ error: 'Missing session token' }, 401, corsHeaders)

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const { data: allowed, error: authErr } = await db.rpc('validate_manager_session_for_venue', {
      p_session_token: sessionToken,
      p_venue_id:      venueId,
    })
    if (authErr) throw authErr
    if (!allowed) return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders)

    const now       = new Date()
    const weekAgo   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekStart = weekAgo.toISOString().slice(0, 10)
    const weekEnd   = now.toISOString().slice(0, 10)

    // Parallel data fetch
    const [
      venueRes,
      clockRes,
      tempRes,
      cleaningTaskRes,
      cleaningCompRes,
      checkRes,
      checkCompRes,
      wasteRes,
    ] = await Promise.all([
      db.from('app_settings').select('key,value').eq('venue_id', venueId),
      db.from('clock_events').select('*').eq('venue_id', venueId).gte('occurred_at', weekStart),
      db.from('fridge_temperature_logs')
        .select('temperature, fridge:fridge_id(min_temp,max_temp)')
        .eq('venue_id', venueId)
        .gte('logged_at', weekStart),
      db.from('cleaning_tasks').select('id').eq('venue_id', venueId).eq('is_active', true),
      db.from('cleaning_completions').select('cleaning_task_id').eq('venue_id', venueId).gte('completed_at', weekStart),
      db.from('opening_closing_checks').select('id').eq('venue_id', venueId).eq('is_active', true),
      db.from('opening_closing_completions').select('check_id').eq('venue_id', venueId).gte('completed_at', weekStart),
      db.from('waste_logs').select('item_name,quantity,unit,reason').eq('venue_id', venueId).gte('recorded_at', weekStart),
    ])

    const settings = Object.fromEntries((venueRes.data ?? []).map((r: any) => [r.key, settingValue(r.value)]))
    const venueName = escapeHtml(settings.venue_name ?? 'Pelikn')

    // Hours calculation
    const events = (clockRes.data ?? []).sort((a: any, b: any) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    )
    let totalMins = 0
    let lastIn: Date | null = null
    for (const e of events) {
      if (e.event_type === 'clock_in')  lastIn = new Date(e.occurred_at)
      if (e.event_type === 'clock_out' && lastIn) {
        totalMins += (new Date(e.occurred_at).getTime() - lastIn.getTime()) / 60000
        lastIn = null
      }
    }
    const totalHrs = (totalMins / 60).toFixed(1)

    // Temp compliance
    const temps = tempRes.data ?? []
    const tempFails = temps.filter((l: any) => l.fridge &&
      (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp)).length
    const tempPct = temps.length ? Math.round(((temps.length - tempFails) / temps.length) * 100) : 0

    // Cleaning completion
    const cleaningTasks = (cleaningTaskRes.data ?? []).map((t: any) => t.id)
    const completedTaskIds = new Set((cleaningCompRes.data ?? []).map((c: any) => c.cleaning_task_id))
    const cleaningDone = cleaningTasks.filter((id: string) => completedTaskIds.has(id)).length
    const cleaningPct = cleaningTasks.length ? Math.round((cleaningDone / cleaningTasks.length) * 100) : 0

    // Opening/closing completion
    const checkIds = (checkRes.data ?? []).map((c: any) => c.id)
    const doneCheckIds = new Set((checkCompRes.data ?? []).map((c: any) => c.check_id))
    const checksDone = checkIds.filter((id: string) => doneCheckIds.has(id)).length
    const checksPct = checkIds.length ? Math.round((checksDone / checkIds.length) * 100) : 0

    // Waste summary
    const wasteLogs = wasteRes.data ?? []
    const wasteByReason: Record<string, number> = {}
    for (const w of wasteLogs as any[]) {
      wasteByReason[w.reason] = (wasteByReason[w.reason] ?? 0) + 1
    }

    const wasteRows = Object.entries(wasteByReason)
      .map(([reason, count]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${escapeHtml(reason)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${count} entries</td></tr>`)
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f0e8;margin:0;padding:24px;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e4dc;">
    <div style="background:#1a1a18;padding:24px 28px;">
      <h1 style="color:#f5f0e8;font-size:22px;margin:0;font-weight:400;">${venueName}</h1>
      <p style="color:#f5f0e8;opacity:0.5;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:4px 0 0;">Weekly Report · ${fmt(weekAgo)} – ${fmt(now)}</p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr style="background:#f8f6f2;">
          <td style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;font-weight:600;">Metric</td>
          <td style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;font-weight:600;text-align:right;">Result</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;color:#1a1a18;">Total hours worked</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:#1a1a18;text-align:right;">${totalHrs} hrs</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;color:#1a1a18;">Temperature checks</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:${tempPct < 80 ? '#c94f2a' : '#2d7a4f'};text-align:right;">${temps.length} checks · ${tempPct}% in range</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;color:#1a1a18;">Cleaning tasks completed</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:${cleaningPct < 80 ? '#c94f2a' : '#2d7a4f'};text-align:right;">${cleaningDone}/${cleaningTasks.length} (${cleaningPct}%)</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;color:#1a1a18;">Opening &amp; closing checks</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:${checksPct < 80 ? '#c94f2a' : '#2d7a4f'};text-align:right;">${checksDone}/${checkIds.length} (${checksPct}%)</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:14px;color:#1a1a18;">Waste entries logged</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#1a1a18;text-align:right;">${wasteLogs.length}</td>
        </tr>
      </table>

      ${wasteLogs.length > 0 ? `
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;font-weight:600;margin-bottom:8px;">Waste by Reason</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
        ${wasteRows}
      </table>` : ''}

      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:24px;">
        Generated by Pelikn · ${new Date().toLocaleString('en-GB')}
      </p>
    </div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Pelikn Reports <onboarding@resend.dev>',
        to: [to],
        subject: `${venueName} — Weekly Report (${fmt(weekAgo)} – ${fmt(now)})`,
        html,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return jsonResponse({ error: errBody }, 500, corsHeaders)
    }

    return jsonResponse({ ok: true }, 200, corsHeaders)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500, corsHeaders)
  }
})
