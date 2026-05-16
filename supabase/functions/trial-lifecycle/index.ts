import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const CRON_SECRET  = Deno.env.get('CRON_SECRET') ?? ''
const APP_URL      = Deno.env.get('APP_URL') ?? 'https://pelikn.app'
const FROM         = 'Pelikn <hello@pelikn.app>'

// Days in the trial sequence. Day 0 is sent at signup; days 2–9 via daily cron.
const SCHEDULE = [0, 2, 4, 6, 7, 9] as const

// ── Styles shared across all emails ─────────────────────────────────────────
const S = {
  body:   'font-family:"Helvetica Neue",Arial,sans-serif;font-size:14px;color:#1a1a18;line-height:1.6;',
  p:      'margin:0 0 16px;',
  strong: 'font-weight:600;',
  hint:   'font-size:12px;color:#999;margin-top:24px;',
  step:   'display:flex;gap:14px;margin-bottom:20px;',
  stepN:  'flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#2D5A3D;color:#f5f0e8;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;line-height:28px;text-align:center;',
  stepP:  'margin:4px 0 0;color:#666;font-size:13px;',
  divider:'border:none;border-top:1px solid #e8e4dc;margin:24px 0;',
  feature:'background:#f5f5f3;border-radius:8px;padding:12px 16px;margin-bottom:10px;',
}

