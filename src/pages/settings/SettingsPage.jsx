import React, { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
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
import { PERMISSION_PRESETS, PERMISSION_TITLES_SETTING_KEY, PLANS, STAFF_PERMISSIONS, VENUE_PRESETS } from '../../lib/constants'
import SettingsSection from './SettingsSection'
import RolesSection from './RolesSection'
import DutiesSection from './DutiesSection'
import NotificationsPanel from './NotificationsPanel'
import VenuesSection from './VenuesSection'
import HelpSection from './HelpSection'

const VENUE_TYPE_ICONS = {
  cafe:       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  pub:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M3 11h14v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 11V7"/><path d="M11 11V7"/><path d="M5 7h10l-1-4H6z"/></svg>,
  restaurant: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  hotel:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
}

// ── App icon variants (inline SVG thumbnails) ───────────────────────────────

const ICON_VARIANTS = [
  {
    id:    'light',
    label: 'Light',
    bg:    '#FFFFFF',
    fg:    '#1E3A2F',
    iconName: null,          // default icon — pass null to reset
  },
  {
    id:    'dark',
    label: 'Dark',
    bg:    '#1E3A2F',
    fg:    '#FFFFFF',
    iconName: 'AppIconDark',
  },
  {
    id:    'mint',
    label: 'Mint',
    bg:    '#1A1A18',
    fg:    '#5EEAAA',
    iconName: 'AppIconMint',
  },
]

function MortarSVG({ fg }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <line x1="82" y1="272" x2="322" y2="272" stroke={fg} strokeWidth="26" strokeLinecap="round"/>
      <path d="M 110 272 C 103 316 101 364 202 368 C 303 364 301 316 294 272" stroke={fg} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M 180 338 L 287 222 C 299 207 317 190 336 173 C 357 154 374 128 370 104 C 366 79 342 68 318 78 C 296 87 284 110 288 133 C 292 156 303 174 301 191" stroke={fg} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function AppIconPicker() {
  const [isNative, setIsNative] = useState(false)
  const [active, setActive]     = useState(() => localStorage.getItem('pelikn_icon_variant') ?? 'light')
  const [switching, setSwitching] = useState(false)
  const toast = useToast()

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      setIsNative(Capacitor.isNativePlatform())
    }).catch(() => {})
  }, [])

  if (!isNative) return null

  const switchIcon = async (variant) => {
    if (variant.id === active || switching) return
    setSwitching(true)
    try {
      const { AppIcon } = await import('@capacitor-community/app-icon')
      await AppIcon.change({ name: variant.iconName, suppressNotification: false })
      localStorage.setItem('pelikn_icon_variant', variant.id)
      setActive(variant.id)
      toast(`App icon changed to ${variant.label}`)
    } catch (err) {
      toast('Could not change icon — try updating the app', 'error')
      console.warn('[icon]', err)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="border-t border-charcoal/10 pt-4 mt-2">
      <p className="text-sm font-medium text-charcoal mb-1">App Icon</p>
      <p className="text-xs text-charcoal/40 mb-3">Choose the icon shown on your home screen.</p>
      <div className="flex gap-3">
        {ICON_VARIANTS.map(v => (
          <button
            key={v.id}
            onClick={() => switchIcon(v)}
            disabled={switching}
            className="flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <span className={[
              'w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center transition-all',
              active === v.id ? 'ring-2 ring-offset-2 ring-charcoal scale-105' : 'opacity-75 hover:opacity-100',
            ].join(' ')}
              style={{ backgroundColor: v.bg }}
            >
              <span className="w-8 h-8">
                <MortarSVG fg={v.fg} />
              </span>
            </span>
            <span className={`text-[11px] font-medium ${active === v.id ? 'text-charcoal' : 'text-charcoal/40'}`}>
              {v.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function VenueTypeIndicator({ venueId, venueSlug }) {
  const [venueType, setVenueType] = useState(null)
  const navigate = useNavigate()
  useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', 'venue_type').maybeSingle()
      .then(({ data }) => { if (data?.value) setVenueType(data.value) })
  }, [venueId])

  const reopenSetup = useCallback(() => {
    localStorage.removeItem('pelikn_setup_dismissed')
    window.dispatchEvent(new Event('pelikn:reopen-setup'))
    navigate(`/v/${venueSlug}/setup`)
  }, [venueSlug, navigate])

  const preset = VENUE_PRESETS.find(p => p.id === venueType)

  return (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand/5 border border-brand/15">
      {preset ? (
        <>
          <span className="text-lg">{VENUE_TYPE_ICONS[preset.icon] ?? ''}</span>
          <span className="text-sm font-medium text-brand">{preset.label}</span>
        </>
      ) : (
        <span className="text-sm text-charcoal/50">No venue type set</span>
      )}
      <button
        onClick={reopenSetup}
        className="text-[11px] text-brand/60 hover:text-brand transition-colors ml-auto underline underline-offset-2"
      >
        Re-run setup wizard
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENUE CODE (invite staff)
   ═══════════════════════════════════════════════════════════════════════════ */
function VenueCodeSection({ venueId, sessionToken, toast }) {
  const [code, setCode]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied]       = useState(false)
  const copyTimer                 = useRef(null)

  useEffect(() => {
    if (!venueId) return
    supabase.from('venues').select('join_code').eq('id', venueId).single()
      .then(({ data }) => { if (data?.join_code) setCode(data.join_code) })
      .finally(() => setLoading(false))
  }, [venueId])

  const copy = () => {
    if (!code) return
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Download Pelikn from the App Store, open it, tap "Join with venue code" and enter: ${code}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const regenerate = async () => {
    if (!sessionToken) return
    setRefreshing(true)
    const { data, error } = await supabase.rpc('regenerate_venue_join_code', { p_session_token: sessionToken })
    setRefreshing(false)
    if (error) { toast('Failed to regenerate code', 'error'); return }
    setCode(data)
    toast('New venue code generated')
  }

  return (
    <SettingsSection title="Invite Staff">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-charcoal/60 dark:text-white/60">
          Share this code with staff so they can join your venue on the app — no email or password needed.
        </p>

        {loading ? (
          <div className="h-14 bg-charcoal/5 rounded-xl animate-pulse" />
        ) : (
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-brand/5 border border-brand/20">
            <span className="font-mono text-2xl font-bold tracking-[0.25em] text-brand dark:text-accent flex-1">
              {code}
            </span>
            <button
              onClick={copy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-brand/25 text-brand dark:text-accent hover:bg-brand/10 transition-colors shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={shareWhatsApp}
            disabled={!code}
            className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#20bc5a] transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.502 3.934 1.385 5.612L0 24l6.562-1.366A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.032-1.384l-.361-.214-3.737.979.997-3.648-.235-.374A9.757 9.757 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818 5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
            </svg>
            Share via WhatsApp
          </button>
          <button
            onClick={regenerate}
            disabled={refreshing || !code}
            className="flex items-center gap-2 border border-charcoal/15 text-charcoal/60 dark:text-white/60 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-charcoal/30 hover:text-charcoal dark:hover:text-white transition-colors disabled:opacity-40"
          >
            <svg className={['w-3.5 h-3.5', refreshing ? 'animate-spin' : ''].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"/>
            </svg>
            {refreshing ? 'Refreshing…' : 'New code'}
          </button>
        </div>
        <p className="text-[11px] text-charcoal/35 dark:text-white/35">
          Tap "New code" if a staff member leaves — the old code stops working immediately.
        </p>
      </div>
    </SettingsSection>
  )
}

function PermissionTitlesSection({ venueId, titles, reloadSettings }) {
  const toast = useToast()
  const [draft, setDraft] = useState(() => titles?.length ? titles : PERMISSION_PRESETS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(titles?.length ? titles : PERMISSION_PRESETS)
  }, [titles])

  const updateTitle = (id, patch) => {
    setDraft(prev => prev.map(title => title.id === id ? { ...title, ...patch } : title))
  }

  const togglePermission = (titleId, permissionId, on) => {
    setDraft(prev => prev.map(title => {
      if (title.id !== titleId) return title
      const permissions = new Set(title.permissions)
      on ? permissions.add(permissionId) : permissions.delete(permissionId)
      return { ...title, permissions: [...permissions] }
    }))
  }

  const addTitle = () => {
    setDraft(prev => [...prev, { id: `custom-${Date.now()}`, label: 'New title', permissions: [] }])
  }

  const removeTitle = (id) => {
    setDraft(prev => prev.filter(title => title.id !== id))
  }

  const saveTitles = async () => {
    const cleaned = draft
      .map(title => ({
        ...title,
        label: title.label.trim(),
        permissions: title.permissions.filter(id => STAFF_PERMISSIONS.some(p => p.id === id)),
      }))
      .filter(title => title.label)

    if (!cleaned.length) { toast('Add at least one permission title', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('app_settings').upsert({
      venue_id: venueId,
      key: PERMISSION_TITLES_SETTING_KEY,
      value: JSON.stringify(cleaned),
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Permission titles saved')
    reloadSettings()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-charcoal/45">
        Create the access titles used when editing staff members. Each venue can keep its own set.
      </p>

      <div className="flex flex-col gap-3">
        {draft.map(title => (
          <div key={title.id} className="rounded-xl border border-charcoal/10 bg-white p-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                value={title.label}
                onChange={e => updateTitle(title.id, { label: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
              <button
                onClick={() => removeTitle(title.id)}
                className="text-xs text-danger/45 hover:text-danger px-2 py-1"
              >
                Remove
              </button>
            </div>

            {['Compliance', 'Operations', 'Team'].map(category => (
              <div key={category} className="mb-3 last:mb-0">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-1.5">{category}</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {STAFF_PERMISSIONS.filter(p => p.category === category).map(permission => (
                    <label key={permission.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-charcoal/2">
                      <span className="text-xs text-charcoal/65">{permission.label}</span>
                      <Toggle
                        checked={title.permissions.includes(permission.id)}
                        onChange={on => togglePermission(title.id, permission.id, on)}
                        size="sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={addTitle}
          className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
        >
          + Add Title
        </button>
        <button
          onClick={saveTitles}
          disabled={saving}
          className="bg-charcoal text-cream px-5 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Titles →'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const toast = useToast()
  const { session } = useSession()
  const { venueId, venueSlug } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { closures, reload: reloadClosures } = useVenueClosures()
  const { closedDays, breakDurationMins, cleanupMinutes, fridgeCheckTime, openTime, closeTime, complianceNavOrder, saveClosedDays, saveBreakDuration, saveCleanupMinutes, saveFridgeCheckTime, saveOpenTime, saveCloseTime, saveComplianceNavOrder } = useAppSettings()
  const { dark, mode: themeMode, setMode: setThemeMode } = useTheme()
  const { config: featuresConfig, save: saveFeatures, venuePlan, isEnabled } = useVenueFeatures()

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

  // Features toggles
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
      <h1 className="text-2xl font-bold text-charcoal dark:text-white">Settings</h1>

      {/* ── Venue ──────────────────────────────────────────────────────────── */}
      <SettingsSection title="Venue" defaultOpen>
        <div className="flex flex-col gap-4">
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
                  className="h-12 w-12 rounded-lg object-contain border border-charcoal/10 bg-white p-1"
                  loading="lazy"
                />
              )}
              <div className="flex flex-col gap-2">
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
                    className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
                  >
                    {uploadingLogo ? 'Uploading…' : 'Upload Logo →'}
                  </button>
                )}
                <p className="text-[11px] text-charcoal/35">Displayed in the app header after login. PNG or SVG recommended.</p>
              </div>
            </div>
          </div>

          {/* Theme mode */}
          <div className="border-t border-charcoal/10 pt-4 mt-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal dark:text-white">Appearance</p>
              <p className="text-xs text-charcoal/40 dark:text-white/40 mt-0.5">
                {themeMode === 'system' ? 'Following your device settings.' : dark ? 'Dark theme active.' : 'Light theme active.'}
              </p>
            </div>
            <div className="flex bg-charcoal/8 dark:bg-white/10 rounded-lg p-0.5">
              {[
                { id: 'light', label: '☀️' },
                { id: 'dark', label: '🌙' },
                { id: 'system', label: '💻' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setThemeMode(opt.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    themeMode === opt.id
                      ? 'bg-white dark:bg-charcoal text-charcoal dark:text-white shadow-sm'
                      : 'text-charcoal/50 dark:text-white/50 hover:text-charcoal dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* App Icon picker — native iOS only */}
          <AppIconPicker />
        </div>
      </SettingsSection>

      {/* ── Invite Staff ───────────────────────────────────────────────────── */}
      <VenueCodeSection venueId={venueId} sessionToken={session?.token} toast={toast} />

      {/* ── Opening Hours ───────────────────────────────────────────────────── */}
      <SettingsSection
        title="Opening Hours"
        subtitle={closedDays.length === 0 ? 'All 7 days open' : `Closed: ${closedDays.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', ')}`}
        locked={venuePlan !== PLANS.PRO}
      >
        {/* Opening days */}
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

      {/* ── Permission Titles ──────────────────────────────────────────────── */}
      <SettingsSection
        title="Permission Titles"
        subtitle="Create reusable access levels for this venue"
        locked={venuePlan !== PLANS.PRO}
      >
        <PermissionTitlesSection
          venueId={venueId}
          titles={settings.permission_titles}
          reloadSettings={reloadSettings}
        />
      </SettingsSection>

      {/* ── Roles & Skills ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="Roles & Skills"
        subtitle="Define the roles in your business — assign them to staff and use them in the rota builder"
        locked={venuePlan !== PLANS.PRO}
      >
        <RolesSection />
      </SettingsSection>

      {/* ── Duties ─────────────────────────────────────────────────────────── */}
      <SettingsSection
        title="Duties"
        subtitle="Named task bundles assigned to staff per shift"
      >
        <DutiesSection />
      </SettingsSection>

      {/* ── Shifts & Breaks ────────────────────────────────────────────────── */}
      <SettingsSection title="Shifts & Breaks" subtitle={`Adult break: ${breakDurationMins} min · Under-18: 30 min`} locked={venuePlan !== PLANS.PRO}>
        <p className="text-sm text-charcoal/50 mb-5">
          Set the unpaid break deducted from worked hours for adult staff (18+) on shifts over 6 hours. UK law requires a minimum of 20 minutes. Under-18 staff always get 30 minutes as required by law.
        </p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">Break duration (adults, shifts &gt;6h)</p>
            <p className="text-xs text-charcoal/40 mt-0.5">Deducted from worked hours</p>
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

        <div className="mt-5 pt-5 border-t border-charcoal/6">
          <p className="text-sm font-medium text-charcoal mb-0.5">Clean-up time</p>
          <p className="text-xs text-charcoal/40 mt-0.5 mb-3">
            Grace period after shift end for cleaning and closing tasks. Clock-outs within this window won't show as a discrepancy on timesheets.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {[0, 15, 30, 45, 60].map(mins => (
              <button
                key={mins}
                onClick={() => saveCleanupMinutes(mins)}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  cleanupMinutes === mins
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                ].join(' ')}
              >
                {mins === 0 ? 'None' : `${mins}m`}
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* ── Notifications ──────────────────────────────────────────────────── */}
      <SettingsSection title="Notifications" subtitle="Push alerts · Fridge reminder">
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

      {/* ── Modules ────────────────────────────────────────────────────────── */}
      <SettingsSection
        title="Modules"
        subtitle={featuresConfig.mode === 'all' ? 'All modules enabled' : `Custom — ${featuresConfig.enabled?.length ?? 0} enabled`}
      >
        <p className="text-xs text-charcoal/40 dark:text-white/40 mb-4">
          Choose which modules are available in this venue. Disabled modules are hidden from the navigation.
        </p>

        {/* Venue type indicator */}
        <VenueTypeIndicator venueId={venueId} venueSlug={venueSlug} />

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
              {mode === 'all' ? 'All Modules' : 'Custom'}
            </button>
          ))}
        </div>

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
            All {ALL_FEATURE_IDS.length} modules are enabled. Switch to Custom to hide any that don't apply to your business.
          </p>
        )}
      </SettingsSection>

      {/* ── Venues (multi-venue, Pro only) ─────────────────────────────────── */}
      {/* ── Navigation Order ──────────────────────────────────────────────── */}
      <NavOrderSection
        isEnabled={isEnabled}
        venuePlan={venuePlan}
        complianceNavOrder={complianceNavOrder}
        saveComplianceNavOrder={saveComplianceNavOrder}
      />

      <VenuesSection />
      <HelpSection />
    </div>
  )
}

/* ── Compliance navigation order ────────────────────────────────────────── */

const COMPLIANCE_NAV_ITEMS = [
  { key: 'opening-closing', label: 'Opening & Closing Checks', feature: 'opening_closing' },
  { key: 'fitness',         label: 'Fitness to Work',          feature: null },
  { key: 'fridge',          label: 'Fridge Temps',             feature: 'fridge' },
  { key: 'cooking-temps',   label: 'Cooking Temps',            feature: null },
  { key: 'hot-holding',     label: 'Hot Holding',              feature: null },
  { key: 'cooling-logs',    label: 'Cooling Logs',             feature: null },
  { key: 'deliveries',      label: 'Deliveries',               feature: 'deliveries' },
  { key: 'probe',           label: 'Probe Calibration',        feature: 'probe' },
  { key: 'allergens',       label: 'Allergens',                feature: 'allergens' },
  { key: 'cleaning',        label: 'Cleaning',                 feature: 'cleaning' },
  { key: 'corrective',      label: 'Corrective Actions',       feature: 'corrective' },
]

function NavOrderSection({ isEnabled, venuePlan, complianceNavOrder, saveComplianceNavOrder }) {
  const activeItems = COMPLIANCE_NAV_ITEMS.filter(i => i.feature === null || isEnabled(i.feature))

  const orderedItems = complianceNavOrder.length
    ? [...activeItems].sort((a, b) => {
        const ai = complianceNavOrder.indexOf(a.key)
        const bi = complianceNavOrder.indexOf(b.key)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : activeItems

  const move = (index, direction) => {
    const next = [...orderedItems]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= next.length) return
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    saveComplianceNavOrder(next.map(i => i.key))
  }

  const subtitle = `${activeItems.length} item${activeItems.length !== 1 ? 's' : ''}`

  return (
    <SettingsSection title="Navigation Order" subtitle={subtitle} locked={venuePlan !== PLANS.PRO}>
      <p className="text-xs text-charcoal/40 mb-4">
        Reorder the items in the Checks navigation to suit your workflow.
      </p>
      <div className="flex flex-col gap-1.5">
        {orderedItems.map((item, i) => (
          <div key={item.key} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-charcoal/3 border border-charcoal/8">
            <span className="flex-1 text-sm font-medium text-charcoal">{item.label}</span>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-0.5 text-charcoal/30 hover:text-charcoal disabled:opacity-20 transition-colors"
                aria-label="Move up"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === orderedItems.length - 1}
                className="p-0.5 text-charcoal/30 hover:text-charcoal disabled:opacity-20 transition-colors"
                aria-label="Move down"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}
