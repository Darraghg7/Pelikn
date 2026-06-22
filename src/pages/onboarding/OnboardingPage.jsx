import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { VENUE_PRESETS, DEFAULT_STAFF_PERMISSIONS } from '../../lib/constants'
import Toggle from '../../components/ui/Toggle'
import { useToast } from '../../components/ui/Toast'

/* ── Icons ───────────────────────────────────────────────────────────────────── */
const VENUE_ICONS = {
  cafe: (
    <div className="w-9 h-9 rounded-[9px] bg-brand/8 text-brand flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    </div>
  ),
  pub: (
    <div className="w-9 h-9 rounded-[9px] bg-brand/8 text-brand flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 11h1a3 3 0 010 6h-1"/><path d="M3 11l1 9h12l1-9"/><path d="M3 11V7a2 2 0 012-2h12a2 2 0 012 2v4"/>
      </svg>
    </div>
  ),
  restaurant: (
    <div className="w-9 h-9 rounded-[9px] bg-brand/8 text-brand flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/>
        <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
      </svg>
    </div>
  ),
  hotel: (
    <div className="w-9 h-9 rounded-[9px] bg-brand/8 text-brand flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22V8l9-6 9 6v14"/><path d="M6 22V12h4v10"/><path d="M14 22V12h4v10"/>
      </svg>
    </div>
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

/* ── MiniToggle ──────────────────────────────────────────────────────────────── */
function MiniToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-8 h-[18px] rounded-full border-none transition-colors duration-200 ${checked ? 'bg-brand' : 'bg-charcoal/15'}`}
    >
      <span
        className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[17px]' : 'left-[3px]'}`}
      />
    </button>
  )
}

/* ── TimeSelect (inline, no external component needed) ───────────────────────── */
const TIMES = []
for (let h = 0; h < 24; h++) {
  TIMES.push(`${String(h).padStart(2, '0')}:00`)
  TIMES.push(`${String(h).padStart(2, '0')}:30`)
}

function TimeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg border border-charcoal/15 bg-white text-[12.5px] text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/20 appearance-none cursor-pointer min-w-[80px]"
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
      className="fixed inset-0 bg-charcoal/50 z-50 flex items-center justify-center p-5"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-[20px] p-7 w-full max-w-[340px] shadow-2xl animate-[modalIn_180ms_ease]">
        <div className="w-12 h-12 rounded-[14px] bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3.5">
          <StarIcon size={22} />
        </div>
        <h2 className="text-[16px] font-bold text-center mb-1.5">Upgrade to Pro</h2>
        <p className="text-[12.5px] text-charcoal/45 text-center leading-relaxed mb-3.5">
          This feature requires Pelikn Pro — the full plan for team management, rotas, training records and more alongside your compliance tools.
        </p>
        {featureLabel && (
          <div className="text-[12px] font-bold text-accent text-center py-2 px-3 bg-accent/6 rounded-[10px] mb-4">
            {featureLabel}
          </div>
        )}
        <button className="w-full py-3 rounded-xl border-none bg-accent text-white text-[13px] font-bold mb-2 hover:opacity-87 transition-opacity">
          Upgrade to Pro · £25/mo
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-charcoal/12 text-charcoal/50 text-[12.5px] font-semibold hover:border-charcoal/25 hover:text-charcoal transition-all"
        >
          Maybe later
        </button>
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

  const saveModules = async () => {
    const enabled = [...enabledFeatures].filter(id => !PRO_ONLY_FEATURE_IDS.includes(id) || isPro)
    await saveFeatures({ mode: 'custom', enabled })
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
        const { data: newRow } = await supabase
          .from('staff').select('id')
          .eq('venue_id', venueId).eq('name', entry.name.trim())
          .order('created_at', { ascending: false }).limit(1)
        if (newRow?.[0]?.id) {
          await supabase.from('staff_permissions').insert(
            DEFAULT_STAFF_PERMISSIONS.map(p => ({ staff_id: newRow[0].id, venue_id: venueId, permission: p }))
          )
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
    }

    // 2. Assign roles to staff
    const roleByName = Object.fromEntries(insertedRoles.map(r => [r.name, r.id]))
    const assignments = []
    for (const member of createdStaff) {
      const assignedRoles = roleAssignments[member.name] ?? []
      for (const roleName of assignedRoles) {
        const roleId = roleByName[roleName]
        if (roleId) assignments.push({ staff_id: member.id, role_id: roleId })
      }
    }
    if (assignments.length > 0) {
      await supabase.from('staff_role_assignments').insert(assignments)
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
      await supabase.from('rota_requirements').insert(requirements)
    }
  }

  const finishSetup = async () => {
    setSaving(true)
    if (selectedPreset) {
      await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_type', value: selectedPreset.id }, { onConflict: 'venue_id,key' })
    }
    await Promise.all([
      saveModules(),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'day_hours', value: JSON.stringify(dayHours) }, { onConflict: 'venue_id,key' }),
    ])
    // Backward compat: write legacy open_time / close_time / closed_days
    const firstOpen = dayHours.find(d => d.open)
    if (firstOpen) {
      await Promise.all([
        supabase.from('app_settings').upsert({ venue_id: venueId, key: 'open_time',   value: JSON.stringify(firstOpen.start) }, { onConflict: 'venue_id,key' }),
        supabase.from('app_settings').upsert({ venue_id: venueId, key: 'close_time',  value: JSON.stringify(firstOpen.end) },   { onConflict: 'venue_id,key' }),
        supabase.from('app_settings').upsert({ venue_id: venueId, key: 'closed_days', value: JSON.stringify(dayHours.map((d, i) => d.open ? null : i).filter(x => x !== null)) }, { onConflict: 'venue_id,key' }),
      ])
    }
    const createdStaff = await saveTeam()
    if (hasRotaStep) await saveRotaStep(createdStaff)
    await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'onboarding_complete', value: 'true' }, { onConflict: 'venue_id,key' })
    setSaving(false)
    navigate(`/v/${venueSlug}/dashboard`)
  }

  const skipSetup = async () => {
    await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'onboarding_complete', value: 'true' }, { onConflict: 'venue_id,key' })
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

  return (
    <div className="min-h-dvh bg-surface flex flex-col font-sans">

      {/* Upgrade modal */}
      {upgradeFeature && (
        <UpgradeModal
          featureLabel={FEAT_LABELS[upgradeFeature]}
          onClose={() => setUpgradeFeature(null)}
        />
      )}

      {/* Topbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-charcoal/8 h-[52px] flex items-center justify-between px-5 shrink-0">
        <span className="font-extrabold text-[16px] text-brand tracking-tight">Pelikn</span>
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-md ${isPro ? 'bg-accent/12 text-accent' : 'bg-brand/9 text-brand'}`}>
            {isPro ? 'Pro' : 'Starter'}
          </span>
          <div className="flex items-center gap-1 text-charcoal/30" style={{ fontFamily: 'DM Mono, monospace', fontSize: 9.5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Secure setup
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="bg-white border-b border-charcoal/8 px-5 py-2.5 shrink-0">
        <div className="flex items-start max-w-[540px] mx-auto">
          {STEPS.map((label, i) => {
            const state = i < step ? 'done' : i === step ? 'cur' : 'todo'
            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => { if (i < step) setStep(i) }}
                    className={[
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-none shrink-0 transition-all',
                      state === 'done' ? 'bg-brand text-white cursor-pointer' :
                      state === 'cur'  ? 'bg-brand text-white shadow-[0_0_0_4px_rgba(45,79,69,0.15)]' :
                                         'bg-charcoal/12 text-charcoal/40 cursor-default',
                    ].join(' ')}
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {state === 'done'
                      ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                      : i + 1
                    }
                  </button>
                  <span className={`text-[9px] font-semibold tracking-wider uppercase hidden sm:block whitespace-nowrap ${state === 'todo' ? 'text-charcoal/30' : 'text-brand'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-[1.5px] mx-1 mb-3.5 sm:mb-[14px] transition-colors ${state === 'done' ? 'bg-brand' : 'bg-charcoal/14'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-[540px] mx-auto px-5 pt-6 pb-32">

          {/* Step 0: Venue Type */}
          {step === 0 && (
            <div>
              <h1 className="text-[19px] font-bold text-charcoal mb-1 tracking-tight">What kind of venue are you?</h1>
              <p className="text-[12.5px] text-charcoal/45 mb-[18px] leading-relaxed">
                We'll pre-select the right modules for your business. You can change this any time in Settings.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {VENUE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset)}
                    className={[
                      'p-4 rounded-[14px] border-2 text-left flex items-start gap-3 transition-all',
                      selectedPreset?.id === preset.id
                        ? 'border-brand bg-brand/[0.04]'
                        : 'border-charcoal/12 bg-white hover:border-charcoal/30',
                    ].join(' ')}
                  >
                    <div>{VENUE_ICONS[preset.icon]}</div>
                    <div>
                      <p className="font-bold text-[13px] text-charcoal mb-0.5">{preset.label}</p>
                      <p className="text-[10.5px] text-charcoal/40 leading-[1.4]">{preset.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Modules */}
          {step === 1 && (
            <div>
              <h1 className="text-[19px] font-bold text-charcoal mb-1 tracking-tight">Choose your modules</h1>
              <p className="text-[12.5px] text-charcoal/45 mb-[18px] leading-relaxed">
                Pre-selected based on your venue type. Toggle what you need{!isPro ? ' — Pro features can be unlocked with an upgrade.' : '.'}
              </p>
              {FEATURE_GROUPS.map(group => {
                const allPro = group.features.every(f => PRO_ONLY_FEATURE_IDS.includes(f.id))

                if (allPro && !isPro) {
                  return (
                    <div key={group.id} className="mb-5">
                      <p className="text-[9.5px] tracking-[0.12em] uppercase text-charcoal/40 mb-1.5 flex items-center gap-2 px-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {group.label}
                        <span className="text-[8.5px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-accent/12 text-accent">Pro only</span>
                      </p>
                      <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 bg-accent/[0.06] border-b border-accent/10">
                          <div className="w-7 h-7 rounded-lg bg-accent/12 text-accent flex items-center justify-center shrink-0">
                            <StarIcon size={14} />
                          </div>
                          <div className="flex-1">
                            <p className="text-[12px] font-bold text-charcoal">Available on Pro</p>
                            <p className="text-[10.5px] text-charcoal/40 mt-0.5">Unlock {group.label} for £25/mo</p>
                          </div>
                          <button
                            onClick={() => setUpgradeFeature(group.features[0].id)}
                            className="text-[11px] font-bold text-white bg-accent px-3 py-1.5 rounded-lg shrink-0 hover:opacity-87 transition-opacity"
                          >
                            Upgrade
                          </button>
                        </div>
                        {group.features.map(feature => (
                          <div key={feature.id} className="flex items-center justify-between px-4 py-3 border-b border-charcoal/5 last:border-b-0 bg-charcoal/[0.018] opacity-70">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-charcoal/50">{feature.label}</p>
                              <p className="text-[11px] text-charcoal/25 mt-0.5">{feature.description}</p>
                            </div>
                            <button
                              onClick={() => setUpgradeFeature(feature.id)}
                              className="flex items-center gap-1.5 text-[10.5px] font-bold text-accent bg-accent/8 border border-accent/18 px-2.5 py-1 rounded-lg ml-3 shrink-0 hover:bg-accent/14 transition-colors"
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
                  <div key={group.id} className="mb-5">
                    <p className="text-[9.5px] tracking-[0.12em] uppercase text-charcoal/40 mb-1.5 px-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {group.label}
                    </p>
                    <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden">
                      {group.features.map(feature => {
                        const isProLocked = PRO_ONLY_FEATURE_IDS.includes(feature.id) && !isPro
                        return (
                          <div
                            key={feature.id}
                            className={`flex items-center justify-between px-4 py-3 border-b border-charcoal/5 last:border-b-0 ${isProLocked ? 'bg-charcoal/[0.018]' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${isProLocked ? 'text-charcoal/40' : 'text-charcoal'}`}>
                                {feature.label}
                                {isProLocked && (
                                  <span className="ml-1.5 text-[9px] font-bold tracking-widest uppercase text-accent" style={{ fontFamily: 'DM Mono, monospace' }}>
                                    PRO
                                  </span>
                                )}
                              </p>
                              <p className={`text-[11px] mt-0.5 ${isProLocked ? 'text-charcoal/25' : 'text-charcoal/35'}`}>
                                {feature.description}
                              </p>
                            </div>
                            {isProLocked ? (
                              <button
                                onClick={() => setUpgradeFeature(feature.id)}
                                className="flex items-center gap-1.5 text-[10.5px] font-bold text-accent bg-accent/8 border border-accent/18 px-2.5 py-1 rounded-lg ml-3 shrink-0 hover:bg-accent/14 transition-colors"
                              >
                                <LockIcon size={10} />
                                Pro
                              </button>
                            ) : (
                              <Toggle
                                checked={enabledFeatures.has(feature.id)}
                                onChange={() => toggleFeature(feature.id)}
                                size="sm"
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
          )}

          {/* Step 2: Hours */}
          {step === 2 && (
            <div>
              <h1 className="text-[19px] font-bold text-charcoal mb-1 tracking-tight">When are you open?</h1>
              <p className="text-[12.5px] text-charcoal/45 mb-[18px] leading-relaxed">
                Set hours per day — used for rota planning, clock-in, and compliance schedules.
              </p>
              <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden">
                {dayHours.map((d, i) => (
                  <div
                    key={d.day}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-charcoal/5 last:border-b-0 ${!d.open ? 'bg-charcoal/[0.018]' : ''}`}
                  >
                    <div className="flex items-center gap-2 w-[100px] shrink-0">
                      <span className="text-[13px] font-semibold text-charcoal w-9">{d.day.slice(0, 3)}</span>
                      <MiniToggle checked={d.open} onChange={v => updateDay(i, { open: v })} />
                    </div>
                    {d.open ? (
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <TimeSelect value={d.start} onChange={v => updateDay(i, { start: v })} />
                        <span className="text-charcoal/30 text-sm">–</span>
                        <TimeSelect value={d.end} onChange={v => updateDay(i, { end: v })} />
                      </div>
                    ) : (
                      <span className="text-charcoal/35 text-[11.5px] italic flex-1 text-right">Closed</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={applyFirstToAll}
                className="mt-3 text-xs text-charcoal/40 hover:text-brand transition-colors border-b border-charcoal/20"
              >
                Apply first open day's hours to all open days
              </button>
            </div>
          )}

          {/* Step 3: Team */}
          {step === 3 && (
            <div>
              <h1 className="text-[19px] font-bold text-charcoal mb-1 tracking-tight">Add your team</h1>
              <p className="text-[12.5px] text-charcoal/45 mb-[18px] leading-relaxed">
                Add a few staff members to get started.
              </p>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-charcoal/8 mb-4 text-[11.5px] text-charcoal/50 leading-relaxed">
                <InfoIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-charcoal/30" />
                <span>You can add more staff, set permissions, and assign roles in <strong className="text-charcoal/60">Settings → Staff</strong> at any time.</span>
              </div>
              <div className="flex flex-col gap-2">
                {staffEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-[1fr_76px_120px] gap-1.5 staff-fields">
                      <input
                        value={entry.name}
                        onChange={e => updateStaff(idx, 'name', e.target.value)}
                        placeholder="Name"
                        className="px-3 py-2.5 rounded-[9px] border border-charcoal/12 bg-white text-[13px] text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/10 transition-all"
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={entry.pin}
                        onChange={e => updateStaff(idx, 'pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="PIN"
                        className="px-3 py-2.5 rounded-[9px] border border-charcoal/12 bg-white text-[13px] tracking-widest placeholder:text-charcoal/35 focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/10 transition-all"
                      />
                      <input
                        type="text"
                        value={entry.jobRole}
                        onChange={e => updateStaff(idx, 'jobRole', e.target.value)}
                        placeholder="Role (e.g. Manager)"
                        className="px-3 py-2.5 rounded-[9px] border border-charcoal/12 bg-white text-[13px] text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/10 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => removeStaffRow(idx)}
                      className="p-2 rounded-lg text-charcoal/30 hover:text-danger transition-colors text-[18px] leading-none mt-1 shrink-0"
                      aria-label="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addStaffRow}
                className="mt-3 text-[12.5px] text-brand border-[1.5px] border-dashed border-brand/25 bg-brand/[0.04] rounded-[10px] py-2.5 w-full font-semibold hover:bg-brand/8 hover:border-brand/40 transition-all"
              >
                + Add another staff member
              </button>
            </div>
          )}

          {/* Step 4: Roles & Rota (conditional) */}
          {step === 4 && hasRotaStep && (() => {
            const validStaff = staffEntries.filter(s => s.name.trim() && s.pin.length === 4)
            const presetRoles = ROLE_PRESETS[selectedPreset?.id] ?? []
            return (
              <div className="flex flex-col gap-6">
                {/* Section A: Define roles */}
                <div>
                  <h2 className="text-[17px] font-bold text-charcoal mb-0.5">What roles do you have?</h2>
                  <p className="text-[12.5px] text-charcoal/45 mb-4">Used to match staff to the right shifts when auto-filling your rota.</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {presetRoles.map(role => {
                      const active = rolesInput.includes(role)
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(role)}
                          className={[
                            'px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all',
                            active
                              ? 'bg-brand text-white border-brand'
                              : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/30',
                          ].join(' ')}
                        >
                          {active && <span className="mr-1">✓</span>}{role}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customRoleText}
                      onChange={e => setCustomRoleText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomRole()}
                      placeholder="Add custom role…"
                      className="flex-1 px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-[12.5px] text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      onClick={addCustomRole}
                      disabled={!customRoleText.trim()}
                      className="px-3 py-2 rounded-lg bg-charcoal/8 text-charcoal/60 text-[12.5px] font-semibold hover:bg-charcoal/12 transition-colors disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  {rolesInput.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rolesInput.filter(r => !presetRoles.includes(r)).map(role => (
                        <span key={role} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand/8 text-brand text-[11.5px] font-semibold">
                          {role}
                          <button onClick={() => toggleRole(role)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section B: Assign roles to staff */}
                {rolesInput.length > 0 && validStaff.length > 0 && (
                  <div>
                    <h3 className="text-[13.5px] font-bold text-charcoal mb-0.5">Who can work each role?</h3>
                    <p className="text-[12px] text-charcoal/40 mb-3">Tick the roles each team member is qualified to cover.</p>
                    <div className="flex flex-col gap-2">
                      {validStaff.map(member => {
                        const assigned = roleAssignments[member.name] ?? []
                        return (
                          <div key={member.name} className="bg-white rounded-xl border border-charcoal/8 px-4 py-3">
                            <p className="text-[12.5px] font-semibold text-charcoal mb-2">{member.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {rolesInput.map(role => {
                                const checked = assigned.includes(role)
                                return (
                                  <button
                                    key={role}
                                    onClick={() => toggleStaffRole(member.name, role)}
                                    className={[
                                      'px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-all',
                                      checked
                                        ? 'bg-brand/10 text-brand border-brand/25'
                                        : 'bg-charcoal/3 text-charcoal/45 border-charcoal/10 hover:border-charcoal/25',
                                    ].join(' ')}
                                  >
                                    {checked && '✓ '}{role}
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
                  <div>
                    <h3 className="text-[13.5px] font-bold text-charcoal mb-0.5">How many of each role per day?</h3>
                    <p className="text-[12px] text-charcoal/40 mb-3">Applied to all open days when auto-filling your rota.</p>
                    <div className="flex flex-col gap-2">
                      {rolesInput.map(role => (
                        <div key={role} className="flex items-center justify-between bg-white rounded-xl border border-charcoal/8 px-4 py-3">
                          <span className="text-[13px] font-medium text-charcoal">{role}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDailyCounts(prev => ({ ...prev, [role]: Math.max(1, (prev[role] ?? 1) - 1) }))}
                              className="w-7 h-7 rounded-lg border border-charcoal/15 text-charcoal/50 hover:text-charcoal hover:border-charcoal/30 transition-all flex items-center justify-center text-base font-medium"
                            >−</button>
                            <span className="w-6 text-center text-[13px] font-semibold text-charcoal tabular-nums">{dailyCounts[role] ?? 1}</span>
                            <button
                              onClick={() => setDailyCounts(prev => ({ ...prev, [role]: (prev[role] ?? 1) + 1 }))}
                              className="w-7 h-7 rounded-lg border border-charcoal/15 text-charcoal/50 hover:text-charcoal hover:border-charcoal/30 transition-all flex items-center justify-center text-base font-medium"
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rolesInput.length === 0 && (
                  <div className="bg-charcoal/3 rounded-xl border border-charcoal/8 px-4 py-6 text-center">
                    <p className="text-[12.5px] text-charcoal/40">Select at least one role above, or skip this step and configure later in Settings.</p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Step 4/5: All Set */}
          {step === STEPS.length - 1 && (
            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-[18px] bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="text-[19px] font-bold text-charcoal mb-1.5 tracking-tight">You're all set</h1>
              <p className="text-[12.5px] text-charcoal/45 mb-4 max-w-sm mx-auto leading-relaxed">
                Your venue is configured and ready to go. Everything can be adjusted in Settings at any time.
              </p>
              {selectedPreset && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-brand/7 border border-brand/14 mb-1">
                  {VENUE_ICONS[selectedPreset.icon]}
                  <span className="text-[13px] font-bold text-brand">{selectedPreset.label}</span>
                </div>
              )}
              <div className="bg-white rounded-[14px] border border-charcoal/8 p-[18px] mt-[18px] text-left">
                <p className="text-[9.5px] tracking-[0.12em] uppercase text-charcoal/40 mb-2.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                  Setup summary
                </p>
                {[
                  { label: 'Modules enabled', value: `${enabledCount} feature${enabledCount !== 1 ? 's' : ''}` },
                  { label: 'Operating days', value: `${openDayCount} day${openDayCount !== 1 ? 's' : ''}/week` },
                  ...(validStaffCount > 0 ? [{ label: 'Staff added', value: `${validStaffCount} member${validStaffCount !== 1 ? 's' : ''}` }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2.5 py-2 border-b border-charcoal/8 last:border-b-0">
                    <div className="w-6 h-6 rounded-[7px] bg-success/10 text-success flex items-center justify-center shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-[13px] font-medium text-charcoal flex-1">{row.label}</span>
                    <span className="text-[11.5px] text-charcoal/40">{row.value}</span>
                  </div>
                ))}
              </div>
              {!isPro && (
                <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-accent/[0.04] border border-accent/14 text-left">
                  <div className="w-8 h-8 rounded-lg bg-accent/12 text-accent flex items-center justify-center shrink-0">
                    <StarIcon size={15} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12.5px] font-bold text-accent">Unlock Pro features</p>
                    <p className="text-[10.5px] text-charcoal/40 mt-0.5">Rota, timesheets, training records, time off and more</p>
                  </div>
                  <button
                    onClick={() => setUpgradeFeature('rota')}
                    className="text-[11px] font-bold text-white bg-accent px-3 py-1.5 rounded-lg shrink-0 hover:opacity-87 transition-opacity"
                  >
                    Upgrade
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Sticky footer nav */}
      <div className="sticky bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-sm border-t border-charcoal/8 p-3 z-10 shrink-0">
        <div className="flex gap-2 max-w-[540px] mx-auto">
          {step > 0 && step < STEPS.length - 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-3 rounded-xl border border-charcoal/12 text-[13px] font-semibold text-charcoal/60 hover:border-charcoal/25 hover:text-charcoal transition-all whitespace-nowrap"
            >
              Back
            </button>
          )}
          {(step === 3 || (step === 4 && hasRotaStep)) && (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-4 py-3 rounded-xl text-[13px] font-medium text-charcoal/40 hover:text-charcoal transition-colors whitespace-nowrap"
            >
              Skip
            </button>
          )}
          <button
            onClick={next}
            disabled={!canAdvance() || saving}
            className="flex-1 py-3 rounded-xl border-none bg-brand text-white text-[13px] font-bold hover:opacity-88 disabled:opacity-35 transition-opacity"
          >
            {step === STEPS.length - 1
              ? (saving ? 'Setting up…' : 'Go to Dashboard')
              : step === STEPS.length - 2
                ? 'Finish setup'
                : 'Continue'
            }
          </button>
        </div>
        {step < STEPS.length - 1 && (
          <div className="text-center mt-1.5">
            <button
              onClick={skipSetup}
              className="text-[11px] text-charcoal/35 hover:text-charcoal/60 transition-colors underline underline-offset-2"
            >
              Already set up? Skip this →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 480px) {
          .staff-fields { grid-template-columns: 1fr 1fr !important; }
          .staff-fields .role-select { grid-column: span 2; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(.94) translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