function htmlWrap(venueName: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f0e8;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e4dc;">
    <div style="background:#2D5A3D;padding:20px 28px;">
      <p style="color:#f5f0e8;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 2px;opacity:0.6;">PELIKN</p>
      <p style="color:#f5f0e8;font-size:14px;margin:0;opacity:0.75;">${esc(venueName)}</p>
    </div>
    <div style="padding:28px 32px;${S.body}">${content}</div>
    <div style="padding:14px 28px;background:#f5f0e8;border-top:1px solid #e8e4dc;text-align:center;">
      <p style="font-size:11px;color:#aaa;margin:0;">Pelikn &middot; <a href="mailto:hello@pelikn.app" style="color:#2D5A3D;">hello@pelikn.app</a> &middot; <a href="${APP_URL}" style="color:#2D5A3D;">pelikn.app</a></p>
    </div>
  </div>
</body>
</html>`
}

function cta(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#2D5A3D;color:#f5f0e8;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;margin:8px 0 20px;">${label}</a>`
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── Email templates ──────────────────────────────────────────────────────────
function buildEmail(day: number, ctx: { venueName: string; venueUrl: string; plan: string }): { subject: string; html: string } {
  const { venueName, venueUrl, plan } = ctx
  const isPro = plan === 'pro'

  switch (day) {
    // ── Day 0: Welcome ───────────────────────────────────────────────────────
    case 0: return {
      subject: 'Your Pelikn trial has started — here\'s what to do first',
      html: htmlWrap(venueName, `
        <p style="${S.p}">Your 7-day free trial is live. No card needed — just start logging.</p>
        <p style="${S.p}">Here are the three things worth doing today:</p>

        <div style="${S.step}">
          <div style="${S.stepN}">1</div>
          <div>
            <strong style="${S.strong}">Log your first temperature reading</strong>
            <p style="${S.stepP}">Go to Checks → Temperature. Log a fridge reading. That's your first EHO-ready record in the system.</p>
          </div>
        </div>

        <div style="${S.step}">
          <div style="${S.stepN}">2</div>
          <div>
            <strong style="${S.strong}">Set up your cleaning schedule</strong>
            <p style="${S.stepP}">Add your daily and weekly tasks. Staff tick them off on-device — you see live completion at a glance.</p>
          </div>
        </div>

        <div style="${S.step}">
          <div style="${S.stepN}">3</div>
          <div>
            <strong style="${S.strong}">${isPro ? 'Add your team and try the AI rota builder' : 'Set up your allergen registry'}</strong>
            <p style="${S.stepP}">${isPro ? 'Go to Team → Staff to add your crew, then open the Rota section to let the AI draft your first week.' : 'Go to Allergens and add your dishes with ingredient and allergen details. Natasha\'s Law compliance, done.'}</p>
          </div>
        </div>

        ${cta(venueUrl, 'Open Pelikn →')}
        <p style="${S.hint}">Any questions? Reply to this email — we read every one.</p>
      `),
    }

    // ── Day 2: Nudge ─────────────────────────────────────────────────────────
    case 2: return {
      subject: 'Quick check — are your fridge temps logged?',
      html: htmlWrap(venueName, `
        <p style="${S.p}">Temperature monitoring is the first thing an EHO checks. It's also the easiest thing to forget on a busy shift.</p>
        <p style="${S.p}">If you haven't set up your fridges yet, it takes about two minutes:</p>
        <div style="${S.feature}">
          <p style="margin:0;font-size:13px;">Go to <strong>Checks → Temperature → Add fridge</strong>, name your fridges, and log your first reading. Pelikn auto-detects pass/fail against safe ranges and flags anything that needs a corrective action.</p>
        </div>
        <p style="${S.p}">Every reading is stored permanently and included in your one-tap EHO compliance report.</p>
        ${cta(venueUrl, 'Log a temperature →')}
        <p style="${S.hint}">5 days left in your trial.</p>
      `),
    }

    // ── Day 4: Pro showcase ───────────────────────────────────────────────────
    case 4: return {
      subject: isPro ? 'Have you tried the AI rota builder yet?' : 'What Pelikn Pro adds to your venue',
      html: htmlWrap(venueName, isPro ? `
        <p style="${S.p}">You're on the Pro plan — here's a feature worth trying if you haven't yet.</p>
        <div style="${S.feature}">
          <p style="margin:0 0 6px;font-weight:600;font-size:14px;">AI Rota Builder</p>
          <p style="margin:0;font-size:13px;color:#555;">Open the Rota section, tap <em>AI Build</em>, and Pelikn drafts your whole week based on your team's availability, skills, and contracted hours. Review, adjust if needed, then publish — staff get a push notification.</p>
        </div>
        <p style="${S.p}">Also worth checking out: Staff Training Records. Add certificates and set expiry dates — Pelikn alerts you 30 days before anything lapses.</p>
        ${cta(venueUrl, 'Open Rota Builder →')}
        <p style="${S.hint}">3 days left in your trial.</p>
      ` : `
        <p style="${S.p}">You're on the Starter plan — which covers all your food safety compliance. Here's what upgrading to Pro adds:</p>
        <div style="${S.feature}">
          <p style="margin:0 0 4px;font-weight:600;">AI Rota Builder</p>
          <p style="margin:0;font-size:13px;color:#555;">Draft your whole week in seconds based on your team's availability and skills. Publish with one tap.</p>
        </div>
        <div style="${S.feature}">
          <p style="margin:0 0 4px;font-weight:600;">Timesheets & Payroll Export</p>
          <p style="margin:0;font-size:13px;color:#555;">Staff clock in and out on-device. Timesheets generate automatically. Export to CSV for payroll.</p>
        </div>
        <div style="${S.feature}">
          <p style="margin:0 0 4px;font-weight:600;">Staff Training Records</p>
          <p style="margin:0;font-size:13px;color:#555;">Track certificates and expiry dates. Get alerted 30 days before anything lapses.</p>
        </div>
        <p style="${S.p}">Pro is £25/month per venue — flat rate, no per-user fees.</p>
        ${cta(`${APP_URL}/signup?plan=pro`, 'Upgrade to Pro →')}
        <p style="${S.hint}">3 days left in your trial.</p>
      `),
    }

    // ── Day 6: 24-hour warning ───────────────────────────────────────────────
    case 6: return {
      subject: 'Your Pelikn trial ends in 24 hours',
      html: htmlWrap(venueName, `
        <p style="${S.p}">Your 7-day trial ends tomorrow. Everything you've logged — temperature records, cleaning completions, checklists — is stored in Pelikn.</p>
        <p style="${S.p}">Activating a plan keeps all of it. If you don't, access to your compliance records will be suspended after the trial ends.</p>
        <hr style="${S.divider}">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr>
            <td style="padding:10px;border:1px solid #e8e4dc;border-radius:8px 0 0 8px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#888;">Starter</p>
              <p style="margin:4px 0;font-size:22px;font-weight:700;color:#1a1a18;">£10<span style="font-size:13px;font-weight:400;color:#999;">/mo</span></p>
              <p style="margin:0;font-size:12px;color:#666;">Compliance only</p>
            </td>
            <td style="padding:10px;border:2px solid #2D5A3D;border-radius:0 8px 8px 0;text-align:center;background:#f9fdf9;">
              <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#2D5A3D;font-weight:600;">Pro</p>
              <p style="margin:4px 0;font-size:22px;font-weight:700;color:#2D5A3D;">£25<span style="font-size:13px;font-weight:400;color:#999;">/mo</span></p>
              <p style="margin:0;font-size:12px;color:#666;">Compliance + Team</p>
            </td>
          </tr>
        </table>
        ${cta(`${APP_URL}/settings`, 'Activate your plan →')}
        <p style="${S.hint}">No contracts. Cancel anytime from your account settings.</p>
      `),
    }

    // ── Day 7: Final day ─────────────────────────────────────────────────────
    case 7: return {
      subject: 'Your Pelikn trial ends today',
      html: htmlWrap(venueName, `
        <p style="${S.p}">Today is the last day of your free trial.</p>
        <p style="${S.p}">Your compliance records — temperature logs, cleaning records, checklists, allergen data — are all inside Pelikn. Activating a plan keeps them safe and accessible. Without a plan, access will be suspended at midnight.</p>
        ${cta(`${APP_URL}/settings`, 'Keep my records — activate now →')}
        <hr style="${S.divider}">
        <p style="font-size:13px;color:#666;margin:0 0 8px;">Plans start from <strong>£10/month</strong> (compliance only) or <strong>£25/month</strong> for compliance + full team management. Flat per-venue pricing — no per-user fees.</p>
        <p style="${S.hint}">Questions? Reply here or email hello@pelikn.app. We'll get back to you today.</p>
      `),
    }

    // ── Day 9: Lapsed re-engagement ──────────────────────────────────────────
    case 9: return {
      subject: 'Your Pelikn compliance records are still safe',
      html: htmlWrap(venueName, `
        <p style="${S.p}">Your trial ended a couple of days ago, but your compliance data is still there — we haven't deleted anything.</p>
        <p style="${S.p}">If you're still thinking it over, here's what it costs to pick up where you left off:</p>
        <div style="${S.feature}">
          <p style="margin:0 0 4px;"><strong>Starter — £10/month</strong></p>
          <p style="margin:0;font-size:13px;color:#555;">Temperature logs, cleaning records, allergen registry, EHO audit reports. Everything for compliance.</p>
        </div>
        <div style="${S.feature}">
          <p style="margin:0 0 4px;"><strong>Pro — £25/month</strong></p>
          <p style="margin:0;font-size:13px;color:#555;">Everything in Starter plus AI rota builder, timesheets, staff training records, time-off management.</p>
        </div>
        ${cta(`${APP_URL}/settings`, 'Reactivate my account →')}
        <p style="${S.hint}">No contracts. No setup fee. Your existing data restores immediately on activation.</p>
      `),
    }

    default:
      throw new Error(`Unknown trial day: ${day}`)
  }
}

// ── Daily sweep: find all venues due for an email and send ───────────────────
async function sweep(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - 15 * 86_400_000).toISOString()

  const { data: venues, error } = await admin
    .from('venues')
    .select('id, slug, plan, created_at, trial_emails_sent')
    .eq('is_demo', false)
    .gte('created_at', cutoff)

  if (error) throw error

  let sent = 0, skipped = 0, failed = 0

  for (const venue of (venues ?? [])) {
    const daysSince = Math.floor((Date.now() - new Date(venue.created_at).getTime()) / 86_400_000)
    const already   = (venue.trial_emails_sent as number[]) ?? []
    const dueDays   = (SCHEDULE as readonly number[]).filter(d => d > 0 && d <= daysSince && !already.includes(d))

    for (const day of dueDays) {
      const ok = await sendTrialDay(admin, venue, day)
      if (ok) sent++; else if (ok === false) skipped++; else failed++
    }
  }

  return { sent, skipped, failed }
}

