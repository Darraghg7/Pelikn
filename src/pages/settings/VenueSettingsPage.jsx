import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useTheme } from '../../contexts/ThemeContext'
import useVenueSettings from '../../hooks/useVenueSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import TimeSelect from '../../components/ui/TimeSelect'
import VenuesSection from './VenuesSection'

const MC = {
  brand: '#13362a', brandTint: '#eef4f0',
  good:  '#1a7a4c', goodBg: '#e3f0e7',
  ink:   '#0d1a14', ink3: '#76817b', ink4: '#b3b9b5',
  line:  '#e4e6e2', line2: '#eef0ec',
  paper: '#ffffff', bg: '#f3f3ef',
  bad:   '#b3331c',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function SubHeader({ title, onBack }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(243,243,239,0.92)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `1px solid ${MC.line}`,
      padding: '12px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: MC.brand, background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 0', fontFamily: SANS, fontSize: 15, fontWeight: 500,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L1.5 7.5 8 14"/>
        </svg>
        Settings
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: MC.ink }}>{title}</span>
      <span style={{ width: 70 }} />
    </div>
  )
}
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Group({ label, children, foot }) {
  return (
    <div>
      {label && (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>{label}</div>
      )}
      <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
        {children}
      </div>
      {foot && <div style={{ fontSize: 11.5, color: MC.ink3, padding: '8px 4px 0', lineHeight: 1.45 }}>{foot}</div>}
    </div>
  )
}

