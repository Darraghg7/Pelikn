import React, { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAppSettings } from '../../hooks/useSettings'
import { useTheme } from '../../contexts/ThemeContext'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import Toggle from '../../components/ui/Toggle'
import useVenueSettings from '../../hooks/useVenueSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { PLANS } from '../../lib/constants'
import SettingsSection from './SettingsSection'
import RolesSection from './RolesSection'
import NotificationsPanel from './NotificationsPanel'
import StaffMembersSection from './StaffMembersSection'
import VenuesSection from './VenuesSection'

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const toast = useToast()
  const { session } = useSession()
  const { venueId } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { closures, reload: reloadClosures } = useVenueClosures()
  const { closedDays, breakDurationMins, saveClosedDays, saveBreakDuration } = useAppSettings()
  const { dark, toggle: toggleDark } = useTheme()
  const { config: featuresConfig, save: saveFeatures, venuePlan } = useVenueFeatures()

  // Closed periods form
  const [closureForm, setClosureForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [savingClosure, setSavingClosure] = useState(false)

  const addClosure = async () => {
    if (!closureForm.start_date || !closureForm.end_date) { toast('Start and end date are required', 'error'); return }
    if (closureForm.end_date < closureForm.start_date) { toast('End date must be on or after start date', 'error'); return }
    setSavingClosure(true)
    const { error } = await supabase.from('venue_closures').insert({
      venue_id:   venueId,
      start_date: closureForm.start_date,
      end_date:   closureForm.end_date,
      reason:     closureForm.reason.trim() || null,
    })
    setSavingClosure(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Closed period added')
    setClosureForm({ start_date: '', end_date: '', reason: '' })
    reloadClosures()
  }

  const deleteClosure = async (id) => {
    const { error } = await supabase.from('venue_closures').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Closed period removed')
    reloadClosures()
  }

  // Venue form
  const [venueForm, setVenueForm]   = useState({ venue_name: '', manager_email: '' })
  const [savingVenue, setSavingVenue] = useState(false)
  const [logoFile, setLogoFile]     = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  useEffect(() => {
    if (!sLoading) setVenueForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  const saveVenue = async () => {
    setSavingVenue(true)
    const results = await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_name',    value: venueForm.venue_name }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'manager_email', value: venueForm.manager_email }),
    ])
    setSavingVenue(false)
    if (results.some(r => r.error)) { toast('Failed to save venue settings', 'error'); return }
    toast('Venue settings saved')
    reloadSettings()
  }

  const uploadLogo = async (file) => {
    if (!file) return
    setUploadingLogo(true)
    const ext  = file.name.split('.').pop()
    const path = `${venueId}/logo/venue-logo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('app-assets')
      .upload(path, file, { upsert: true })
    if (upErr) { toast('Logo upload failed: ' + upErr.message, 'error'); setUploadingLogo(false); return }
    const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('app_settings')
      .upsert({ venue_id: venueId, key: 'logo_url', value: urlData.publicUrl + '?t=' + Date.now() })
    setUploadingLogo(false)
    if (dbErr) { toast('Failed to save logo URL', 'error'); return }
    toast('Logo uploaded')
    setLogoFile(null)
    reloadSettings()
  }

  // Features toggles — defined here to avoid re-creating inside map callbacks
  const handleToggleGroup = (groupFeatures, allOn) => {
    const next = allOn
      ? (featuresConfig.enabled ?? ALL_FEATURE_IDS).filter(id => !groupFeatures.find(f => f.id === id))
      : [...new Set([...(featuresConfig.enabled ?? []), ...groupFeatures.map(f => f.id)])]
    saveFeatures({ ...featuresConfig, enabled: next })
  }

  const handleToggleFeature = (featureId) => {
    const current = featuresConfig.enabled ?? ALL_FEATURE_IDS
    const next = current.includes(featureId)
      ? current.filter(id => id !== featureId)
      : [...current, featureId]
    saveFeatures({ ...featuresConfig, enabled: next })
  }

  // Opening days
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const toggleClosedDay = async (dayIndex) => {
    const next = closedDays.includes(dayIndex)
      ? closedDays.filter(d => d !== dayIndex)
      : [...closedDays, dayIndex]
    await saveClosedDays(next)
  }

  if (sLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl text-brand dark:text-white">Settings</h1>

      {/* ── Venue Details ──────────────────────────────────────────────────── */}
      <SettingsSection title="Venue Details" defaultOpen>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Venue Name</label>
            <input
              value={venueForm.venue_name}
              onChange={e => setVenueForm(f => ({ ...f, venue_name: e.target.value }))}
              placeholder="e.g. The Crown Bar & Kitchen"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Manager Email</label>
            <input
              type="email"
              value={venueForm.manager_email}
              onChange={e => setVenueForm(f => ({ ...f, manager_email: e.target.value }))}
              placeholder="manager@yoursite.com"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <button
            onClick={saveVenue}
            disabled={savingVenue}
            className="bg-charcoal text-cream px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40 self-start"
          >
            {savingVenue ? 'Saving…' : 'Save Changes →'}
          </button>

          {/* Logo upload */}
          <div className="border-t border-charcoal/10 pt-4 mt-2">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-3">Venue Logo</label>
            <div className="flex items-center gap-4 flex-wrap">
              {settings.logo_url && (
                <img
                  src={settings.logo_url}
                  alt="Venue logo"
                  className="h-12 w-12 rounded-lg object-contain border border-charcoal/10 bg-cream/50 p-1"
                />
              )}
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setLogoFile(e.target.files[0] ?? null)}
                  className="text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-cream/50 file:text-charcoal/60 hover:file:bg-cream"
                />
                {logoFile && (
                  <button
                    onClick={() => uploadLogo(logoFile)}
                    disabled={uploadingLogo}
                    className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
                  >
                    {uploadingLogo ? 'Uploading…' : 'Upload Logo →'}
                  </button>
                )}
                <p className="text-[11px] text-charcoal/35">Displayed in the app header after login. PNG or SVG recommended.</p>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Appearance" subtitle="Dark mode · Theme">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal dark:text-white">Dark Mode</p>
            <p className="text-xs text-charcoal/40 dark:text-white/40 mt-0.5">
              {dark ? 'Dark theme is active.' : 'Switch to a darker colour scheme.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{dark ? '🌙' : '☀️'}</span>
            <Toggle checked={dark} onChange={toggleDark} />
          </div>
        </div>
      </SettingsSection>

      {/* ── Features & Modules ─────────────────────────────────────────────── */}
      <SettingsSection
        title="Features & Modules"
        subtitle={featuresConfig.mode === 'all' ? 'All features enabled' : `Custom — ${featuresConfig.enabled?.length ?? 0} enabled`}
      >
        <p className="text-xs text-charcoal/40 dark:text-white/40 mb-5">
          Choose which features are available in this venue. Disabled features are hidden from the navigation.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          {['all', 'custom'].map(mode => (
            <button
              key={mode}
              onClick={() => saveFeatures({
                mode,
                enabled: mode === 'all' ? ALL_FEATURE_IDS : (featuresConfig.enabled ?? ALL_FEATURE_IDS),
              })}
              className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                featuresConfig.mode === mode
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-charcoal/15 dark:border-white/15 text-charcoal/50 dark:text-white/40 hover:border-charcoal/30 dark:hover:border-white/30'
              }`}
            >
              {mode === 'all' ? 'All Features' : 'Custom'}
            </button>
          ))}
        </div>

        {/* Feature groups — only shown in custom mode */}
        {featuresConfig.mode === 'custom' && (
          <div className="space-y-4">
            {FEATURE_GROUPS.map(group => {
              const allOn = group.features.every(f => featuresConfig.enabled?.includes(f.id))
              return (
                <div key={group.id} className="rounded-xl border border-charcoal/10 dark:border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-charcoal/3 dark:bg-white/4 border-b border-charcoal/8 dark:border-white/8">
                    <div>
                      <p className="text-sm font-semibold text-charcoal dark:text-white">{group.label}</p>
                      <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5">{group.description}</p>
                    </div>
                    <Toggle checked={allOn} onChange={() => handleToggleGroup(group.features, allOn)} />
                  </div>
                  <div className="divide-y divide-charcoal/6 dark:divide-white/6">
                    {group.features.map(feature => {
                      const isProOnly = PRO_ONLY_FEATURE_IDS.includes(feature.id)
                      const locked = isProOnly && venuePlan !== PLANS.PRO
                      const on = !locked && (featuresConfig.enabled?.includes(feature.id) ?? true)
                      return (
                        <div key={feature.id} className={`flex items-center justify-between px-4 py-3 ${locked ? 'opacity-60' : ''}`}>
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${on ? 'text-charcoal dark:text-white' : 'text-charcoal/35 dark:text-white/30'}`}>
                                {feature.label}
                              </p>
                              {locked && (
                                <span className="text-[9px] tracking-widest uppercase font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">Pro</span>
                              )}
                            </div>
                            <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5 truncate">{feature.description}</p>
                          </div>
                          <Toggle checked={on} onChange={locked ? undefined : () => handleToggleFeature(feature.id)} disabled={locked} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {featuresConfig.mode === 'all' && (
          <p className="text-xs text-charcoal/35 dark:text-white/30 italic">
            All {ALL_FEATURE_IDS.length} features are enabled. Switch to Custom to hide modules that don't apply to your business.
          </p>
        )}
      </SettingsSection>

      {/* ── Opening Days ───────────────────────────────────────────────────── */}
      <SettingsSection
        title="Opening Days"
        subtitle={closedDays.length === 0 ? 'All 7 days open' : `Closed: ${closedDays.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', ')}`}
      >
        <p className="text-xs text-charcoal/40 mb-4">
          Mark days the venue is closed. Closed days are skipped by the rota builder and greyed out in the schedule.
        </p>
        <div className="flex gap-2 flex-wrap">
          {DAY_NAMES.map((day, i) => {
            const isClosed = closedDays.includes(i)
            return (
              <button
                key={i}
                onClick={() => toggleClosedDay(i)}
                className={[
                  'px-4 py-2.5 rounded-lg text-sm font-medium border transition-all min-w-[64px]',
                  isClosed
                    ? 'bg-charcoal/8 text-charcoal/35 border-charcoal/15 line-through'
                    : 'bg-success/10 text-success border-success/20',
                ].join(' ')}
              >
                {day}
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* ── Rota & Pay ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Rota & Pay" subtitle={`Adult break: ${breakDurationMins} min · Under-18: 30 min`} locked={venuePlan !== PLANS.PRO}>
        <p className="text-sm text-charcoal/50 mb-5">
          Set the unpaid break deducted from paid hours for adult staff (18+) working more than 6 hours. UK law requires a minimum of 20 minutes. Under-18 staff always get 30 minutes as required by law.
        </p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">Break duration (adults, shifts &gt;6h)</p>
            <p className="text-xs text-charcoal/40 mt-0.5">Deducted from paid hours and wage cost</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[15, 20, 30, 45, 60].map(mins => (
              <button
                key={mins}
                onClick={() => saveBreakDuration(mins)}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  breakDurationMins === mins
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                ].join(' ')}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
        {breakDurationMins < 20 && (
          <p className="text-xs text-warning mt-3">Note: UK minimum break is 20 minutes.</p>
        )}
      </SettingsSection>

      {/* ── Closed Periods ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="Closed Periods"
        subtitle={closures.length > 0 ? `${closures.length} period${closures.length !== 1 ? 's' : ''} scheduled` : 'None scheduled'}
        locked={venuePlan !== PLANS.PRO}
      >
        <p className="text-xs text-charcoal/40 mb-5">
          Mark your venue as closed for a specific date range — e.g. Christmas week, annual holiday. This flags the period across the app so staff aren't expected to complete checks.
        </p>

        {/* Existing closures */}
        {closures.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            {closures.map(c => {
              const past = c.end_date < format(new Date(), 'yyyy-MM-dd')
              return (
                <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${past ? 'bg-charcoal/2 border-charcoal/8 opacity-50' : 'bg-cream/40 border-charcoal/10'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">
                      {format(parseISO(c.start_date), 'd MMM yyyy')}
                      {c.start_date !== c.end_date && ` – ${format(parseISO(c.end_date), 'd MMM yyyy')}`}
                    </p>
                    {c.reason && <p className="text-xs text-charcoal/40 mt-0.5">{c.reason}</p>}
                    {past && <p className="text-[11px] text-charcoal/30 italic mt-0.5">Past</p>}
                  </div>
                  <button
                    onClick={() => deleteClosure(c.id)}
                    className="text-xs text-charcoal/25 hover:text-danger transition-colors shrink-0"
                  >×</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add closure form */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-cream/40 border border-charcoal/10">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Add Closed Period</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">From *</label>
              <input
                type="date"
                value={closureForm.start_date}
                onChange={e => setClosureForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">To *</label>
              <input
                type="date"
                value={closureForm.end_date}
                min={closureForm.start_date}
                onChange={e => setClosureForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Reason (optional)</label>
            <input
              value={closureForm.reason}
              onChange={e => setClosureForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Christmas holiday, annual deep clean"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <button
            onClick={addClosure}
            disabled={savingClosure || !closureForm.start_date || !closureForm.end_date}
            className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
          >
            {savingClosure ? 'Saving…' : 'Add Closed Period →'}
          </button>
        </div>
      </SettingsSection>

      {/* ── Notifications & Reports ────────────────────────────────────────── */}
      <SettingsSection title="Notifications & Reports" subtitle="Push alerts · Weekly email">
        <NotificationsPanel session={session} toast={toast} settings={settings} />
      </SettingsSection>

      {/* ── Roles & Skills ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="Roles & Skills"
        subtitle="Define the roles in your business — assign them to staff and use them in the rota builder"
        locked={venuePlan !== PLANS.PRO}
      >
        <RolesSection />
      </SettingsSection>

      {/* ── Staff Members ──────────────────────────────────────────────────── */}
      <StaffMembersSection />

      {/* ── Venues (multi-venue, Pro only) ─────────────────────────────────── */}
      <VenuesSection />
    </div>
  )
}
