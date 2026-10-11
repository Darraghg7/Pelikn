import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useTheme } from '../../contexts/ThemeContext'
import useVenueSettings from '../../hooks/useVenueSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { useToast } from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import TimeSelect from '../../components/ui/TimeSelect'
import VenuesSection from './VenuesSection'
import AppIconPicker from './AppIconPicker'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'
import Button from '../../components/ui/Button'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Group({ label, children, foot }) {
  return (
    <div>
      {label && (
        <div className="font-mono text-micro font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 px-0.5 pt-[18px] pb-1.5">{label}</div>
      )}
      <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
        {children}
      </div>
      {foot && <div className="text-caption text-charcoal/50 dark:text-white/40 px-1 pt-2 leading-[1.45]">{foot}</div>}
    </div>
  )
}

function Row({ label, sub, children, last }) {
  return (
    <div className={`flex items-center gap-3 px-[15px] py-[13px] ${last === false ? 'border-t border-charcoal/6 dark:border-white/8' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">{label}</div>
        {sub && <div className="text-caption text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

const fieldClass = 'w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 dark:border-white/10 bg-transparent text-sm text-charcoal dark:text-white outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 focus:border-charcoal/20 dark:focus:border-white/20 box-border'

function fmtRange(c) {
  const start = format(parseISO(c.start_date), 'd MMM yyyy')
  return c.start_date === c.end_date ? start : `${start} – ${format(parseISO(c.end_date), 'd MMM yyyy')}`
}

// Writes venue_closures directly — the list checks, cleaning and the dashboard
// read — so every plan can mark closures, not just venues with My Calendar.
// Rows linked to a calendar event (migration 140) are the same closure; removing
// one here removes the event too.
function ClosedPeriodsGroup({ venueId }) {
  const toast = useToast()
  const { closures, reload } = useVenueClosures()
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = closures.filter(c => c.end_date >= today)

  const add = async () => {
    if (!form.start_date || !form.end_date) return
    if (form.end_date < form.start_date) { toast('End date must be on or after start date', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('venue_closures').insert({
      venue_id:   venueId,
      start_date: form.start_date,
      end_date:   form.end_date,
      reason:     form.reason.trim() || null,
    })
    setSaving(false)
    if (error) { toast('Could not add closed period — please try again', 'error'); return }
    toast('Closed period added')
    setForm({ start_date: '', end_date: '', reason: '' })
    reload()
  }

  const remove = async (c) => {
    const { error } = await supabase.from('venue_closures').delete().eq('id', c.id)
    if (error) { toast('Could not remove closed period — please try again', 'error'); return }
    toast('Closed period removed')
    reload()
  }

  return (
    <>
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove closed period?"
        message={removeTarget ? `Checks will be expected again on ${fmtRange(removeTarget)}.${removeTarget.calendar_event_id ? ' This also removes it from My Calendar.' : ''}` : ''}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { remove(removeTarget); setRemoveTarget(null) }}
      />
      <Group
        label="Closed periods"
        foot="Holidays, refits, one-off closures. Checks and cleaning aren't expected on these days. Closures added in the Rota or My Calendar show here too."
      >
        {upcoming.map((c, i) => (
          <div key={c.id} className={`flex items-center gap-3 px-[15px] py-[13px] ${i === 0 ? '' : 'border-t border-charcoal/6 dark:border-white/8'}`}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white">{fmtRange(c)}</div>
              {c.reason && <div className="text-caption text-charcoal/50 dark:text-white/40 mt-0.5">{c.reason}</div>}
            </div>
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => setRemoveTarget(c)}
              className="shrink-0"
            >Remove</Button>
          </div>
        ))}
        <div className={`px-[15px] py-[13px] flex flex-col gap-3 ${upcoming.length ? 'border-t border-charcoal/6 dark:border-white/8' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">From</div>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date && f.end_date >= e.target.value ? f.end_date : e.target.value }))} className={fieldClass} />
            </div>
            <div>
              <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">To</div>
              <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={fieldClass} />
            </div>
          </div>
          <div>
            <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">Reason (optional)</div>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Christmas, refit" className={fieldClass} />
          </div>
          <Button
            size="sm"
            loading={saving}
            onClick={add}
            disabled={saving || !form.start_date || !form.end_date}
            className="self-start"
          >
            {saving ? 'Saving…' : 'Add closed period'}
          </Button>
        </div>
      </Group>
    </>
  )
}

export default function VenueSettingsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { closedDays, openTime, closeTime, dayHours, saveClosedDays, saveOpenTime, saveCloseTime, saveDayHours } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const { dark, mode: themeMode, setMode: setThemeMode } = useTheme()

  const [form, setForm] = useState({ venue_name: '', manager_email: '' })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [fhrs, setFhrs] = useState({ rating: null, rated_at: '' })
  const [savingFhrs, setSavingFhrs] = useState(false)
  const [fhrsSaveSuccess, setFhrsSaveSuccess] = useState(false)

  useEffect(() => {
    if (!sLoading) setForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  useEffect(() => {
    if (!sLoading) setFhrs({ rating: settings.fhrs_rating, rated_at: settings.fhrs_rated_at ?? '' })
  }, [sLoading, settings])

  const saveDetails = async () => {
    setSaving(true)
    const results = await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_name',    value: form.venue_name },    { onConflict: 'venue_id,key' }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'manager_email', value: form.manager_email }, { onConflict: 'venue_id,key' }),
    ])
    setSaving(false)
    const failed = results.find(r => r.error)?.error
    if (failed) { toast("Couldn't save venue details: " + failed.message, 'error'); reloadSettings(); return }
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
    reloadSettings()
  }

  const uploadLogo = async (file) => {
    if (!file) return
    setUploadingLogo(true)
    const ext  = file.name.split('.').pop()
    const path = `${venueId}/logo/venue-logo.${ext}`
    const { error: upErr } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true })
    if (upErr) { setUploadingLogo(false); toast("Couldn't upload the logo: " + upErr.message, 'error'); return }
    const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path)
    const { error: saveErr } = await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'logo_url', value: urlData.publicUrl + '?t=' + Date.now() }, { onConflict: 'venue_id,key' })
    setUploadingLogo(false)
    if (saveErr) { toast("Logo uploaded but couldn't be saved — please try again", 'error'); return }
    setLogoFile(null)
    reloadSettings()
  }

  const saveFhrs = async () => {
    setSavingFhrs(true)
    const results = await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'fhrs_rating', value: fhrs.rating == null ? '' : String(fhrs.rating) }, { onConflict: 'venue_id,key' }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'fhrs_rated_at', value: fhrs.rated_at }, { onConflict: 'venue_id,key' }),
    ])
    setSavingFhrs(false)
    const failed = results.find(r => r.error)?.error
    if (failed) { toast("Couldn't save the hygiene rating: " + failed.message, 'error'); reloadSettings(); return }
    setFhrsSaveSuccess(true)
    setTimeout(() => setFhrsSaveSuccess(false), 2000)
    reloadSettings()
  }

  const toggleClosedDay = async (i) => {
    const next = closedDays.includes(i) ? closedDays.filter(d => d !== i) : [...closedDays, i]
    await saveClosedDays(next)
  }

  return (
    <div>
      <SettingsSubHeader title="Venue" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pb-24 max-w-[480px] mx-auto">
      <div className="flex flex-col gap-4">

        <Group label="Details">
          <div className="px-[15px] py-[13px] flex flex-col gap-3">
            <div>
              <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">Venue name</div>
              <input
                value={form.venue_name}
                onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                placeholder="e.g. The Crown Bar & Kitchen"
                className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 dark:border-white/10 text-sm text-charcoal dark:text-white outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 focus:border-charcoal/20 dark:focus:border-white/20 box-border"
              />
            </div>
            <div>
              <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">Manager email</div>
              <input
                type="email"
                value={form.manager_email}
                onChange={e => setForm(f => ({ ...f, manager_email: e.target.value }))}
                placeholder="manager@venue.com"
                className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 dark:border-white/10 text-sm text-charcoal dark:text-white outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 focus:border-charcoal/20 dark:focus:border-white/20 box-border"
              />
            </div>
            <Button
              size="sm"
              loading={saving}
              variant={saveSuccess ? 'success' : 'primary'}
              onClick={saveDetails}
              disabled={saving}
              className="self-start"
            >
              {saving ? 'Saving…' : saveSuccess ? '✓ Saved' : 'Save changes'}
            </Button>
          </div>
        </Group>

        <Group label="Food hygiene rating" foot="Your venue's official FSA/FHRS rating from its last real EHO inspection — shown next to your mock inspection score so you can compare the two.">
          <div className="px-[15px] py-[13px] flex flex-col gap-3">
            <div>
              <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">Rating (0–5)</div>
              <div className="flex gap-1.5 flex-wrap">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFhrs((f) => ({ ...f, rating: f.rating === n ? null : n }))}
                    className={`w-9 h-9 rounded-[9px] text-sm font-semibold border transition-colors ${fhrs.rating === n ? 'bg-brand text-white border-brand' : 'bg-transparent text-charcoal/60 dark:text-white/50 border-charcoal/15 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-1.5">Date of last inspection</div>
              <input
                type="date"
                value={fhrs.rated_at}
                onChange={(e) => setFhrs((f) => ({ ...f, rated_at: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 dark:border-white/10 text-sm text-charcoal dark:text-white outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 focus:border-charcoal/20 dark:focus:border-white/20 box-border"
              />
            </div>
            <Button
              size="sm"
              loading={savingFhrs}
              variant={fhrsSaveSuccess ? 'success' : 'primary'}
              onClick={saveFhrs}
              disabled={savingFhrs}
              className="self-start"
            >
              {savingFhrs ? 'Saving…' : fhrsSaveSuccess ? '✓ Saved' : 'Save rating'}
            </Button>
          </div>
        </Group>

        <Group label="Trading hours" foot="Set open and close times per day. Closed days are skipped by the rota builder.">
          {DAY_NAMES.map((day, i) => {
            const isClosed = closedDays.includes(i)
            const hours = dayHours[String(i)] ?? { open: openTime, close: closeTime }
            const updateHours = (field, val) => {
              const next = { ...dayHours, [String(i)]: { ...hours, [field]: val } }
              saveDayHours(next)
            }
            return (
              <div key={i} className={`flex items-center gap-2.5 px-[15px] py-2.5 ${i === 0 ? '' : 'border-t border-charcoal/6 dark:border-white/8'}`}>
                <div className={`w-9 text-body-sm font-semibold shrink-0 ${isClosed ? 'text-charcoal/30 dark:text-white/30 line-through' : 'text-charcoal dark:text-white'}`}>{day}</div>
                {isClosed ? (
                  <div className="flex-1 text-xs text-charcoal/30 dark:text-white/30 font-mono tracking-[0.04em]">CLOSED</div>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1"><TimeSelect value={hours.open} onChange={v => updateHours('open', v)} /></div>
                    <span className="text-charcoal/30 dark:text-white/30 text-xs">–</span>
                    <div className="flex-1"><TimeSelect value={hours.close} onChange={v => updateHours('close', v)} /></div>
                  </div>
                )}
                <button
                  onClick={() => toggleClosedDay(i)}
                  className={`shrink-0 h-7 px-2.5 rounded-[7px] text-caption font-semibold cursor-pointer border-0 transition-all duration-150 ${isClosed ? 'bg-brand text-white' : 'bg-charcoal/6 dark:bg-white/8 text-charcoal/50 dark:text-white/40'}`}
                >{isClosed ? 'Open' : 'Close'}</button>
              </div>
            )
          })}
        </Group>

        <ClosedPeriodsGroup venueId={venueId} />

        <Group label="Branding">
          <div className="px-[15px] py-[13px] flex flex-col gap-2.5">
            <div className="font-mono text-micro font-semibold tracking-[0.06em] uppercase text-charcoal/50 dark:text-white/40 mb-0.5">Venue logo</div>
            <div className="flex items-center gap-3 flex-wrap">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Venue logo" className="h-11 w-11 rounded-[10px] object-contain border border-charcoal/10 dark:border-white/10 bg-charcoal/6 dark:bg-white/8 p-1" />
              )}
              <input
                type="file" accept="image/*"
                onChange={e => setLogoFile(e.target.files[0] ?? null)}
                className="text-body-sm text-charcoal/50 dark:text-white/40"
              />
              {logoFile && (
                <Button
                  size="sm"
                  loading={uploadingLogo}
                  onClick={() => uploadLogo(logoFile)}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Uploading…' : 'Upload'}
                </Button>
              )}
            </div>
            <div className="text-caption text-charcoal/30 dark:text-white/30">PNG or SVG recommended. Shown in the app header.</div>
          </div>
        </Group>

        <Group label="Appearance">
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white">Theme</div>
              <div className="text-caption text-charcoal/50 dark:text-white/40 mt-0.5">
                {themeMode === 'system' ? 'Following device settings' : dark ? 'Dark mode active' : 'Light mode active'}
              </div>
            </div>
            <div className="flex bg-charcoal/6 dark:bg-white/8 rounded-[9px] p-[3px] gap-0.5">
              {[
                { id: 'light', label: '☀️' },
                { id: 'dark',  label: '🌙' },
                { id: 'system', label: '💻' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setThemeMode(opt.id)}
                  className={`w-[34px] h-7 rounded-[7px] border-0 cursor-pointer text-sm transition-all duration-150 ${themeMode === opt.id ? 'bg-white dark:bg-paperDark shadow-sm' : 'bg-transparent'}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Renders nothing outside the native iOS/Android app */}
          <AppIconPicker />
        </Group>

        <div>
          <div className="font-mono text-micro font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 px-0.5 pb-1.5">My venues</div>
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden py-1">
            <VenuesSection />
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