function Row({ label, sub, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: last === false ? `1px solid ${MC.line2}` : 'none' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export default function VenueSettingsPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { closures, reload: reloadClosures } = useVenueClosures()
  const { closedDays, openTime, closeTime, dayHours, saveClosedDays, saveOpenTime, saveCloseTime, saveDayHours } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const { dark, mode: themeMode, setMode: setThemeMode } = useTheme()

  const [form, setForm] = useState({ venue_name: '', manager_email: '' })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [closureForm, setClosureForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [savingClosure, setSavingClosure] = useState(false)

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

  const addClosure = async () => {
    if (!closureForm.start_date || !closureForm.end_date) return
    setSavingClosure(true)
    await supabase.from('venue_closures').insert({
      venue_id:   venueId,
      start_date: closureForm.start_date,
      end_date:   closureForm.end_date,
      reason:     closureForm.reason.trim() || null,
    })
    setSavingClosure(false)
    setClosureForm({ start_date: '', end_date: '', reason: '' })
    reloadClosures()
  }

  const deleteClosure = async (id) => {
    await supabase.from('venue_closures').delete().eq('id', id)
    reloadClosures()
  }

  return (
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Venue" onBack={() => navigate(vp('/settings/hub'))} />

      <div style={{ padding: '0 16px 96px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Venue details */}
        <Group label="Details">
          <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Venue name</div>
              <input
                value={form.venue_name}
                onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                placeholder="e.g. The Crown Bar & Kitchen"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 14, color: MC.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Manager email</div>
              <input
                type="email"
                value={form.manager_email}
                onChange={e => setForm(f => ({ ...f, manager_email: e.target.value }))}
                placeholder="manager@venue.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 14, color: MC.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={saveDetails}
              disabled={saving}
              style={{
                alignSelf: 'flex-start', height: 36, padding: '0 16px', borderRadius: 9, border: 'none', cursor: saving ? 'default' : 'pointer',
                background: saveSuccess ? MC.good : MC.brand, color: '#fff',
                fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1, transition: 'background .2s',
              }}
            >
              {saving ? 'Saving…' : saveSuccess ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </Group>

        {/* Trading hours — per day */}
        <Group label="Trading hours" foot="Set open and close times per day. Closed days are skipped by the rota builder.">
          {DAY_NAMES.map((day, i) => {
            const isClosed = closedDays.includes(i)
            const hours = dayHours[String(i)] ?? { open: openTime, close: closeTime }
            const updateHours = (field, val) => {
              const next = { ...dayHours, [String(i)]: { ...hours, [field]: val } }
              saveDayHours(next)
            }
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 15px', borderTop: i === 0 ? 'none' : `1px solid ${MC.line2}` }}>
                <div style={{ width: 36, fontSize: 13, fontWeight: 600, color: isClosed ? MC.ink4 : MC.ink, textDecoration: isClosed ? 'line-through' : 'none', flexShrink: 0 }}>{day}</div>
                {isClosed ? (
                  <div style={{ flex: 1, fontSize: 12, color: MC.ink4, fontFamily: MONO, letterSpacing: '0.04em' }}>CLOSED</div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1 }}><TimeSelect value={hours.open} onChange={v => updateHours('open', v)} /></div>
                    <span style={{ color: MC.ink4, fontSize: 12 }}>–</span>
                    <div style={{ flex: 1 }}><TimeSelect value={hours.close} onChange={v => updateHours('close', v)} /></div>
                  </div>
                )}
                <button
                  onClick={() => toggleClosedDay(i)}
                  style={{
                    flexShrink: 0, height: 28, padding: '0 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .15s',
                    background: isClosed ? MC.brand : MC.line2,
                    color: isClosed ? '#fff' : MC.ink3,
                  }}
                >{isClosed ? 'Open' : 'Close'}</button>
              </div>
            )
          })}
        </Group>

        {/* Closed periods */}
        <Group label="Closed periods" foot="Mark the venue closed for a date range — e.g. Christmas week. Checks won't be expected during these dates.">
          <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {closures.filter(c => c.end_date >= format(new Date(), 'yyyy-MM-dd')).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, background: MC.paper }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: MC.ink }}>
                      {format(parseISO(c.start_date), 'd MMM yyyy')}
                      {c.start_date !== c.end_date && ` – ${format(parseISO(c.end_date), 'd MMM yyyy')}`}
                    </div>
                    {c.reason && <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2 }}>{c.reason}</div>}
                  </div>
                  <button onClick={() => deleteClosure(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MC.ink4, fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
            ))}

            <div style={{ background: MC.line2, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Add closed period</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</div>
                  <input type="date" value={closureForm.start_date} onChange={e => setClosureForm(f => ({ ...f, start_date: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${MC.line}`, fontSize: 13, color: MC.ink, outline: 'none', boxSizing: 'border-box', background: MC.paper }} />
                </div>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</div>
                  <input type="date" value={closureForm.end_date} min={closureForm.start_date} onChange={e => setClosureForm(f => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${MC.line}`, fontSize: 13, color: MC.ink, outline: 'none', boxSizing: 'border-box', background: MC.paper }} />
                </div>
              </div>
              <input value={closureForm.reason} onChange={e => setClosureForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason (optional) — e.g. Christmas holiday" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${MC.line}`, fontSize: 13, color: MC.ink, outline: 'none', boxSizing: 'border-box', background: MC.paper }} />
              <button
                onClick={addClosure}
                disabled={savingClosure || !closureForm.start_date || !closureForm.end_date}
                style={{ alignSelf: 'flex-start', height: 34, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: MC.brand, color: '#fff', fontSize: 13, fontWeight: 600, opacity: (savingClosure || !closureForm.start_date || !closureForm.end_date) ? 0.45 : 1 }}
              >
                {savingClosure ? 'Adding…' : 'Add period'}
              </button>
            </div>

          </div>
        </Group>

        {/* Logo */}
        <Group label="Branding">
          <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Venue logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Venue logo" style={{ height: 44, width: 44, borderRadius: 10, objectFit: 'contain', border: `1px solid ${MC.line}`, background: MC.line2, padding: 4 }} />
              )}
              <input
                type="file" accept="image/*"
                onChange={e => setLogoFile(e.target.files[0] ?? null)}
                style={{ fontSize: 13, color: MC.ink3 }}
              />
              {logoFile && (
                <button
                  onClick={() => uploadLogo(logoFile)}
                  disabled={uploadingLogo}
                  style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: MC.brand, color: '#fff', fontSize: 13, fontWeight: 600, opacity: uploadingLogo ? 0.5 : 1 }}
                >
                  {uploadingLogo ? 'Uploading…' : 'Upload'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: MC.ink4 }}>PNG or SVG recommended. Shown in the app header.</div>
          </div>
        </Group>

        {/* Appearance */}
        <Group label="Appearance">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink }}>Theme</div>
              <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2 }}>
                {themeMode === 'system' ? 'Following device settings' : dark ? 'Dark mode active' : 'Light mode active'}
              </div>
            </div>
            <div style={{ display: 'flex', background: MC.line2, borderRadius: 9, padding: 3, gap: 2 }}>
              {[
                { id: 'light', label: '☀️' },
                { id: 'dark',  label: '🌙' },
                { id: 'system', label: '💻' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setThemeMode(opt.id)}
                  style={{
                    width: 34, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 14,
                    background: themeMode === opt.id ? MC.paper : 'transparent',
                    boxShadow: themeMode === opt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all .15s',
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </Group>

        {/* My venues */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>My venues</div>
          <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden', padding: '4px 0' }}>
            <VenuesSection />
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
