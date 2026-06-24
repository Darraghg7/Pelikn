import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useTheme } from '../../contexts/ThemeContext'
import useVenueSettings from '../../hooks/useVenueSettings'
import TimeSelect from '../../components/ui/TimeSelect'
import VenuesSection from './VenuesSection'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Group({ label, children, foot }) {
  return (
    <div>
      {label && (
        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pt-[18px] pb-1.5">{label}</div>
      )}
      <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] overflow-hidden">
        {children}
      </div>
      {foot && <div className="text-[11.5px] text-charcoal/50 px-1 pt-2 leading-[1.45]">{foot}</div>}
    </div>
  )
}

function Row({ label, sub, children, last }) {
  return (
    <div className={`flex items-center gap-3 px-[15px] py-[13px] ${last === false ? 'border-t border-charcoal/6' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-charcoal tracking-[-0.005em]">{label}</div>
        {sub && <div className="text-[11.5px] text-charcoal/50 mt-0.5 leading-[1.4]">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export default function VenueSettingsPage() {
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

  useEffect(() => {
    if (!sLoading) setForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  const saveDetails = async () => {
    setSaving(true)
    await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_name',    value: form.venue_name },    { onConflict: 'venue_id,key' }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'manager_email', value: form.manager_email }, { onConflict: 'venue_id,key' }),
    ])
    setSaving(false)
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
    if (upErr) { setUploadingLogo(false); return }
    const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path)
    await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'logo_url', value: urlData.publicUrl + '?t=' + Date.now() }, { onConflict: 'venue_id,key' })
    setUploadingLogo(false)
    setLogoFile(null)
    reloadSettings()
  }

  const toggleClosedDay = async (i) => {
    const next = closedDays.includes(i) ? closedDays.filter(d => d !== i) : [...closedDays, i]
    await saveClosedDays(next)
  }

  return (
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Venue" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="px-4 pb-24 max-w-[480px] mx-auto">
      <div className="flex flex-col gap-4">

        <Group label="Details">
          <div className="px-[15px] py-[13px] flex flex-col gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-charcoal/50 mb-1.5">Venue name</div>
              <input
                value={form.venue_name}
                onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                placeholder="e.g. The Crown Bar & Kitchen"
                className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-sm text-charcoal outline-none box-border"
              />
            </div>
            <div>
              <div className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-charcoal/50 mb-1.5">Manager email</div>
              <input
                type="email"
                value={form.manager_email}
                onChange={e => setForm(f => ({ ...f, manager_email: e.target.value }))}
                placeholder="manager@venue.com"
                className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-sm text-charcoal outline-none box-border"
              />
            </div>
            <button
              onClick={saveDetails}
              disabled={saving}
              className={`self-start h-9 px-4 rounded-[9px] border-0 text-[13px] font-semibold text-white transition-colors duration-200 ${saving ? 'opacity-60 cursor-default' : 'cursor-pointer'} ${saveSuccess ? 'bg-success' : 'bg-brand'}`}
            >
              {saving ? 'Saving…' : saveSuccess ? '✓ Saved' : 'Save changes'}
            </button>
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
              <div key={i} className={`flex items-center gap-2.5 px-[15px] py-2.5 ${i === 0 ? '' : 'border-t border-charcoal/6'}`}>
                <div className={`w-9 text-[13px] font-semibold shrink-0 ${isClosed ? 'text-charcoal/30 line-through' : 'text-charcoal'}`}>{day}</div>
                {isClosed ? (
                  <div className="flex-1 text-xs text-charcoal/30 font-mono tracking-[0.04em]">CLOSED</div>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1"><TimeSelect value={hours.open} onChange={v => updateHours('open', v)} /></div>
                    <span className="text-charcoal/30 text-xs">–</span>
                    <div className="flex-1"><TimeSelect value={hours.close} onChange={v => updateHours('close', v)} /></div>
                  </div>
                )}
                <button
                  onClick={() => toggleClosedDay(i)}
                  className={`shrink-0 h-7 px-2.5 rounded-[7px] text-[11.5px] font-semibold cursor-pointer border-0 transition-all duration-150 ${isClosed ? 'bg-brand text-white' : 'bg-charcoal/6 text-charcoal/50'}`}
                >{isClosed ? 'Open' : 'Close'}</button>
              </div>
            )
          })}
        </Group>

        <Group label="Closed periods">
          <button
            onClick={() => navigate(vp('/calendar'))}
            className="w-full flex items-center justify-between gap-3 px-[15px] py-[14px] bg-transparent border-0 cursor-pointer text-left"
          >
            <div>
              <div className="text-sm font-medium text-charcoal">Manage in My Calendar</div>
              <div className="text-xs text-charcoal/50 mt-0.5">Closed periods are now created as calendar events under Team → My Calendar</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-charcoal/30"><path d="M1 1l4 4-4 4"/></svg>
          </button>
        </Group>

        <Group label="Branding">
          <div className="px-[15px] py-[13px] flex flex-col gap-2.5">
            <div className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-charcoal/50 mb-0.5">Venue logo</div>
            <div className="flex items-center gap-3 flex-wrap">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Venue logo" className="h-11 w-11 rounded-[10px] object-contain border border-charcoal/10 bg-charcoal/6 p-1" />
              )}
              <input
                type="file" accept="image/*"
                onChange={e => setLogoFile(e.target.files[0] ?? null)}
                className="text-[13px] text-charcoal/50"
              />
              {logoFile && (
                <button
                  onClick={() => uploadLogo(logoFile)}
                  disabled={uploadingLogo}
                  className={`h-[34px] px-[14px] rounded-lg border-0 cursor-pointer bg-brand text-white text-[13px] font-semibold ${uploadingLogo ? 'opacity-50' : ''}`}
                >
                  {uploadingLogo ? 'Uploading…' : 'Upload'}
                </button>
              )}
            </div>
            <div className="text-[11.5px] text-charcoal/30">PNG or SVG recommended. Shown in the app header.</div>
          </div>
        </Group>

        <Group label="Appearance">
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal">Theme</div>
              <div className="text-[11.5px] text-charcoal/50 mt-0.5">
                {themeMode === 'system' ? 'Following device settings' : dark ? 'Dark mode active' : 'Light mode active'}
              </div>
            </div>
            <div className="flex bg-charcoal/6 rounded-[9px] p-[3px] gap-0.5">
              {[
                { id: 'light', label: '☀️' },
                { id: 'dark',  label: '🌙' },
                { id: 'system', label: '💻' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setThemeMode(opt.id)}
                  className={`w-[34px] h-7 rounded-[7px] border-0 cursor-pointer text-sm transition-all duration-150 ${themeMode === opt.id ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </Group>

        <div>
          <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pb-1.5">My venues</div>
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] overflow-hidden py-1">
            <VenuesSection />
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
