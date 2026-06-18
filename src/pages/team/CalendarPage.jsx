import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import useManagerCalendar from '../../hooks/useManagerCalendar'

// ── Design tokens ──────────────────────────────────────────────────────────
const MC = {
  brand: '#13362a', brandTint: '#eef4f0',
  ink:   '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line:  '#e4e6e2', line2: '#eef0ec',
  paper: '#ffffff', bg: '#f3f3ef',
  bad:   '#b3331c', badSoft: '#fdf3f0',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Colour palette ─────────────────────────────────────────────────────────
const CAL_COLOURS = [
  { id: 'forest', bg: '#13362a', fg: '#ffffff', soft: '#e2ece7', label: 'Forest' },
  { id: 'rust',   bg: '#c94f2a', fg: '#ffffff', soft: '#fbeae6', label: 'Rust'   },
  { id: 'ocean',  bg: '#2c4577', fg: '#ffffff', soft: '#e7edf6', label: 'Ocean'  },
  { id: 'amber',  bg: '#a85d12', fg: '#ffffff', soft: '#fbeedc', label: 'Amber'  },
  { id: 'slate',  bg: '#4a5568', fg: '#ffffff', soft: '#edf0f4', label: 'Slate'  },
  { id: 'plum',   bg: '#6b3d7a', fg: '#ffffff', soft: '#f0e8f5', label: 'Plum'   },
]

const EVENT_TYPES = [
  { id: 'event',    label: 'Event'          },
  { id: 'closed',   label: 'Closed Period'  },
  { id: 'meeting',  label: 'Meeting'        },
  { id: 'review',   label: 'Staff Review'   },
  { id: 'delivery', label: 'Delivery'       },
  { id: 'other',    label: 'Other'          },
]

function colourById(id) {
  return CAL_COLOURS.find(c => c.id === id) || CAL_COLOURS[0]
}

function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }
function todayStr() {
  const n = new Date()
  return toDateStr(n.getFullYear(), n.getMonth(), n.getDate())
}
function newEventId() { return 'e' + Date.now().toString(36) }

function datesInRange(startStr, endStr) {
  const out = []
  const cur = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function buildDayMap(events, staffLeave) {
  const map = {}
  const add = (date, item) => { (map[date] = map[date] || []).push(item) }
  events.forEach(ev => {
    datesInRange(ev.start_date, ev.end_date).forEach(d => add(d, { ...ev, _staff: false }))
  })
  staffLeave.forEach(sl => {
    datesInRange(sl.startDate, sl.endDate).forEach(d =>
      add(d, { id: sl.name + d, title: sl.name, colour: 'slate', _staff: true })
    )
  })
  return map
}

// ── Shared sub-components ──────────────────────────────────────────────────
function CalToggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
        padding: 3, background: on ? MC.brand : MC.line,
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      }}
    >
      <span style={{
        display: 'block', width: 22, height: 22, borderRadius: 11,
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
        transform: on ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 0.2s',
      }} />
    </button>
  )
}

function ColourPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {CAL_COLOURS.map(c => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          title={c.label}
          style={{
            flex: 1, height: 34, borderRadius: 9, background: c.bg,
            border: value === c.id ? `3px solid ${MC.ink}` : '3px solid transparent',
            cursor: 'pointer', transition: 'border 0.12s',
          }}
        />
      ))}
    </div>
  )
}

function DatePicker({ value, onChange, min }) {
  const d = new Date(value + 'T00:00:00')
  const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  function shift(n) {
    const nd = new Date(d)
    nd.setDate(nd.getDate() + n)
    const str = toDateStr(nd.getFullYear(), nd.getMonth(), nd.getDate())
    if (min && str < min) return
    onChange(str)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => shift(-1)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${MC.line}`, background: MC.bg, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 18, color: MC.ink2, flexShrink: 0 }}>‹</button>
      <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: MC.ink, minWidth: 112, textAlign: 'center' }}>{label}</span>
      <button onClick={() => shift(1)}  style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${MC.line}`, background: MC.bg, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 18, color: MC.ink2, flexShrink: 0 }}>›</button>
    </div>
  )
}

function TimePicker({ value, onChange }) {
  const [h, m] = value.split(':').map(Number)
  function shiftMin(n) {
    let total = h * 60 + m + n
    total = ((total % 1440) + 1440) % 1440
    onChange(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => shiftMin(-15)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${MC.line}`, background: MC.bg, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 16, color: MC.ink3 }}>‹</button>
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: MC.ink2, minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button onClick={() => shiftMin(15)}  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${MC.line}`, background: MC.bg, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 16, color: MC.ink3 }}>›</button>
    </div>
  )
}

