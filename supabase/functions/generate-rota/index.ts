import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// day_of_week 1=Mon…7=Sun → 0-based index
function dowIndex(dow: number) { return dow - 1 }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err('Unauthorised', 401)

    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return err('Unauthorised', 401)

    // ── Parse request ──────────────────────────────────────────────────────
    const { venueId, weekStart } = await req.json() as { venueId: string; weekStart: string }
    if (!venueId || !weekStart) return err('Missing venueId or weekStart', 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

    // ── Fetch all data in parallel ─────────────────────────────────────────
    const fourWeeksAgo = addDays(weekStart, -28)
    const [
      { data: requirements },
      { data: staffList },
      { data: venueRoles },
      { data: roleAssignments },
      { data: timeOffRows },
      { data: unavailRows },
      { data: closureRows },
      { data: existingShifts },
      { data: historicalShifts },
    ] = await Promise.all([
      admin.from('rota_requirements')
        .select('day_of_week, role_name, staff_count, start_time, end_time, label')
        .eq('venue_id', venueId).order('day_of_week').order('start_time'),

      admin.from('staff')
        .select('id, name, hourly_rate, working_days')
        .eq('venue_id', venueId).eq('is_active', true).order('name'),

      admin.from('venue_roles')
        .select('id, name').eq('venue_id', venueId),

      admin.from('staff_role_assignments')
        .select('staff_id, role_id'),

      admin.from('time_off_requests')
        .select('staff_id, start_date, end_date')
        .eq('venue_id', venueId).eq('status', 'approved'),

      admin.from('staff_availability')
        .select('staff_id, date, available')
        .eq('venue_id', venueId)
        .gte('date', weekStart)
        .lte('date', addDays(weekStart, 6)),

      admin.from('venue_closures')
        .select('start_date, end_date').eq('venue_id', venueId),

      admin.from('shifts')
        .select('staff_id, shift_date')
        .eq('venue_id', venueId).eq('week_start', weekStart),

      // Last 4 weeks of shifts for pattern learning
      admin.from('shifts')
        .select('staff_id, shift_date, role_label')
        .eq('venue_id', venueId)
        .gte('shift_date', fourWeeksAgo)
        .lt('shift_date', weekStart),
    ])

    if (!requirements?.length) return err('No rota requirements configured. Set them up via Configure → Auto-Fill.', 400)
    if (!staffList?.length)    return err('No active staff found.', 400)

    // ── Build role lookup ──────────────────────────────────────────────────
    const roleMap = Object.fromEntries((venueRoles ?? []).map(r => [r.id, r.name]))
    const staffRoleMap: Record<string, string[]> = {}
    for (const a of (roleAssignments ?? [])) {
      const roleName = roleMap[a.role_id]
      if (!roleName) continue
      if (!staffRoleMap[a.staff_id]) staffRoleMap[a.staff_id] = []
      staffRoleMap[a.staff_id].push(roleName)
    }

    // ── Derive closed dates ────────────────────────────────────────────────
    const closedDates = new Set<string>()
    for (const c of (closureRows ?? [])) {
      const start = new Date(c.start_date + 'T00:00:00Z')
      const end   = new Date(c.end_date   + 'T00:00:00Z')
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        closedDates.add(d.toISOString().slice(0, 10))
      }
    }

    // ── Build per-date availability ────────────────────────────────────────
    // unavailDates: Set of "staffId:date" strings
    const unavailSet = new Set<string>()
    for (const t of (timeOffRows ?? [])) {
      const s = new Date(t.start_date + 'T00:00:00Z')
      const e = new Date(t.end_date   + 'T00:00:00Z')
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        unavailSet.add(`${t.staff_id}:${d.toISOString().slice(0, 10)}`)
      }
    }
    for (const u of (unavailRows ?? [])) {
      if (u.available === false) unavailSet.add(`${u.staff_id}:${u.date}`)
    }

    // Respect per-staff working_days (1=Mon…7=Sun; empty array = all days available)
    for (const s of (staffList ?? [])) {
      const wdays = (s as any).working_days as number[] | null
      if (!wdays?.length) continue // empty = no restriction
      for (const { date, dow } of weekDates) {
        if (!wdays.includes(dow)) {
          unavailSet.add(`${s.id}:${date}`)
        }
      }
    }

    // Already has a shift this week
    const alreadyScheduled = new Set<string>()
    for (const s of (existingShifts ?? [])) {
      alreadyScheduled.add(`${s.staff_id}:${s.shift_date}`)
    }

    // ── Build the week's dates ────────────────────────────────────────────
    const weekDates: { date: string; dow: number; dayName: string }[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i)
      if (!closedDates.has(date)) {
        weekDates.push({ date, dow: i + 1, dayName: DAY_NAMES[i] })
      }
    }

    // ── Expand requirements into individual slots ─────────────────────────
    type Slot = { date: string; dayName: string; role: string; start: string; end: string; label: string }
    const slots: Slot[] = []
    for (const { date, dow, dayName } of weekDates) {
      const dayReqs = (requirements ?? []).filter(r => r.day_of_week === dow)
      for (const req of dayReqs) {
        for (let i = 0; i < (req.staff_count ?? 1); i++) {
          slots.push({
            date, dayName,
            role:  req.role_name,
            start: req.start_time.slice(0, 5),
            end:   req.end_time.slice(0, 5),
            label: req.label ?? '',
          })
        }
      }
    }

    if (!slots.length) return err('No open days with requirements found for this week.', 400)

    // ── Compute historical patterns ───────────────────────────────────────
    const hist = historicalShifts ?? []
    type PatternEntry = { shiftsWorked: number; roles: Record<string, number>; dayOfWeek: Record<number, number> }
    const patterns: Record<string, PatternEntry> = {}

    for (const s of (staffList ?? [])) {
      patterns[s.id] = { shiftsWorked: 0, roles: {}, dayOfWeek: {} }
    }
    for (const sh of hist) {
      if (!patterns[sh.staff_id]) continue
      const p = patterns[sh.staff_id]
      p.shiftsWorked++
      if (sh.role_label) p.roles[sh.role_label] = (p.roles[sh.role_label] ?? 0) + 1
      const dow = new Date(sh.shift_date + 'T00:00:00Z').getUTCDay() // 0=Sun
      const dowMon = dow === 0 ? 7 : dow // convert to 1=Mon…7=Sun
      p.dayOfWeek[dowMon] = (p.dayOfWeek[dowMon] ?? 0) + 1
    }

    const patternLines = (staffList ?? []).map(s => {
      const p = patterns[s.id]
      if (!p || p.shiftsWorked === 0) return null
      const topRoles  = Object.entries(p.roles).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r)
      const usualDays = Object.entries(p.dayOfWeek).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([d]) => DAY_NAMES[Number(d) - 1])
      return `  - ${s.name}: usually works ${usualDays.join('/')} | top roles: ${topRoles.join(', ')} | ${p.shiftsWorked} shifts in past 4 weeks`
    }).filter(Boolean)

    // ── Build Claude prompt ───────────────────────────────────────────────
    const staffLines = (staffList ?? []).map(s => {
      const roles = staffRoleMap[s.id]?.join(', ') || 'No roles assigned'
      return `  - ${s.name} (ID: ${s.id}) | Roles: ${roles}`
    }).join('\n')

    const slotLines = slots.map((sl, i) =>
      `  ${i + 1}. ${sl.dayName} ${sl.date} | Role: ${sl.role} | ${sl.start}–${sl.end}${sl.label ? ' | ' + sl.label : ''}`
    ).join('\n')

    const unavailLines: string[] = []
    for (const s of (staffList ?? [])) {
      const blocks: string[] = []
      for (const { date, dayName } of weekDates) {
        if (unavailSet.has(`${s.id}:${date}`)) blocks.push(`${dayName} ${date}`)
        if (alreadyScheduled.has(`${s.id}:${date}`)) blocks.push(`${dayName} ${date} (already scheduled)`)
      }
      if (blocks.length) unavailLines.push(`  - ${s.name}: unavailable ${blocks.join(', ')}`)
    }

    const systemPrompt = `You are an expert staff rota scheduler for a hospitality venue. Your job is to assign staff to shifts optimally.

Rules you must follow:
1. Only assign staff to roles they are qualified for (check their Roles list)
2. Never schedule a staff member on a day they are unavailable or already scheduled
3. Try to distribute hours fairly across the team where possible
4. Each slot must be filled by exactly one staff member
5. A staff member CAN work multiple slots on the same day if needed (e.g. different times)
6. If you cannot fill a slot because no qualified, available staff exists, mark it as a gap
7. Use the HISTORICAL PATTERNS as soft guidance — prefer assigning staff to roles and days they usually work, but availability and role qualifications always take priority
8. If a staff member has no shifts in the past 4 weeks, treat them as having no preference bias

Return ONLY a valid JSON object in this exact structure — no markdown, no explanation:
{
  "shifts": [
    {
      "staff_id": "<uuid>",
      "staff_name": "<name>",
      "shift_date": "<yyyy-MM-dd>",
      "start_time": "<HH:mm>",
      "end_time": "<HH:mm>",
      "role_label": "<role name>"
    }
  ],
  "gaps": [
    {
      "shift_date": "<yyyy-MM-dd>",
      "day_name": "<day>",
      "start_time": "<HH:mm>",
      "end_time": "<HH:mm>",
      "role_label": "<role name>",
      "reason": "<why it could not be filled>"
    }
  ]
}`

    const userPrompt = `Generate a rota for the week starting ${weekStart}.

STAFF:
${staffLines}

${patternLines.length ? `HISTORICAL PATTERNS (last 4 weeks — use as soft guidance):\n${patternLines.join('\n')}\n` : ''}
${unavailLines.length ? `UNAVAILABILITY:\n${unavailLines.join('\n')}\n` : 'No unavailability this week.\n'}
SLOTS TO FILL (${slots.length} total):
${slotLines}

Assign staff to fill every slot, following the rules. Return the JSON object.`

    // ── Call Claude ────────────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      return err(`AI generation failed: ${errText}`, 500)
    }

    const claudeData = await claudeRes.json()
    const rawText    = claudeData.content?.[0]?.text ?? ''

    // Parse JSON — strip any accidental markdown fences
    let parsed: { shifts: unknown[]; gaps: unknown[] }
    try {
      const clean = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return err(`AI returned invalid JSON: ${rawText.slice(0, 200)}`, 500)
    }

    return new Response(
      JSON.stringify({
        shifts: parsed.shifts ?? [],
        gaps:   parsed.gaps   ?? [],
        meta: {
          slotsRequested: slots.length,
          shiftsFilled:   (parsed.shifts ?? []).length,
          gapCount:       (parsed.gaps   ?? []).length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return err(String(e), 500)
  }
})

function err(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
