import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Logo from '../../components/ui/Logo'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { VENUE_PRESETS, DEFAULT_STAFF_PERMISSIONS } from '../../lib/constants'
import Toggle from '../../components/ui/Toggle'
import { useToast } from '../../components/ui/Toast'
import { reportError } from '../../lib/reportError'
import Button, { CloseButton } from '../../components/ui/Button'
import { IconCheck } from '../signup/SignupIcons'

// The setup wizard is drawn in the same language as the signup flow: one
// question per screen, a big tightly-tracked headline, full-width tappable
// rows and one pill button pinned to the bottom. It takes over the whole
// screen (no app nav) so the owner only sees the question in front of them.

/** Screen headline: a smaller cousin of the signup headline, so it fits a phone. */
const HEADLINE = { fontSize: 'clamp(30px, 4.5vw, 40px)', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 600 }

/** Small mono caption above a group. */
const LABEL = 'font-mono text-micro tracking-[0.12em] uppercase text-charcoal/70 dark:text-white/60'

/** Text input on a white card. */
const INPUT = 'w-full min-w-0 h-12 px-4 rounded-control border border-transparent bg-cream dark:bg-white/8 text-body-lg text-charcoal dark:text-white placeholder:text-charcoal/50 dark:placeholder:text-white/40 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 dark:focus:border-white/40 transition-all'

/** White grouped card that holds a list of rows. */
const CARD = 'bg-paper dark:bg-paperDark rounded-card ring-1 ring-charcoal/8 dark:ring-white/10'

/* ── Icons ───────────────────────────────────────────────────────────────────── */
/** @type {React.SVGProps<SVGSVGElement>} */
const svgProps = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