// ── Event form (Add / Edit) ────────────────────────────────────────────────
function CalendarEventForm({ event, defaultDate, onSave, onDelete, onBack }) {
  const isEdit = !!event
  const [title,          setTitle]          = useState(event?.title          ?? '')
  const [type,           setType]           = useState(event?.type           ?? 'event')
  const [colour,         setColour]         = useState(event?.colour         ?? 'forest')
  const [startDate,      setStartDate]      = useState(event?.start_date     ?? defaultDate ?? todayStr())
  const [endDate,        setEndDate]        = useState(event?.end_date       ?? defaultDate ?? todayStr())
  const [allDay,         setAllDay]         = useState(event?.all_day        ?? true)
  const [startTime,      setStartTime]      = useState(event?.start_time     ?? '09:00')
  const [endTime,        setEndTime]        = useState(event?.end_time       ?? '10:00')
  const [notes,          setNotes]          = useState(event?.notes          ?? '')
  const [reminderDays,   setReminderDays]   = useState(event?.reminder_days  ?? 1)
  const [backupReminder, setBackupReminder] = useState(event?.backup_reminder ?? false)
  const [showDelete,     setShowDelete]     = useState(false)

  const colObj = colourById(colour)
  const canSave = title.trim().length > 0

  function handleSave() {
    if (!canSave) return
    onSave({
      id: event?.id ?? newEventId(),
      title: title.trim(), type, colour,
      start_date: startDate, end_date: endDate,
      all_day: allDay,
      start_time: allDay ? undefined : startTime,
      end_time:   allDay ? undefined : endTime,
      notes, reminder_days: reminderDays, backup_reminder: backupReminder,
    })
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 11,
    border: `1px solid ${MC.line}`, background: MC.paper,
    fontFamily: SANS, fontSize: 14, color: MC.ink,
    outline: 'none', boxSizing: 'border-box',
  }
  const sectionLabel = {
    fontFamily: MONO, fontSize: 10, color: MC.ink4,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    fontWeight: 600, marginBottom: 10, display: 'block',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 18px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: MC.ink2, fontFamily: SANS, fontSize: 14, fontWeight: 500, padding: 0 }}>
          <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
          Calendar
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: MC.ink }}>{isEdit ? 'Edit event' : 'New event'}</span>
        <button onClick={handleSave} disabled={!canSave} style={{ fontSize: 14, fontWeight: 700, color: canSave ? colObj.bg : MC.ink4, background: 'none', border: 'none', cursor: canSave ? 'pointer' : 'default', fontFamily: SANS }}>Save</button>
      </div>

      {/* Colour accent */}
      <div style={{ height: 5, borderRadius: 3, background: colObj.bg, marginBottom: 22 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Title */}
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Event name…"
          style={{ ...inputStyle, fontSize: 17, fontWeight: 600, height: 54, letterSpacing: '-0.01em' }}
        />

        {/* Type */}
        <div>
          <span style={sectionLabel}>Type</span>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {EVENT_TYPES.map(et => (
              <button key={et.id} onClick={() => setType(et.id)} style={{
                height: 36, padding: '0 15px', borderRadius: 99, cursor: 'pointer',
                fontFamily: SANS, fontSize: 13, fontWeight: 600,
                background: type === et.id ? MC.ink : MC.paper,
                color: type === et.id ? '#fff' : MC.ink3,
                border: `1.5px solid ${type === et.id ? MC.ink : MC.line}`,
                transition: 'all 0.15s',
              }}>{et.label}</button>
            ))}
          </div>
        </div>

        {/* Colour */}
        <div>
          <span style={sectionLabel}>Colour</span>
          <ColourPicker value={colour} onChange={setColour} />
        </div>

        {/* Dates */}
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* All day row */}
          <button onClick={() => setAllDay(!allDay)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '15px 16px', border: 'none', borderBottom: `1px solid ${MC.line2}`,
            background: 'transparent', cursor: 'pointer', fontFamily: SANS,
          }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: MC.ink }}>All day</span>
            <CalToggle on={allDay} onClick={e => { e.stopPropagation(); setAllDay(!allDay) }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: allDay ? 'none' : `1px solid ${MC.line2}` }}>
            <span style={{ fontSize: 15, color: MC.ink3, fontWeight: 500 }}>Start</span>
            <DatePicker value={startDate} onChange={v => { setStartDate(v); if (v > endDate) setEndDate(v) }} />
          </div>
          {!allDay && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${MC.line2}` }}>
              <span style={{ fontSize: 13, color: MC.ink4 }}>Start time</span>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: allDay ? 'none' : `1px solid ${MC.line2}` }}>
            <span style={{ fontSize: 15, color: MC.ink3, fontWeight: 500 }}>End</span>
            <DatePicker value={endDate} min={startDate} onChange={setEndDate} />
          </div>
          {!allDay && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px' }}>
              <span style={{ fontSize: 13, color: MC.ink4 }}>End time</span>
              <TimePicker value={endTime} onChange={setEndTime} />
            </div>
          )}
        </div>

        {/* Reminder */}
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '15px 16px', borderBottom: `1px solid ${MC.line2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: MC.brandTint, display: 'grid', placeItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MC.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: MC.ink }}>Set reminder</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: MC.bg, borderRadius: 11, overflow: 'hidden', border: `1px solid ${MC.line}` }}>
                <button onClick={() => setReminderDays(Math.max(1, reminderDays - 1))} style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 22, color: MC.ink2, display: 'grid', placeItems: 'center' }}>−</button>
                <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: MC.ink, minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{reminderDays}</span>
                <button onClick={() => setReminderDays(Math.min(30, reminderDays + 1))} style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 22, color: MC.ink2, display: 'grid', placeItems: 'center' }}>+</button>
              </div>
              <span style={{ fontSize: 14, color: MC.ink2 }}>{reminderDays === 1 ? 'day' : 'days'} before</span>
            </div>
          </div>
          {/* Backup reminder */}
          <button onClick={() => setBackupReminder(!backupReminder)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '15px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS,
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink }}>Backup reminder</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, marginTop: 2 }}>Also 1 day before</div>
            </div>
            <CalToggle on={backupReminder} onClick={e => { e.stopPropagation(); setBackupReminder(!backupReminder) }} />
          </button>
        </div>

        {/* Notes */}
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)…" rows={3}
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.55 }}
        />

        {/* Delete */}
        {isEdit && !showDelete && (
          <button onClick={() => setShowDelete(true)} style={{ width: '100%', height: 46, borderRadius: 12, border: 'none', background: MC.badSoft, color: MC.bad, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Delete event
          </button>
        )}
        {isEdit && showDelete && (
          <div style={{ background: MC.badSoft, border: `1px solid ${MC.bad}33`, borderRadius: 14, padding: '15px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: MC.bad, marginBottom: 12 }}>Delete this event?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onDelete(event.id)} style={{ flex: 1, height: 44, borderRadius: 11, border: 'none', background: MC.bad, color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Yes, delete</button>
              <button onClick={() => setShowDelete(false)} style={{ flex: 1, height: 44, borderRadius: 11, border: `1px solid ${MC.line}`, background: MC.paper, color: MC.ink2, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Day view ───────────────────────────────────────────────────────────────
function CalendarDayView({ dateStr, dayMapItems, onBack, onAdd, onEdit }) {
  const d       = new Date(dateStr + 'T00:00:00')
  const dayNum  = d.getDate()
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const monthYr = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const ownEvents  = dayMapItems.filter(e => !e._staff)
  const staffItems = dayMapItems.filter(e => e._staff)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: MC.ink2, fontFamily: SANS, fontSize: 14, fontWeight: 500, padding: 0 }}>
          <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
          Calendar
        </button>
        <button onClick={() => onAdd(dateStr)} style={{ height: 34, padding: '0 15px', borderRadius: 99, border: 'none', background: MC.brand, color: '#fff', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add
        </button>
      </div>

      <div style={{ padding: '0 2px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: MC.ink }}>{dayName} {dayNum}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MC.ink4, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{monthYr}</div>
      </div>

      {dayMapItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: MC.ink4, fontFamily: SANS, fontSize: 14 }}>Nothing on this day</div>
      )}

      {ownEvents.map(ev => {
        const col = colourById(ev.colour)
        const et  = EVENT_TYPES.find(t => t.id === ev.type)
        return (
          <button key={ev.id} onClick={() => onEdit(ev)} style={{
            width: '100%', textAlign: 'left', padding: '14px 15px', borderRadius: 14, border: 'none',
            background: col.soft, cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: col.bg, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: MC.ink }}>{ev.title}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {et?.label}{!ev.all_day && ev.start_time ? ` · ${ev.start_time}–${ev.end_time}` : ''}
                {ev.reminder_days ? ` · 🔔 ${ev.reminder_days}d` : ''}
              </div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.ink4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
          </button>
        )
      })}

      {staffItems.length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, padding: '0 2px 8px' }}>Staff leave</div>
          {staffItems.map(sl => (
            <div key={sl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, background: MC.paper, border: `1px solid ${MC.line}`, marginBottom: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: MC.line, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: MC.ink2 }}>{sl.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Month grid ─────────────────────────────────────────────────────────────
function CellPips({ items, isSelected }) {
  if (!items.length) return null
  const show = items.slice(0, 3)
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
      {show.map((ev, i) => {
        const col = colourById(ev.colour)
        return <span key={i} style={{ width: show.length === 1 ? 16 : 7, height: 4, borderRadius: 2, background: isSelected ? 'rgba(255,255,255,0.7)' : col.bg }} />
      })}
    </div>
  )
}

function MonthGrid({ year, month, dayMap, selectedDate, onSelectDate }) {
  const today = todayStr()
  const firstDow = new Date(year, month, 1).getDay()
  const offset   = (firstDow + 6) % 7
  const daysInMo = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMo; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const isWknd = i => i % 7 === 5 || i % 7 === 6

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 5 }}>
        {DAYS_SHORT.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: MONO, fontSize: 10, color: isWknd(i) ? MC.ink4 : MC.ink3, fontWeight: 600, letterSpacing: '0.06em', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr    = toDateStr(year, month, d)
          const items      = dayMap[dateStr] || []
          const isToday    = dateStr === today
          const isSelected = dateStr === selectedDate
          return (
            <button key={i} onClick={() => onSelectDate(dateStr)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0 7px',
              borderRadius: 11, border: 'none', cursor: 'pointer',
              background: isSelected ? MC.brand : isToday ? MC.brandTint : 'transparent',
              transition: 'background 0.12s',
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 14,
                fontWeight: isToday || isSelected ? 700 : isWknd(i) ? 400 : 500,
                color: isSelected ? '#fff' : isToday ? MC.brand : isWknd(i) ? MC.ink3 : MC.ink,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>{d}</span>
              <CellPips items={items} isSelected={isSelected} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Staff leave chips ──────────────────────────────────────────────────────
function StaffLeaveBar({ year, month, staffLeave }) {
  const mStr = `${year}-${pad(month + 1)}`
  const active = staffLeave.filter(sl =>
    sl.startDate.startsWith(mStr) || sl.endDate.startsWith(mStr) ||
    (sl.startDate < mStr + '-01' && sl.endDate > mStr + '-31')
  )
  if (!active.length) return null
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 9 }}>Staff leave this month</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {active.map(sl => {
          const start = new Date(sl.startDate + 'T00:00:00')
          const end   = new Date(sl.endDate   + 'T00:00:00')
          const fmt   = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          const label = sl.startDate === sl.endDate ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
          return (
            <div key={sl.name + sl.startDate} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 8px', borderRadius: 99, background: MC.paper, border: `1.5px solid ${MC.line}` }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: MC.line2, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: MC.ink3 }}>
                {sl.name.split(' ').map(w => w[0]).join('')}
              </span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: MC.ink, lineHeight: 1 }}>{sl.name.split(' ')[0]}</div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: MC.ink4, marginTop: 1 }}>{label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Event strip ────────────────────────────────────────────────────────────
function EventStrip({ year, month, dayMap, onSelectDate }) {
  const daysInMo = new Date(year, month + 1, 0).getDate()
  const rows = []
  for (let d = 1; d <= daysInMo; d++) {
    const dateStr = toDateStr(year, month, d)
    const items   = (dayMap[dateStr] || []).filter(e => !e._staff)
    if (items.length) rows.push({ dateStr, items })
  }
  if (!rows.length) return (
    <div style={{ padding: '18px 0', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: MC.ink4 }}>No events this month</div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(({ dateStr, items }) => {
        const dt       = new Date(dateStr + 'T00:00:00')
        const dayLabel = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
        const firstCol = colourById(items[0].colour)
        return (
          <button key={dateStr} onClick={() => onSelectDate(dateStr)} style={{
            width: '100%', textAlign: 'left', background: MC.paper, border: `1px solid ${MC.line}`,
            borderRadius: 12, padding: '10px 13px', cursor: 'pointer', fontFamily: SANS,
            display: 'flex', alignItems: 'flex-start', gap: 12, overflow: 'hidden', position: 'relative',
          }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: '12px 0 0 12px', background: firstCol.bg }} />
            <div style={{ fontFamily: MONO, fontSize: 11, color: MC.ink3, width: 42, flexShrink: 0, paddingTop: 2, marginLeft: 8 }}>{dayLabel}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map(ev => {
                const col = colourById(ev.colour)
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: col.bg, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: MC.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    {!ev.all_day && ev.start_time && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3 }}>{ev.start_time}</span>}
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Calendar Page (main) ───────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { events, staffLeave, isLoading, save, remove } = useManagerCalendar()

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // view: 'month' | 'day' | 'add' | 'edit'
  const [calView,      setCalView]      = useState('month')
  const [selectedDate, setSelectedDate] = useState(null)
  const [editEvent,    setEditEvent]    = useState(null)

  const dayMap = buildDayMap(events, staffLeave)

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  function goDay(date)  { setSelectedDate(date); setCalView('day') }
  function goAdd(date)  { setSelectedDate(date); setCalView('add') }
  function goEdit(ev)   { setEditEvent(ev); setCalView('edit') }
  function goMonth()    { setCalView('month') }
  function goBackFromForm() { selectedDate ? setCalView('day') : setCalView('month') }

  async function handleSave(ev) {
    await save(ev)
    selectedDate ? setCalView('day') : setCalView('month')
  }
  async function handleDelete(id) {
    await remove(id)
    setCalView('month')
  }

  // ── Day view ──
  if (calView === 'day' && selectedDate) {
    return (
      <div style={{ padding: '16px 16px 96px', fontFamily: SANS }}>
        <CalendarDayView
          dateStr={selectedDate}
          dayMapItems={dayMap[selectedDate] || []}
          onBack={goMonth}
          onAdd={goAdd}
          onEdit={ev => { setEditEvent(ev); setCalView('edit') }}
        />
      </div>
    )
  }

  // ── Add / Edit form ──
  if (calView === 'add' || calView === 'edit') {
    return (
      <div style={{ padding: '16px 16px 96px', fontFamily: SANS }}>
        <CalendarEventForm
          event={calView === 'edit' ? editEvent : null}
          defaultDate={selectedDate}
          onSave={handleSave}
          onDelete={handleDelete}
          onBack={calView === 'edit' ? () => setCalView('day') : goBackFromForm}
        />
      </div>
    )
  }

  // ── Month view ──
  return (
    <div style={{ padding: '16px 16px 96px', fontFamily: SANS }}>
      {/* Back to team */}
      <button
        onClick={() => navigate(`/v/${venueSlug}/team`)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: MC.ink2, fontFamily: SANS, fontSize: 14, fontWeight: 500, padding: 0, marginBottom: 16 }}
      >
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
        Team
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ padding: '0 2px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>My Calendar</h1>
            <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Events, closures &amp; staff leave</div>
          </div>
          <button
            onClick={() => goAdd(todayStr())}
            style={{ height: 36, padding: '0 15px', borderRadius: 10, border: 'none', background: MC.brand, color: '#fff', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add
          </button>
        </div>

        {/* Month navigator */}
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '14px 14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${MC.line}`, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke={MC.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
            </button>
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
              style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, color: MC.ink }}
            >
              {MONTHS[month]} {year}
            </button>
            <button onClick={nextMonth} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${MC.line}`, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke={MC.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
            </button>
          </div>
          {isLoading
            ? <div style={{ height: 160, display: 'grid', placeItems: 'center', color: MC.ink4, fontFamily: MONO, fontSize: 11 }}>Loading…</div>
            : <MonthGrid year={year} month={month} dayMap={dayMap} selectedDate={selectedDate} onSelectDate={goDay} />
          }
        </div>

        {/* Staff leave chips */}
        <StaffLeaveBar year={year} month={month} staffLeave={staffLeave} />

        {/* Event strip */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 8px' }}>
            {MONTHS[month]} events
          </div>
          <EventStrip year={year} month={month} dayMap={dayMap} onSelectDate={goDay} />
        </div>
      </div>
    </div>
  )
}
