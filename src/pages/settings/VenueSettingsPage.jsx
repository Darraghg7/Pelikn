import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import useVenueSettings from '../../hooks/useVenueSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import TimeSelect from '../../components/ui/TimeSelect'

const MC = {
  brand: '#13362a',
  good:  '#16a34a',
  ink:   '#111827', ink3: '#6b7280', ink4: '#9ca3af',
  line:  '#e5e7eb', line2: '#f3f4f6',
  paper: '#ffffff',
  bad:   '#c0392b',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
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
  const { closedDays, openTime, closeTime, saveClosedDays, saveOpenTime, saveCloseTime } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const [form, setForm] = useState({ venue_name: '', manager_email: '' })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [closureForm, setClosureForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [savingClosure, setSavingClosure] = useState(false)

  useEffect(() => {
    if (!sLoading) setForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  const saveDetails = async () => {
    setSaving(true)
    await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_name',    value: form.venue_name }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'manager_email', value: form.manager_email }),
    ])
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
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
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Venue</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Name, hours & closed days</div>
      </div>

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

        {/* Trading hours */}
        <Group label="Trading hours" foot="Used to contextualise records and reports.">
          <Row label="Opens" sub="Venue open time">
            <div style={{ width: 120, flexShrink: 0 }}>
              <TimeSelect value={openTime} onChange={saveOpenTime} />
            </div>
          </Row>
          <Row label="Closes" sub="Venue close time" last={false}>
            <div style={{ width: 120, flexShrink: 0 }}>
              <TimeSelect value={closeTime} onChange={saveCloseTime} />
            </div>
          </Row>
        </Group>

        {/* Closed days */}
        <Group label="Closed days" foot="Closed days are skipped by the rota builder and greyed out in schedules.">
          <div style={{ padding: '13px 15px' }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {DAY_NAMES.map((day, i) => {
                const isClosed = closedDays.includes(i)
                return (
                  <button
                    key={i}
                    onClick={() => toggleClosedDay(i)}
                    style={{
                      height: 36, padding: '0 14px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                      background: isClosed ? MC.line2 : '#f0fdf4',
                      color: isClosed ? MC.ink4 : MC.good,
                      border: `1px solid ${isClosed ? MC.line : '#bbf7d0'}`,
                      textDecoration: isClosed ? 'line-through' : 'none',
                    }}
                  >{day}</button>
                )
              })}
            </div>
          </div>
        </Group>

        {/* Closed periods */}
        <Group label="Closed periods" foot="Mark the venue closed for a date range — e.g. Christmas week. Checks won't be expected during these dates.">
          <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {closures.length > 0 && closures.map(c => {
              const past = c.end_date < format(new Date(), 'yyyy-MM-dd')
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, background: past ? MC.line2 : MC.paper, opacity: past ? 0.6 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: MC.ink }}>
                      {format(parseISO(c.start_date), 'd MMM yyyy')}
                      {c.start_date !== c.end_date && ` – ${format(parseISO(c.end_date), 'd MMM yyyy')}`}
                    </div>
                    {c.reason && <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2 }}>{c.reason}</div>}
                    {past && <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Past</div>}
                  </div>
                  <button onClick={() => deleteClosure(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MC.ink4, fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
              )
            })}

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

      </div>
    </div>
  )
}