const VENUE_ICONS = {
  cafe: (
    <svg {...svgProps}>
      <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  pub: (
    <svg {...svgProps}>
      <path d="M17 11h1a3 3 0 010 6h-1"/><path d="M3 11l1 9h12l1-9"/><path d="M3 11V7a2 2 0 012-2h12a2 2 0 012 2v4"/>
    </svg>
  ),
  restaurant: (
    <svg {...svgProps}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  ),
  hotel: (
    <svg {...svgProps}>
      <path d="M3 22V8l9-6 9 6v14"/><path d="M6 22V12h4v10"/><path d="M14 22V12h4v10"/>
    </svg>
  ),
  other: (
    <svg {...svgProps}>
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  ),
}

function StarIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function LockIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

function InfoIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

/* ── Screen heading ──────────────────────────────────────────────────────────── */
function StepHeading({ title, children }) {
  return (
    <div className="mb-8 sm:mb-10">
      <h1 className="text-charcoal dark:text-white" style={HEADLINE}>{title}</h1>
      {children && (
        <p className="text-body-lg sm:text-title-sm text-charcoal/70 dark:text-white/60 mt-3 leading-[1.45] max-w-md">{children}</p>
      )}
    </div>
  )
}

/* ── TimeSelect (inline, no external component needed) ───────────────────────── */
const TIMES = []
for (let h = 0; h < 24; h++) {
  TIMES.push(`${String(h).padStart(2, '0')}:00`)
  TIMES.push(`${String(h).padStart(2, '0')}:30`)
}

function TimeSelect({ value, onChange, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 px-3 rounded-control bg-cream dark:bg-white/8 text-body font-medium tabular-nums text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/20 appearance-none cursor-pointer text-center min-w-[72px]"
    >
      {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

/* ── Upgrade modal ───────────────────────────────────────────────────────────── */
const FEAT_LABELS = {
  rota:      'Rota & Shift Management',
  timesheet: 'Timesheets & Payroll Export',
  training:  'Training Records',
  time_off:  'Time Off Management',
  tips:      'Tip Distribution',
  waste:     'Waste Logging',
  orders:    'Supplier Orders',
}

function UpgradeModal({ featureLabel, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-charcoal/50 z-[70] flex items-end sm:items-center justify-center sm:p-5"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-paper dark:bg-paperDark rounded-t-sheet sm:rounded-sheet p-7 pb-[max(28px,env(safe-area-inset-bottom))] sm:pb-7 w-full sm:max-w-[380px] shadow-2xl animate-[modalIn_180ms_ease]">
        <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
          <StarIcon size={24} />
        </div>
        <h2 className="text-title font-semibold tracking-tight text-center text-charcoal dark:text-white mb-2">Upgrade to Pro</h2>
        <p className="text-body text-charcoal/70 dark:text-white/60 text-center leading-relaxed mb-4">
          This feature requires Pelikn Pro — the full plan for team management, rotas, training records and more alongside your compliance tools.
        </p>
        {featureLabel && (
          <div className="text-body-sm font-semibold text-accent dark:text-accentDark text-center py-2 px-3 bg-accent/6 rounded-full mb-5">
            {featureLabel}
          </div>
        )}
        <Button variant="accent" size="lg" pill fullWidth className="mb-2">
          Upgrade to Pro · £30/mo
        </Button>
        <Button
          variant="ghost"
          size="lg"
          pill
          fullWidth
          onClick={onClose}
        >
          Maybe later
        </Button>
      </div>
    </div>
  )
}

/* ── Constants ───────────────────────────────────────────────────────────────── */
// STEPS is computed inside the component based on enabled features

const ROLE_PRESETS = {
  cafe:       ['Barista', 'Kitchen', 'FOH', 'Supervisor'],
  pub:        ['Bar Staff', 'Kitchen', 'Floor Staff', 'Supervisor'],
  restaurant: ['Chef', 'Sous Chef', 'Waiter', 'Kitchen Porter'],
  hotel:      ['Front Desk', 'Housekeeping', 'Kitchen', 'Bar Staff'],
  other:      [],
}

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/* ── Page ────────────────────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const navigate  = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const { save: saveFeatures, venuePlan } = useVenueFeatures()
  const toast = useToast()

  const isPro = venuePlan === 'pro'

  const [step, setStep] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [enabledFeatures, setEnabledFeatures] = useState(new Set(ALL_FEATURE_IDS))
  const [upgradeFeature, setUpgradeFeature] = useState(null)

  const [dayHours, setDayHours] = useState([
    { day: 'Monday',    open: true,  start: '08:00', end: '22:00' },
    { day: 'Tuesday',   open: true,  start: '08:00', end: '22:00' },
    { day: 'Wednesday', open: true,  start: '08:00', end: '22:00' },
    { day: 'Thursday',  open: true,  start: '08:00', end: '22:00' },
    { day: 'Friday',    open: true,  start: '08:00', end: '22:00' },
    { day: 'Saturday',  open: true,  start: '09:00', end: '23:00' },
    { day: 'Sunday',    open: false, start: '10:00', end: '22:00' },
  ])

  const [staffEntries, setStaffEntries] = useState([
    { name: '', pin: '', jobRole: '' },
    { name: '', pin: '', jobRole: '' },
  ])
  const [saving, setSaving] = useState(false)

  // ── Roles & Rota step state ──
  const [rolesInput, setRolesInput]           = useState([])       // string[]
  const [roleAssignments, setRoleAssignments] = useState({})       // { staffName: roleName[] }
  const [dailyCounts, setDailyCounts]         = useState({})       // { roleName: number }
  const [customRoleText, setCustomRoleText]   = useState('')

  // Dynamic steps: insert Roles & Rota between Your Team and All Set when rota is enabled
  const hasRotaStep = enabledFeatures.has('rota')
  const STEPS = hasRotaStep
    ? ['Venue Type', 'Modules', 'Hours', 'Your Team', 'Roles & Rota', 'All Set']
    : ['Venue Type', 'Modules', 'Hours', 'Your Team', 'All Set']

  /* ── Helpers ── */
  const selectPreset = (preset) => {
    setSelectedPreset(preset)
    const features = preset.features ? new Set(preset.features) : new Set(ALL_FEATURE_IDS)
    setEnabledFeatures(features)
  }

  const toggleFeature = (id) => {
    if (PRO_ONLY_FEATURE_IDS.includes(id) && !isPro) { setUpgradeFeature(id); return }
    setEnabledFeatures(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const updateDay = (i, patch) =>
    setDayHours(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))

  const applyFirstToAll = () => {
    const first = dayHours.find(d => d.open)
    if (!first) return
    setDayHours(prev => prev.map(d => d.open ? { ...d, start: first.start, end: first.end } : d))
  }

  const updateStaff = (idx, field, value) =>
    setStaffEntries(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))

  const toggleRole = (roleName) => {
    const trimmed = roleName.trim()
    if (!trimmed) return
    if (rolesInput.includes(trimmed)) {
      setRolesInput(prev => prev.filter(r => r !== trimmed))
      setDailyCounts(prev => { const n = { ...prev }; delete n[trimmed]; return n })
    } else {
      setRolesInput(prev => [...prev, trimmed])
      setDailyCounts(prev => ({ ...prev, [trimmed]: 1 }))
    }
  }

  const addCustomRole = () => {
    const trimmed = customRoleText.trim()
    if (!trimmed || rolesInput.includes(trimmed)) { setCustomRoleText(''); return }
    setRolesInput(prev => [...prev, trimmed])
    setDailyCounts(prev => ({ ...prev, [trimmed]: 1 }))
    setCustomRoleText('')
  }

  const toggleStaffRole = (staffName, roleName) => {
    setRoleAssignments(prev => {
      const current = prev[staffName] ?? []
      const next = current.includes(roleName)
        ? current.filter(r => r !== roleName)
        : [...current, roleName]
      return { ...prev, [staffName]: next }
    })
  }

  const addStaffRow = () => {
    if (staffEntries.length >= 10) return
    setStaffEntries(prev => [...prev, { name: '', pin: '', jobRole: '' }])
  }

  const removeStaffRow = (idx) => {
    if (staffEntries.length <= 1) return
    setStaffEntries(prev => prev.filter((_, i) => i !== idx))
  }

  // The wizard writes a dozen things in one go. Each failure is collected
  // here (and reported) so finishing can say what didn't save instead of
  // landing on the dashboard as if everything had.
  const failedSteps = new Set()
  const track = (label, error) => {
    if (!error) return
    failedSteps.add(label)
    reportError(error, `OnboardingPage:${label}`)
  }

  const saveModules = async () => {
    const enabled = [...enabledFeatures].filter(id => !PRO_ONLY_FEATURE_IDS.includes(id) || isPro)
    track('modules', await saveFeatures({ mode: 'custom', enabled }))
  }

  const saveTeam = async () => {
    const valid = staffEntries.filter(s => s.name.trim() && s.pin.length === 4)
    const created = [] // [{ id, name }]
    for (const entry of valid) {
      const { error } = await supabase.rpc('create_staff_member', {
        p_session_token: session.token,
        p_name:          entry.name.trim(),
        p_job_role:      entry.jobRole ? entry.jobRole.toLowerCase().replace(/\s+/g, '_') : null,
        p_pin:           entry.pin,
        p_role:          'staff',
        p_email:         null,
        p_hourly_rate:   0,
        p_skills:        [],
      })
      if (error) {
        toast(`Failed to add ${entry.name}: ${error.message}`, 'error')
      } else {
        const { data: newRow, error: lookupErr } = await supabase
          .from('staff').select('id')
          .eq('venue_id', venueId).eq('name', entry.name.trim())
          .order('created_at', { ascending: false }).limit(1)
        track('staff permissions', lookupErr)
        if (newRow?.[0]?.id) {
          const { error: permErr } = await supabase.from('staff_permissions').insert(
            DEFAULT_STAFF_PERMISSIONS.map(p => ({ staff_id: newRow[0].id, venue_id: venueId, permission: p }))
          )
          track('staff permissions', permErr)
          created.push({ id: newRow[0].id, name: entry.name.trim() })
        }
      }
    }
    return created
  }

  const saveRotaStep = async (createdStaff) => {
    if (rolesInput.length === 0) return

    // 1. Insert venue roles
    const insertedRoles = []
    for (const roleName of rolesInput) {
      const { data, error } = await supabase
        .from('venue_roles')
        .insert({ venue_id: venueId, name: roleName, sort_order: rolesInput.indexOf(roleName) })
        .select('id, name')
        .single()
      if (!error && data) insertedRoles.push(data)
      else track('rota roles', error ?? new Error(`venue_roles insert returned no row for ${roleName}`))
    }

    // 2. Assign roles to staff
    const roleByName = Object.fromEntries(insertedRoles.map(r => [r.name, r.id]))
    const assignments = []
    for (const member of createdStaff) {
      const assignedRoles = roleAssignments[member.name] ?? []
      for (const roleName of assignedRoles) {
        const roleId = roleByName[roleName]
        if (roleId) assignments.push({ staff_id: member.id, role_id: roleId, venue_id: venueId })
      }
    }
    if (assignments.length > 0) {
      const { error } = await supabase.from('staff_role_assignments').insert(assignments)
      track('role assignments', error)
    }

    // 3. Create rota requirements for each open day × each role
    const requirements = []
    dayHours.forEach((day, i) => {
      if (!day.open) return
      const dow = i + 1 // 1=Mon … 7=Sun
      for (const role of insertedRoles) {
        const count = dailyCounts[role.name] ?? 1
        if (count > 0) {
          requirements.push({
            venue_id:    venueId,
            day_of_week: dow,
            role_id:     role.id,
            role_name:   role.name,
            staff_count: count,
            start_time:  day.start + ':00',
            end_time:    day.end + ':00',
          })
        }
      }
    })
    if (requirements.length > 0) {
      const { error } = await supabase.from('rota_requirements').insert(requirements)
      track('rota requirements', error)
    }
  }

  const finishSetup = async () => {
    setSaving(true)
    failedSteps.clear()
    if (selectedPreset) {
      const { error } = await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_type', value: selectedPreset.id }, { onConflict: 'venue_id,key' })
      track('venue type', error)
    }
    const [, dayHoursRes] = await Promise.all([
      saveModules(),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'day_hours', value: JSON.stringify(dayHours) }, { onConflict: 'venue_id,key' }),
    ])
    track('opening hours', dayHoursRes.error)
    // Backward compat: write legacy open_time / close_time / closed_days
    const firstOpen = dayHours.find(d => d.open)
    if (firstOpen) {
      const legacy = await Promise.all([
        supabase.from('app_settings').upsert({ venue_id: venueId, key: 'open_time',   value: JSON.stringify(firstOpen.start) }, { onConflict: 'venue_id,key' }),
        supabase.from('app_settings').upsert({ venue_id: venueId, key: 'close_time',  value: JSON.stringify(firstOpen.end) },   { onConflict: 'venue_id,key' }),
        supabase.from('app_settings').upsert({ venue_id: venueId, key: 'closed_days', value: JSON.stringify(dayHours.map((d, i) => d.open ? null : i).filter(x => x !== null)) }, { onConflict: 'venue_id,key' }),
      ])
      for (const { error } of legacy) track('opening hours', error)
    }
    const createdStaff = await saveTeam()
    if (hasRotaStep) await saveRotaStep(createdStaff)
    const { error: completeErr } = await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'onboarding_complete', value: 'true' }, { onConflict: 'venue_id,key' })
    // Not shown to the user: the worst case is the wizard offering itself again.
    if (completeErr) reportError(completeErr, 'OnboardingPage:onboarding_complete')
    setSaving(false)
    if (failedSteps.size > 0) {
      toast(`Setup finished, but some parts didn't save (${[...failedSteps].join(', ')}). You can set them in Settings.`, 'warning')
    }
    navigate(`/v/${venueSlug}/dashboard`)
  }

  const skipSetup = async () => {
    const { error } = await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'onboarding_complete', value: 'true' }, { onConflict: 'venue_id,key' })
    // Not shown to the user: the worst case is the wizard offering itself again.
    if (error) reportError(error, 'OnboardingPage:skip')
    navigate(`/v/${venueSlug}/dashboard`, { replace: true })
  }

  const canAdvance = () => step === 0 ? !!selectedPreset : true

  const next = async () => {
    if (step === STEPS.length - 1) { await finishSetup(); return }
    setStep(s => s + 1)
  }

  const validStaffCount = staffEntries.filter(s => s.name.trim() && s.pin.length === 4).length
  const openDayCount = dayHours.filter(d => d.open).length
  const enabledCount = [...enabledFeatures].filter(id => !PRO_ONLY_FEATURE_IDS.includes(id) || isPro).length

  // Each screen starts at the top, like turning a page.
  const scrollRef = useRef(null)
  useEffect(() => { scrollRef.current?.scrollTo?.(0, 0) }, [step])

  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100
  const canSkipStep = step === 3 || (step === 4 && hasRotaStep)

  // Rendered into <body>: the app shell fades each page in with a transform,
  // which would pin a `fixed` screen to the page instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-cream dark:bg-bgDark flex flex-col font-sans text-charcoal dark:text-white">

      {/* Upgrade modal */}
      {upgradeFeature && (
        <UpgradeModal
          featureLabel={FEAT_LABELS[upgradeFeature]}
          onClose={() => setUpgradeFeature(null)}
        />
      )}

      {/* Top bar: back, progress, skip */}
      <div className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="max-w-[560px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          {step > 0 && !isLast ? (
            <Button variant="ghost" iconOnly pill aria-label="Back" className="-ml-2" onClick={() => setStep(s => s - 1)}>
              <BackIcon />
            </Button>
          ) : (
            <div className="w-10 flex items-center -ml-0.5"><Logo height={24} /></div>
          )}
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
            className="flex-1 h-1 rounded-full bg-charcoal/10 dark:bg-white/12 overflow-hidden"
          >
            <div className="h-full rounded-full bg-brand dark:bg-white transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          {!isLast ? (
            <Button variant="ghost" size="sm" pill className="-mr-2" onClick={skipSetup}>
              Skip setup
            </Button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div key={step} className="w-full max-w-[560px] mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-10 animate-fade-in">

          {!isLast && (
            <p className={`${LABEL} mb-4`}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
          )}

          {/* Step 0: Venue Type */}
          {step === 0 && (
            <div>
              <StepHeading title="What kind of venue are you?">
                We'll switch on the right tools for you. You can change this any time in Settings.
              </StepHeading>
              <div role="radiogroup" aria-label="Venue type" className="flex flex-col gap-3">
                {VENUE_PRESETS.map(preset => {
                  const on = selectedPreset?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => selectPreset(preset)}
                      className={[
                        'w-full flex items-center gap-4 p-4 rounded-card text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand',
                        'bg-paper dark:bg-paperDark',
                        on
                          ? 'ring-2 ring-charcoal dark:ring-white'
                          : 'ring-1 ring-charcoal/8 dark:ring-white/10 hover:ring-charcoal/25 dark:hover:ring-white/30',
                      ].join(' ')}
                    >
                      <span className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-brand text-cream dark:bg-white dark:text-charcoal' : 'bg-cream text-brand dark:bg-white/10 dark:text-white'}`}>
                        {VENUE_ICONS[preset.icon]}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-body-lg font-semibold text-charcoal dark:text-white">{preset.label}</span>
                        <span className="block text-body-sm text-charcoal/70 dark:text-white/60 mt-0.5 leading-snug">{preset.description}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${on ? 'bg-charcoal text-cream dark:bg-white dark:text-charcoal' : 'border-2 border-charcoal/15 dark:border-white/25'}`}
                      >
                        {on && <IconCheck size={12} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 1: Modules */}
          {step === 1 && (
            <div>
              <StepHeading title="Choose your tools">
                Pre-selected for your venue type. Switch on what you need{!isPro ? ' — Pro features unlock with an upgrade.' : '.'}
              </StepHeading>
              <div className="flex flex-col gap-8">
                {FEATURE_GROUPS.map(group => {
                  const allPro = group.features.every(f => PRO_ONLY_FEATURE_IDS.includes(f.id))

                  if (allPro && !isPro) {
                    return (
                      <div key={group.id}>
                        <p className={`${LABEL} mb-3 flex items-center gap-2`}>
                          {group.label}
                          <span className="font-bold text-accent dark:text-accentDark bg-accent/10 px-2 py-0.5 rounded-full">Pro</span>
                        </p>
                        <div className={`${CARD} overflow-hidden`}>
                          <div className="flex items-center gap-3 p-4 bg-accent/[0.06]">
                            <div className="w-10 h-10 rounded-full bg-accent/12 text-accent dark:text-accentDark flex items-center justify-center shrink-0">
                              <StarIcon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-body font-semibold text-charcoal dark:text-white">Available on Pro</p>
                              <p className="text-body-sm text-charcoal/70 dark:text-white/60">Unlock {group.label} for £30/mo</p>
                            </div>
                            <Button
                              variant="accent"
                              size="sm"
                              pill
                              onClick={() => setUpgradeFeature(group.features[0].id)}
                            >
                              Upgrade
                            </Button>
                          </div>
                          {group.features.map(feature => (
                            <div key={feature.id} className="flex items-center justify-between gap-3 px-4 py-3.5 border-t border-charcoal/6 dark:border-white/6">
                              <div className="min-w-0 flex-1 opacity-70">
                                <p className="text-body-lg text-charcoal dark:text-white">{feature.label}</p>
                                <p className="text-body-sm text-charcoal/70 dark:text-white/60 mt-0.5">{feature.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setUpgradeFeature(feature.id)}
                                className="flex items-center gap-1.5 text-caption font-semibold text-accent dark:text-accentDark bg-accent/8 px-3 h-8 rounded-full shrink-0 hover:bg-accent/14 transition-colors"
                              >
                                <LockIcon size={10} />
                                Pro
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={group.id}>
                      <p className={`${LABEL} mb-3`}>{group.label}</p>
                      <div className={`${CARD} divide-y divide-charcoal/6 dark:divide-white/6`}>
                        {group.features.map(feature => {
                          const isProLocked = PRO_ONLY_FEATURE_IDS.includes(feature.id) && !isPro
                          return (
                            <div key={feature.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                              <div className={`min-w-0 flex-1 ${isProLocked ? 'opacity-70' : ''}`}>
                                <p className="text-body-lg text-charcoal dark:text-white">{feature.label}</p>
                                <p className="text-body-sm text-charcoal/70 dark:text-white/60 mt-0.5">{feature.description}</p>
                              </div>
                              {isProLocked ? (
                                <button
                                  type="button"
                                  onClick={() => setUpgradeFeature(feature.id)}
                                  className="flex items-center gap-1.5 text-caption font-semibold text-accent dark:text-accentDark bg-accent/8 px-3 h-8 rounded-full shrink-0 hover:bg-accent/14 transition-colors"
                                >
                                  <LockIcon size={10} />
                                  Pro
                                </button>
                              ) : (
                                <Toggle
                                  aria-label={feature.label}
                                  checked={enabledFeatures.has(feature.id)}
                                  onChange={() => toggleFeature(feature.id)}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Hours */}
          {step === 2 && (
            <div>
              <StepHeading title="When are you open?">
                Used for rota planning, clock-in and your check schedules.
              </StepHeading>
              <div className={`${CARD} divide-y divide-charcoal/6 dark:divide-white/6`}>
                {dayHours.map((d, i) => (
                  <div key={d.day} className="flex items-center gap-3 px-4 min-h-[60px] py-2.5">
                    <Toggle aria-label={`${d.day} open`} checked={d.open} onChange={v => updateDay(i, { open: v })} />
                    <span className={`text-body-lg font-medium w-10 sm:w-24 shrink-0 ${d.open ? 'text-charcoal dark:text-white' : 'text-charcoal/50 dark:text-white/40'}`}>
                      <span className="sm:hidden">{d.day.slice(0, 3)}</span>
                      <span className="hidden sm:inline">{d.day}</span>
                    </span>
                    {d.open ? (
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <TimeSelect label={`${d.day} opening time`} value={d.start} onChange={v => updateDay(i, { start: v })} />
                        <span className="text-charcoal/50 dark:text-white/40 text-body">–</span>
                        <TimeSelect label={`${d.day} closing time`} value={d.end} onChange={v => updateDay(i, { end: v })} />
                      </div>
                    ) : (
                      <span className="text-charcoal/60 dark:text-white/50 text-body flex-1 text-right">Closed</span>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={applyFirstToAll}
                className="mt-4"
              >
                Copy the first open day's hours to every open day
              </Button>
            </div>
          )}

          {/* Step 3: Team */}
          {step === 3 && (
            <div>
              <StepHeading title="Add your team">
                Add a few people now so they can sign in with their PIN.
              </StepHeading>
              <div className="flex flex-col gap-3">
                {staffEntries.map((entry, idx) => (
                  <div key={idx} className={`${CARD} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className={LABEL}>Person {idx + 1}</p>
                      <CloseButton label="Remove staff member" className="-my-2 -mr-2" onClick={() => removeStaffRow(idx)} />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                      <input
                        aria-label={`Person ${idx + 1} name`}
                        value={entry.name}
                        onChange={e => updateStaff(idx, 'name', e.target.value)}
                        placeholder="Name"
                        className={`${INPUT} col-span-2`}
                      />
                      <input
                        type="text"
                        aria-label={`Person ${idx + 1} job role`}
                        value={entry.jobRole}
                        onChange={e => updateStaff(idx, 'jobRole', e.target.value)}
                        placeholder="Role, e.g. Manager"
                        className={INPUT}
                      />
                      <input
                        type="password"
                        aria-label={`Person ${idx + 1} 4-digit PIN`}
                        inputMode="numeric"
                        maxLength={4}
                        value={entry.pin}
                        onChange={e => updateStaff(idx, 'pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="PIN"
                        className={`${INPUT} tracking-widest text-center`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {staffEntries.length < 10 && (
                <Button
                  variant="secondary"
                  size="lg"
                  pill
                  fullWidth
                  onClick={addStaffRow}
                  className="mt-3"
                >
                  + Add another person
                </Button>
              )}
              <div className="flex items-start gap-2.5 mt-6 text-body-sm text-charcoal/70 dark:text-white/60 leading-relaxed">
                <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Each person needs a name and a 4-digit PIN. You can add more people, permissions and roles later in <strong className="font-semibold text-charcoal dark:text-white">Team → Staff</strong>.</span>
              </div>
            </div>
          )}

          {/* Step 4: Roles & Rota (conditional) */}
          {step === 4 && hasRotaStep && (() => {
            const validStaff = staffEntries.filter(s => s.name.trim() && s.pin.length === 4)
            const presetRoles = ROLE_PRESETS[selectedPreset?.id] ?? []
            const customRoles = rolesInput.filter(r => !presetRoles.includes(r))
            return (
              <div>
                <StepHeading title="What roles do you have?">
                  Used to match people to the right shifts when your rota fills itself in.
                </StepHeading>

                {/* Section A: Define roles */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[...presetRoles, ...customRoles].map(role => {
                    const active = rolesInput.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleRole(role)}
                        className={[
                          'inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-body font-medium transition-all',
                          active
                            ? 'bg-charcoal text-cream dark:bg-white dark:text-charcoal'
                            : 'bg-paper dark:bg-paperDark text-charcoal dark:text-white ring-1 ring-charcoal/12 dark:ring-white/15 hover:ring-charcoal/30 dark:hover:ring-white/30',
                        ].join(' ')}
                      >
                        {active && <IconCheck size={13} />}{role}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Custom role name"
                    value={customRoleText}
                    onChange={e => setCustomRoleText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomRole()}
                    placeholder="Add your own role…"
                    className={`${INPUT} flex-1 bg-paper dark:bg-paperDark ring-1 ring-charcoal/8 dark:ring-white/10`}
                  />
                  <Button
                    variant="secondary"
                    size="lg"
                    pill
                    onClick={addCustomRole}
                    disabled={!customRoleText.trim()}
                  >
                    Add
                  </Button>
                </div>

                {/* Section B: Assign roles to staff */}
                {rolesInput.length > 0 && validStaff.length > 0 && (
                  <div className="mt-10">
                    <h2 className="text-title font-semibold tracking-tight text-charcoal dark:text-white">Who can work each role?</h2>
                    <p className="text-body text-charcoal/70 dark:text-white/60 mt-1 mb-4">Tick the roles each person can cover.</p>
                    <div className="flex flex-col gap-3">
                      {validStaff.map(member => {
                        const assigned = roleAssignments[member.name] ?? []
                        return (
                          <div key={member.name} className={`${CARD} p-4`}>
                            <p className="text-body-lg font-semibold text-charcoal dark:text-white mb-3">{member.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {rolesInput.map(role => {
                                const checked = assigned.includes(role)
                                return (
                                  <button
                                    key={role}
                                    type="button"
                                    aria-pressed={checked}
                                    onClick={() => toggleStaffRole(member.name, role)}
                                    className={[
                                      'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-body-sm font-medium transition-all',
                                      checked
                                        ? 'bg-brand text-white dark:bg-white dark:text-charcoal'
                                        : 'bg-cream dark:bg-white/8 text-charcoal/70 dark:text-white/60 hover:text-charcoal dark:hover:text-white',
                                    ].join(' ')}
                                  >
                                    {checked && <IconCheck size={12} />}{role}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Section C: Daily counts */}
                {rolesInput.length > 0 && (
                  <div className="mt-10">
                    <h2 className="text-title font-semibold tracking-tight text-charcoal dark:text-white">How many of each per day?</h2>
                    <p className="text-body text-charcoal/70 dark:text-white/60 mt-1 mb-4">Used for every open day when filling in your rota.</p>
                    <div className={`${CARD} divide-y divide-charcoal/6 dark:divide-white/6`}>
                      {rolesInput.map(role => (
                        <div key={role} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="text-body-lg font-medium text-charcoal dark:text-white">{role}</span>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="secondary"
                              iconOnly
                              pill
                              aria-label={`Fewer ${role}`}
                              onClick={() => setDailyCounts(prev => ({ ...prev, [role]: Math.max(1, (prev[role] ?? 1) - 1) }))}
                            >−</Button>
                            <span className="w-6 text-center text-title-sm font-semibold text-charcoal dark:text-white tabular-nums">{dailyCounts[role] ?? 1}</span>
                            <Button
                              variant="secondary"
                              iconOnly
                              pill
                              aria-label={`More ${role}`}
                              onClick={() => setDailyCounts(prev => ({ ...prev, [role]: (prev[role] ?? 1) + 1 }))}
                            >+</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rolesInput.length === 0 && (
                  <p className="mt-8 text-body text-charcoal/70 dark:text-white/60">Pick at least one role, or skip this step and set roles up later in Settings.</p>
                )}
              </div>
            )
          })()}

          {/* Step 4/5: All Set */}
          {isLast && (
            <div className="pt-4 sm:pt-8">
              <div className="w-20 h-20 rounded-full bg-goodBg dark:bg-good/20 text-good dark:text-goodDark flex items-center justify-center mb-8">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <StepHeading title="You're all set">
                Your venue is ready to go. Everything can be changed in Settings at any time.
              </StepHeading>
              <div className={`${CARD} divide-y divide-charcoal/6 dark:divide-white/6`}>
                {selectedPreset && (
                  <div className="flex items-center gap-4 px-4 py-4">
                    <span className="w-10 h-10 rounded-full bg-brand text-cream dark:bg-white dark:text-charcoal flex items-center justify-center shrink-0 [&_svg]:w-5 [&_svg]:h-5">
                      {VENUE_ICONS[selectedPreset.icon]}
                    </span>
                    <span className="text-body-lg font-semibold text-charcoal dark:text-white flex-1">{selectedPreset.label}</span>
                  </div>
                )}
                {[
                  { label: 'Tools switched on', value: `${enabledCount} feature${enabledCount !== 1 ? 's' : ''}` },
                  { label: 'Open', value: `${openDayCount} day${openDayCount !== 1 ? 's' : ''} a week` },
                  ...(validStaffCount > 0 ? [{ label: 'Team', value: `${validStaffCount} ${validStaffCount !== 1 ? 'people' : 'person'}` }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-4 px-4 py-4">
                    <span className="w-10 h-10 rounded-full bg-goodBg dark:bg-good/20 text-good dark:text-goodDark flex items-center justify-center shrink-0">
                      <IconCheck size={16} />
                    </span>
                    <span className="text-body-lg text-charcoal dark:text-white flex-1">{row.label}</span>
                    <span className="text-body text-charcoal/70 dark:text-white/60">{row.value}</span>
                  </div>
                ))}
              </div>
              {!isPro && (
                <div className="mt-4 flex items-center gap-3 p-4 rounded-card bg-accentBg dark:bg-accent/15">
                  <div className="w-10 h-10 rounded-full bg-accent/12 text-accent dark:text-accentDark flex items-center justify-center shrink-0">
                    <StarIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-semibold text-accent dark:text-accentDark">Unlock Pro features</p>
                    <p className="text-body-sm text-charcoal/70 dark:text-white/60 mt-0.5">Rota, timesheets, training records, time off and more</p>
                  </div>
                  <Button
                    variant="accent"
                    size="sm"
                    pill
                    onClick={() => setUpgradeFeature('rota')}
                  >
                    Upgrade
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Pinned footer: one main action */}
      <div className="shrink-0 bg-cream dark:bg-bgDark border-t border-charcoal/6 dark:border-white/8 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="max-w-[560px] mx-auto px-4 sm:px-6 flex flex-col gap-1">
          <Button
            size="lg"
            pill
            fullWidth
            loading={saving}
            onClick={next}
            disabled={!canAdvance() || saving}
          >
            {isLast
              ? (saving ? 'Setting up…' : 'Go to Dashboard')
              : step === STEPS.length - 2
                ? 'Finish setup'
                : 'Continue'
            }
          </Button>
          {canSkipStep && (
            <Button
              variant="ghost"
              size="lg"
              pill
              fullWidth
              onClick={() => setStep(s => s + 1)}
            >
              Skip this step
            </Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
