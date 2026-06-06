import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { VENUE_PRESETS, DEFAULT_STAFF_PERMISSIONS } from '../../lib/constants'
import Toggle from '../../components/ui/Toggle'
import TimeSelect from '../../components/ui/TimeSelect'
import { useToast } from '../../components/ui/Toast'

const VENUE_ICONS = {
  cafe:       <span className="text-3xl">&#9749;</span>,
  pub:        <span className="text-3xl">&#127866;</span>,
  restaurant: <span className="text-3xl">&#127869;</span>,
  hotel:      <span className="text-3xl">&#127976;</span>,
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const JOB_ROLES = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'foh',     label: 'FOH' },
  { value: 'bar',     label: 'Bar' },
]

const STEPS = ['Venue Type', 'Modules', 'Hours', 'Your Team', 'All Set']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const { save: saveFeatures, venuePlan } = useVenueFeatures()
  const toast = useToast()

  const [step, setStep] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [enabledFeatures, setEnabledFeatures] = useState(new Set(ALL_FEATURE_IDS))
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('22:00')
  const [closedDays, setClosedDays] = useState([])
  const [staffEntries, setStaffEntries] = useState([
    { name: '', pin: '', jobRole: 'kitchen' },
    { name: '', pin: '', jobRole: 'kitchen' },
  ])
  const [saving, setSaving] = useState(false)

  const selectPreset = (preset) => {
    setSelectedPreset(preset)
    const features = preset.features ? new Set(preset.features) : new Set(ALL_FEATURE_IDS)
    setEnabledFeatures(features)
  }

  const isPro = venuePlan === 'pro'

  const toggleFeature = (id) => {
    setEnabledFeatures(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleClosedDay = (dayIndex) => {
    setClosedDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    )
  }

  const updateStaff = (idx, field, value) => {
    setStaffEntries(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const addStaffRow = () => {
    if (staffEntries.length >= 10) return
    setStaffEntries(prev => [...prev, { name: '', pin: '', jobRole: 'kitchen' }])
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
    for (const entry of valid) {
      const { error } = await supabase.rpc('create_staff_member', {
        p_session_token: session.token,
        p_name:          entry.name.trim(),
        p_job_role:      entry.jobRole,
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
          .from('staff')
          .select('id')
          .eq('venue_id', venueId)
          .eq('name', entry.name.trim())
          .order('created_at', { ascending: false })
          .limit(1)
        if (newRow?.[0]?.id) {
          await supabase.from('staff_permissions').insert(
            DEFAULT_STAFF_PERMISSIONS.map(p => ({
              staff_id: newRow[0].id,
              venue_id: venueId,
              permission: p,
            }))
          )
        }
      }
    }
  }

  const finishSetup = async () => {
    setSaving(true)
    if (selectedPreset) {
      await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_type', value: selectedPreset.id }, { onConflict: 'venue_id,key' })
    }
    await Promise.all([
      saveModules(),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'open_time', value: JSON.stringify(openTime) }, { onConflict: 'venue_id,key' }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'close_time', value: JSON.stringify(closeTime) }, { onConflict: 'venue_id,key' }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'closed_days', value: JSON.stringify(closedDays) }, { onConflict: 'venue_id,key' }),
    ])
    await saveTeam()
    await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'onboarding_complete', value: 'true' }, { onConflict: 'venue_id,key' })
    setSaving(false)
    navigate(`/v/${venueSlug}/dashboard`)
  }

  const skipSetup = async () => {
    await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'onboarding_complete', value: 'true' }, { onConflict: 'venue_id,key' })
    navigate(`/v/${venueSlug}/dashboard`, { replace: true })
  }

  const canAdvance = () => {
    if (step === 0) return !!selectedPreset
    return true
  }

  const next = async () => {
    if (step === STEPS.length - 1) {
      await finishSetup()
      return
    }
    setStep(s => s + 1)
  }

  const validStaffCount = staffEntries.filter(s => s.name.trim() && s.pin.length === 4).length

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center px-5 py-8 font-sans">
      {/* Progress bar */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((label, i) => (
            <span key={label} className={`text-[11px] tracking-widest uppercase ${i <= step ? 'text-brand font-semibold' : 'text-charcoal/30'}`}>
              {label}
            </span>
          ))}
        </div>
        <div className="h-1 bg-charcoal/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-lg">

        {/* Step 0: Venue Type */}
        {step === 0 && (
          <div>
            <h1 className="text-xl font-bold text-charcoal mb-1">What kind of venue are you?</h1>
            <p className="text-sm text-charcoal/50 mb-6">
              We'll set up the right modules for your business. You can change this anytime.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {VENUE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset)}
                  className={[
                    'p-5 rounded-xl border-2 text-left transition-all',
                    selectedPreset?.id === preset.id
                      ? 'border-brand bg-brand/5'
                      : 'border-charcoal/10 bg-white hover:border-charcoal/25',
                  ].join(' ')}
                >
                  <div className="mb-2">{VENUE_ICONS[preset.icon]}</div>
                  <p className="font-semibold text-sm text-charcoal">{preset.label}</p>
                  <p className="text-[11px] text-charcoal/40 mt-1 leading-relaxed">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Modules */}
        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold text-charcoal mb-1">Choose your modules</h1>
            <p className="text-sm text-charcoal/50 mb-6">
              We've pre-selected modules based on your venue type. Toggle what you need.
            </p>
            {FEATURE_GROUPS.map(group => {
              const visibleFeatures = group.features.filter(f => !PRO_ONLY_FEATURE_IDS.includes(f.id) || isPro)
              if (visibleFeatures.length === 0) return null
              return (
                <div key={group.id} className="mb-5">
                  <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">{group.label}</p>
                  <div className="bg-white rounded-2xl border-charcoal/10 divide-y divide-charcoal/6">
                    {visibleFeatures.map(feature => (
                      <div key={feature.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-charcoal">{feature.label}</p>
                          <p className="text-[11px] text-charcoal/35 mt-0.5">{feature.description}</p>
                        </div>
                        <Toggle
                          checked={enabledFeatures.has(feature.id)}
                          onChange={() => toggleFeature(feature.id)}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Step 2: Operating Hours */}
        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold text-charcoal mb-1">When are you open?</h1>
            <p className="text-sm text-charcoal/50 mb-6">
              Used for rota planning, clock-in, and compliance schedules.
            </p>

            <div className="bg-white rounded-2xl border border-charcoal/10 p-5 mb-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-charcoal min-w-[56px]">Opens</span>
                  <TimeSelect value={openTime} onChange={setOpenTime} className="flex-1 max-w-[160px]" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-charcoal min-w-[56px]">Closes</span>
                  <TimeSelect value={closeTime} onChange={setCloseTime} className="flex-1 max-w-[160px]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-charcoal/10 p-5">
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Closed days</p>
              <div className="flex gap-2 flex-wrap">
                {DAY_NAMES.map((day, i) => {
                  const isClosed = closedDays.includes(i)
                  return (
                    <button
                      key={day}
                      onClick={() => toggleClosedDay(i)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                        isClosed
                          ? 'bg-charcoal text-cream border-charcoal'
                          : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                      ].join(' ')}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              {closedDays.length > 0 && (
                <p className="text-[11px] text-charcoal/35 mt-3">
                  Closed {closedDays.sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Add Team */}
        {step === 3 && (
          <div>
            <h1 className="text-xl font-bold text-charcoal mb-1">Add your team</h1>
            <p className="text-sm text-charcoal/50 mb-6">
              Add a few staff members to get started. You can add more later in Settings.
            </p>
            <div className="flex flex-col gap-3">
              {staffEntries.map((entry, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-charcoal/10 p-4 flex gap-3 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      value={entry.name}
                      onChange={e => updateStaff(idx, 'name', e.target.value)}
                      placeholder="Name"
                      className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                    />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={entry.pin}
                      onChange={e => updateStaff(idx, 'pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="PIN"
                      className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                    />
                    <select
                      value={entry.jobRole}
                      onChange={e => updateStaff(idx, 'jobRole', e.target.value)}
                      className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20 appearance-none cursor-pointer"
                    >
                      {JOB_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => removeStaffRow(idx)}
                    className="text-charcoal/25 hover:text-danger transition-colors text-lg leading-none mt-2"
                    aria-label="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addStaffRow}
              className="mt-3 text-xs text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              + Add another
            </button>
          </div>
        )}

        {/* Step 4: All Set */}
        {step === 4 && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">&#9989;</div>
            <h1 className="text-xl font-bold text-charcoal mb-2">You're all set!</h1>
            <p className="text-sm text-charcoal/50 mb-4 max-w-sm mx-auto">
              Your venue is configured and ready to go. You can adjust everything in Settings at any time.
            </p>
            {selectedPreset && (
              <div className="inline-flex items-center gap-2 bg-brand/5 border border-brand/15 rounded-lg px-4 py-2 mb-6">
                {VENUE_ICONS[selectedPreset.icon]}
                <span className="text-sm font-medium text-brand">{selectedPreset.label}</span>
              </div>
            )}
            <div className="text-left bg-white rounded-2xl border border-charcoal/10 p-5 max-w-sm mx-auto">
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Summary</p>
              <div className="flex flex-col gap-2 text-sm text-charcoal/60">
                <p>{enabledFeatures.size} modules enabled</p>
                <p>
                  Opens {openTime}, closes {closeTime}
                  {closedDays.length > 0 && ` · Closed ${closedDays.sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ')}`}
                </p>
                {validStaffCount > 0 && (
                  <p>{validStaffCount} staff member{validStaffCount !== 1 ? 's' : ''} added</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && step < STEPS.length - 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
            >
              Back
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              className="px-6 py-3 rounded-xl text-sm text-charcoal/40 hover:text-charcoal transition-colors"
            >
              Skip
            </button>
          )}
          <button
            onClick={next}
            disabled={!canAdvance() || saving}
            className="flex-1 bg-brand text-cream py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40"
          >
            {step === STEPS.length - 1 ? (saving ? 'Setting up...' : 'Go to Dashboard') : 'Continue'}
          </button>
        </div>

        {step < STEPS.length - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={skipSetup}
              className="text-xs text-charcoal/35 hover:text-charcoal/60 transition-colors"
            >
              Already set up? Skip this →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