// ── Send one day's email to one venue ───────────────────────────────────────
async function sendTrialDay(admin: ReturnType<typeof createClient>, venue: { id: string; slug: string; plan: string; trial_emails_sent: number[] }, day: number): Promise<boolean> {
  const already = (venue.trial_emails_sent as number[]) ?? []
  if (already.includes(day)) return false

  // Get manager email and venue name from app_settings
  const { data: settings } = await admin
    .from('app_settings')
    .select('key, value')
    .eq('venue_id', venue.id)
    .in('key', ['manager_email', 'venue_name'])

  const byKey = Object.fromEntries((settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))
  const email = byKey['manager_email']
  if (!email) return false

  const venueName = byKey['venue_name'] ?? 'your venue'
  const venueUrl  = `${APP_URL}/v/${venue.slug}`

  const { subject, html } = buildEmail(day, { venueName, venueUrl, plan: venue.plan ?? 'starter' })

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM, to: [email], subject, html }),
  })

  if (!res.ok) {
    console.error(`Resend error day ${day} venue ${venue.id}:`, await res.text())
    return false
  }

  await admin
    .from('venues')
    .update({ trial_emails_sent: [...already, day] })
    .eq('id', venue.id)

  return true
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
const ALLOWED = ['https://pelikn.app', 'capacitor://localhost', 'ionic://localhost',
  Deno.env.get('DEV_ORIGIN') ?? ''].filter(Boolean)

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin':  ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const jsonOk  = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const jsonErr  = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } })

// ── Entry point ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const body  = await req.json().catch(() => ({}))

  // ── Cron sweep (called by scheduler with shared secret) ──────────────────
  if (CRON_SECRET && body.cron_secret === CRON_SECRET) {
    const result = await sweep(admin)
    return jsonOk(result)
  }

  // ── Day 0 welcome (called from frontend immediately after signup) ─────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonErr('Unauthorised', 401)

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return jsonErr('Unauthorised', 401)

  const { data: venue } = await admin
    .from('venues')
    .select('id, slug, plan, trial_emails_sent')
    .eq('owner_id', user.id)
    .eq('is_demo', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!venue) return jsonErr('Venue not found', 404)

  const sent = await sendTrialDay(admin, venue, 0)
  return jsonOk({ sent })
})
