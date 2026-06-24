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
import TimeSelect from '../../components/ui/TimeSelect'
import useVenueSettings from '../../hooks/useVenueSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { PLANS } from '../../lib/constants'
import SettingsSection from './SettingsSection'
import StaffMembersSection from './StaffMembersSection'
import RolesSection from './RolesSection'
import DutiesSection from './DutiesSection'
import NotificationsPanel from './NotificationsPanel'
import VenuesSection from './VenuesSection'
import HelpSection from './HelpSection'
import AppIconPicker from './AppIconPicker'
import VenueTypeIndicator from './VenueTypeIndicator'
import VenueCodeSection from './VenueCodeSection'
import PermissionTitlesSection from './PermissionTitlesSection'
import NavOrderSection from './NavOrderSection'
import ActionSchedulesSection from './ActionSchedulesSection'

const SECTIONS = [
  { key: 'venue',    label: 'General',          subtitle: 'Name, logo, theme and app icon' },
  { key: 'venues',   label: 'My venues',        subtitle: 'Manage venues on this account' },
  { key: 'staff',    label: 'Staff members',    subtitle: 'Active staff and PIN access' },
  { key: 'invite',   label: 'Invite code',      subtitle: 'Venue join code for new staff' },
  { key: 'roles',    label: 'Roles & titles',   subtitle: 'Rota roles and permission titles' },
  { key: 'duties',   label: 'Duties',           subtitle: 'Named task bundles per shift' },
  { key: 'shifts',   label: 'Shifts & breaks',  subtitle: 'Break duration and clean-up grace' },
  { key: 'hours',    label: 'Opening hours',    subtitle: 'Trading hours and closed periods' },
  { key: 'actions',  label: 'Daily actions',    subtitle: 'Dashboard check schedule' },
  { key: 'modules',  label: 'Modules',          subtitle: 'Enable/disable features' },
  { key: 'navorder', label: 'Navigation order', subtitle: 'Sidebar order' },
  { key: 'notif',    label: 'Notifications',    subtitle: 'Push alerts and reminders' },
  { key: 'help',     label: 'Help & FAQ',       subtitle: 'Common questions, support' },
]

function SettingsGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11px] tracking-widest uppercase text-charcoal/30 font-semibold px-1 pt-1">{label}</p>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const toast = useToast()
  const { session } = useSession()
  const { venueId, venueSlug } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { closures, reload: reloadClosures } = useVenueClosures()
  const { closedDays, breakDurationMins, cleanupMinutes, fridgeCheckTime, openTime, closeTime, complianceNavOrder, actionSchedules, saveClosedDays, saveBreakDuration, saveCleanupMinutes, saveFridgeCheckTime, saveOpenTime, saveCloseTime, saveComplianceNavOrder, saveActionSchedules } = useAppSettings()
  const { dark, mode: themeMode, setMode: setThemeMode } = useTheme()
  const { config: featuresConfig, save: saveFeatures, venuePlan, isEnabled } = useVenueFeatures()

  const [active, setActive] = useState(null)

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

  const [venueForm, setVenueForm]       = useState({ venue_name: '', manager_email: '' })
  const [savingVenue, setSavingVenue]   = useState(false)
  const [logoFile, setLogoFile]         = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (!sLoading) setVenueForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  const saveVenue = async () => {
    setSavingVenue(true)
    const results = await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_name',    value: venueForm.venue_name },    { onConflict: 'venue_id,key' }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'manager_email', value: venueForm.manager_email }, { onConflict: 'venue_id,key' }),
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
      {active === null ? (
        <>
          <h1 className="text-2xl font-bold text-charcoal dark:text-white">Settings</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-white/5 rounded-2xl text-left hover:bg-charcoal/[0.02] dark:hover:bg-white/[0.03] transition-colors border border-charcoal/8 dark:border-white/8"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal dark:text-white">{s.label}</p>
                  <p className="text-xs text-charcoal/45 dark:text-white/40 mt-0.5 truncate">{s.subtitle}</p>
                </div>
                <span className="text-charcoal/35 dark:text-white/30 shrink-0">→</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setActive(null)}
            className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-charcoal/12 dark:border-white/15 text-xs font-medium text-charcoal/60 dark:text-white/60 hover:text-charcoal hover:border-charcoal/30 dark:hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All settings
          </button>

          {active === 'venue' && (
            <SettingsSection title="Your Venue" subtitle="Name, logo, theme and app icon" defaultOpen>
              <div className="flex flex-col gap-4">
                {/* Venue Name + Manager Email side by side */}
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Venue Name</label>
                      <input
                        value={venueForm.venue_name}
                        onChange={e => setVenueForm(f => ({ ...f, venue_name: e.target.value }))}
                        placeholder="e.g. The Crown Bar & Kitchen"
                        className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Manager Email</label>
                      <input
                        type="email"
                        value={venueForm.manager_email}
                        onChange={e => setVenueForm(f => ({ ...f, manager_email: e.target.value }))}
                        placeholder="manager@yoursite.com"
                        className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                      />
                    </div>
                  </div>
                  <button
                    onClick={saveVenue}
                    disabled={savingVenue}
                    className="h-9 px-4 rounded-lg bg-charcoal text-cream text-sm font-medium disabled:opacity-40 self-start mt-3"
                  >
                    {savingVenue ? 'Saving…' : 'Save Changes →'}
                  </button>
                </div>

                {/* Logo upload */}
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Venue Logo</label>
                  <div className="flex items-center gap-3 flex-wrap pt-2">
                    {settings.logo_url && (
                      <img
                        src={settings.logo_url}
                        alt="Venue logo"
                        className="h-10 w-10 rounded-lg object-contain border border-charcoal/10 bg-white p-1 shrink-0"
                        loading="lazy"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setLogoFile(e.target.files[0] ?? null)}
                      className="text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-white file:text-charcoal/60 hover:file:bg-cream"
                    />
                    {logoFile && (
                      <button
                        onClick={() => uploadLogo(logoFile)}
                        disabled={uploadingLogo}
                        className="h-9 px-4 rounded-lg bg-charcoal text-cream text-xs font-medium disabled:opacity-40 shrink-0"
                      >
                        {uploadingLogo ? 'Uploading…' : 'Upload →'}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-charcoal/35 mt-1.5">PNG or SVG recommended.</p>
                </div>

                {/* Theme mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-charcoal dark:text-white">Appearance</p>
                    <p className="text-xs text-charcoal/40 dark:text-white/40 mt-0.5">
                      {themeMode === 'system' ? 'Following your device settings.' : dark ? 'Dark theme active.' : 'Light theme active.'}
                    </p>
                  </div>
                  <div className="flex bg-charcoal/8 dark:bg-white/10 rounded-lg p-0.5">
                    {[
                      { id: 'light', icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                        </svg>
                      )},
                      { id: 'dark', icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      )},
                      { id: 'system', icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                        </svg>
                      )},
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setThemeMode(opt.id)}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                          themeMode === opt.id
                            ? 'bg-white dark:bg-charcoal text-charcoal dark:text-white shadow-sm'
                            : 'text-charcoal/50 dark:text-white/50 hover:text-charcoal dark:hover:text-white'
                        }`}
                      >
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                </div>

                <AppIconPicker />
              </div>
            </SettingsSection>
          )}

          {active === 'venues' && <VenuesSection />}

          {active === 'staff' && <StaffMembersSection />}

          {active === 'invite' && <VenueCodeSection venueId={venueId} sessionToken={session?.token} />}

          {active === 'roles' && (
            <>
              <SettingsSection
                title="Roles & Skills"
                subtitle="Define the roles in your business, assign them to staff and use them in the rota builder"
                locked={venuePlan !== PLANS.PRO}
                defaultOpen
              >
                <RolesSection />
              </SettingsSection>
              <SettingsSection
                title="Permission Titles"
                subtitle="Create reusable access levels for this venue"
                locked={venuePlan !== PLANS.PRO}
                defaultOpen
              >
                <PermissionTitlesSection
                  venueId={venueId}
                  titles={settings.permission_titles}
                  reloadSettings={reloadSettings}
                />
              </SettingsSection>
            </>
          )}

          {active === 'duties' && (
            <SettingsSection title="Duties" subtitle="Named task bundles assigned to staff per shift" defaultOpen>
              <DutiesSection />
            </SettingsSection>
          )}

          {active === 'shifts' && (
            <SettingsSection title="Shifts & Breaks" subtitle={`Adult break: ${breakDurationMins} min · Under-18: 30 min`} locked={venuePlan !== PLANS.PRO} defaultOpen>
              <div className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">Adult break (shifts &gt;6h)</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">Deducted from worked hours · UK minimum 20 min</p>
                </div>
                <div className="inline-flex p-0.5 rounded-lg bg-charcoal/5 border border-charcoal/8 gap-0.5">
                  {[15, 20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => saveBreakDuration(mins)}
                      className={[
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        breakDurationMins === mins
                          ? 'bg-white text-charcoal shadow-sm'
                          : 'text-charcoal/50 hover:text-charcoal',
                      ].join(' ')}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 py-3 border-t border-charcoal/6">
                <div>
                  <p className="text-sm font-medium text-charcoal">Clean-up grace period</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">Clock-outs within this window won't show as a discrepancy</p>
                </div>
                <div className="inline-flex p-0.5 rounded-lg bg-charcoal/5 border border-charcoal/8 gap-0.5">
                  {[0, 15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => saveCleanupMinutes(mins)}
                      className={[
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        cleanupMinutes === mins
                          ? 'bg-white text-charcoal shadow-sm'
                          : 'text-charcoal/50 hover:text-charcoal',
                      ].join(' ')}
                    >
                      {mins === 0 ? 'None' : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>
            </SettingsSection>
          )}

          {active === 'hours' && (
            <SettingsSection
              title="Opening Hours"
              subtitle={closedDays.length === 0 ? 'All 7 days open' : `Closed: ${closedDays.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', ')}`}
              locked={venuePlan !== PLANS.PRO}
              defaultOpen
            >
              <p className="text-xs text-charcoal/40 mb-4">
                Mark days the venue is closed. Closed days are skipped by the rota builder and greyed out in the schedule.
              </p>
              <div className="flex gap-2 flex-wrap mb-8">
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

              {/* Trading hours */}
              <div className="border-t border-charcoal/10 pt-6 mb-6">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Trading Hours</p>
                <p className="text-xs text-charcoal/40 mb-4">Set the hours your venue is open. Used to contextualise records and reports.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Opens</label>
                    <TimeSelect value={openTime} onChange={saveOpenTime} />
                  </div>
                  <div>
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Closes</label>
                    <TimeSelect value={closeTime} onChange={saveCloseTime} />
                  </div>
                </div>
              </div>

              {/* Closed periods */}
              <div className="border-t border-charcoal/10 pt-6">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Closed Periods</p>
                <p className="text-xs text-charcoal/40 mb-5">
                  Mark your venue as closed for a specific date range — e.g. Christmas week, annual holiday. This flags the period across the app so staff aren't expected to complete checks.
                </p>

                {closures.length > 0 && (
                  <div className="flex flex-col gap-2 mb-5">
                    {closures.map(c => {
                      const past = c.end_date < format(new Date(), 'yyyy-MM-dd')
                      return (
                        <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${past ? 'bg-charcoal/2 border-charcoal/8 opacity-50' : 'bg-white border-charcoal/10'}`}>
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

                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-charcoal/10">
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
              </div>
            </SettingsSection>
          )}

          {active === 'actions' && (
            <SettingsSection
              title="Daily Actions"
              subtitle="Configure which checks appear on the dashboard and on which days"
              defaultOpen
            >
              <ActionSchedulesSection schedules={actionSchedules} onSave={saveActionSchedules} />
            </SettingsSection>
          )}

          {active === 'modules' && (
            <SettingsSection
              title="Modules"
              subtitle={featuresConfig.mode === 'all' ? 'All modules enabled' : `Custom: ${featuresConfig.enabled?.length ?? 0} enabled`}
              defaultOpen
            >
              <VenueTypeIndicator venueId={venueId} venueSlug={venueSlug} />

              <div className="inline-flex p-0.5 rounded-lg bg-charcoal/5 border border-charcoal/8 gap-0.5 mb-5">
                {['all', 'custom'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => saveFeatures({
                      mode,
                      enabled: mode === 'all' ? ALL_FEATURE_IDS : (featuresConfig.enabled ?? ALL_FEATURE_IDS),
                    })}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      featuresConfig.mode === mode
                        ? 'bg-white text-charcoal shadow-sm'
                        : 'text-charcoal/50 hover:text-charcoal'
                    }`}
                  >
                    {mode === 'all' ? 'All modules' : 'Custom'}
                  </button>
                ))}
              </div>

              {featuresConfig.mode === 'custom' && (
                <div className="space-y-4">
                  {FEATURE_GROUPS.map(group => {
                    const allOn = group.features.every(f => featuresConfig.enabled?.includes(f.id))
                    return (
                      <div key={group.id} className="rounded-xl border border-charcoal/10 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-charcoal/3 border-b border-charcoal/8">
                          <div>
                            <p className="text-sm font-semibold text-charcoal">{group.label}</p>
                            <p className="text-[11px] text-charcoal/40 mt-0.5">{group.description}</p>
                          </div>
                          <Toggle checked={allOn} onChange={() => handleToggleGroup(group.features, allOn)} />
                        </div>
                        <div className="divide-y divide-charcoal/6">
                          {group.features.map(feature => {
                            const isProOnly = PRO_ONLY_FEATURE_IDS.includes(feature.id)
                            const locked    = isProOnly && venuePlan !== PLANS.PRO
                            const on        = !locked && (featuresConfig.enabled?.includes(feature.id) ?? true)
                            return (
                              <div key={feature.id} className={`grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 ${locked ? 'opacity-60' : ''}`}>
                                <div className="min-w-0 pr-4">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-medium ${on ? 'text-charcoal' : 'text-charcoal/35'}`}>{feature.label}</p>
                                    {locked && <span className="text-[11px] font-bold tracking-wider uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">Pro</span>}
                                  </div>
                                  <p className="text-[11px] text-charcoal/40 mt-0.5">{feature.description}</p>
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
                <p className="text-xs text-charcoal/35 italic">
                  All {ALL_FEATURE_IDS.length} modules are enabled. Switch to Custom to hide any that don't apply to your business.
                </p>
              )}
            </SettingsSection>
          )}

          {active === 'navorder' && (
            <NavOrderSection
              isEnabled={isEnabled}
              venuePlan={venuePlan}
              complianceNavOrder={complianceNavOrder}
              saveComplianceNavOrder={saveComplianceNavOrder}
            />
          )}

          {active === 'notif' && (
            <SettingsSection title="Notifications" subtitle="Push alerts and fridge check reminder" defaultOpen>
              <NotificationsPanel session={session} toast={toast} settings={settings} />
              <div className="border-t border-charcoal/8 pt-4 mt-4">
                <p className="text-sm font-medium text-charcoal mb-0.5">Fridge check reminder</p>
                <p className="text-xs text-charcoal/40 mb-3">
                  Send a push notification to managers if no fridge temperatures have been logged by this time.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={fridgeCheckTime}
                    onChange={e => saveFridgeCheckTime(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                  />
                  <span className="text-xs text-charcoal/40">Push sent to managers with notifications enabled</span>
                </div>
              </div>
            </SettingsSection>
          )}

          {active === 'help' && <HelpSection />}
        </>
      )}
    </div>
  )
}
