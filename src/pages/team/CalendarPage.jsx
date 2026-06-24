import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import useManagerCalendar from '../../hooks/useManagerCalendar'

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

function CalToggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 relative border-none cursor-pointer transition-colors duration-200 rounded-[14px]"
      style={{
        width: 48, height: 28,
        padding: 3,
        background: on ? '#13362a' : '#e4e6e2',
      }}
    >
      <span
        className="block rounded-full bg-white"
        style={{
          width: 22, height: 22,
          boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
          transform: on ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
        }}
      />
    </button>
  )
}

function ColourPicker({ value, onChange }) {
  return (
    <div className="flex gap-[7px]">
      {CAL_COLOURS.map(c => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          title={c.label}
          className="flex-1 h-[34px] rounded-[9px] cursor-pointer transition-[border] duration-[120ms]"
          style={{
            background: c.bg,
            border: value === c.id ? '3px solid #0d1a14' : '3px solid transparent',
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
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-1)}
        className="w-[34px] h-[34px] rounded-[9px] border border-charcoal/10 bg-surface cursor-pointer flex items-center justify-center font-mono text-[18px] text-charcoal/75 shrink-0"
      >‹</button>
      <span className="text-[13px] font-medium text-charcoal min-w-[112px] text-center">{label}</span>
      <button
        onClick={() => shift(1)}
        className="w-[34px] h-[34px] rounded-[9px] border border-charcoal/10 bg-surface cursor-pointer flex items-center justify-center font-mono text-[18px] text-charcoal/75 shrink-0"
      >›</button>
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
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => shiftMin(-15)}
        className="w-[30px] h-[30px] rounded-lg border border-charcoal/10 bg-surface cursor-pointer flex items-center justify-center font-mono text-[16px] text-charcoal/50"
      >‹</button>
      <span className="font-mono text-[13px] font-semibold text-charcoal/75 min-w-[40px] text-center tabular-nums">{value}</span>
      <button
        onClick={() => shiftMin(15)}
        className="w-[30px] h-[30px] rounded-lg border border-charcoal/10 bg-surface cursor-pointer flex items-center justify-center font-mono text-[16px] text-charcoal/50"
      >›</button>
    </div>
  )
}

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

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5 pb-[18px]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-charcoal/75 text-sm font-medium p-0"
        >
          <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
          Calendar
        </button>
        <span className="text-[16px] font-bold tracking-[-0.02em] text-charcoal">{isEdit ? 'Edit event' : 'New event'}</span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm font-bold bg-transparent border-none"
          style={{ color: canSave ? colObj.bg : undefined, cursor: canSave ? 'pointer' : 'default' }}
        >
          <span className={canSave ? '' : 'text-charcoal/30'}>Save</span>
        </button>
      </div>

      {/* Colour accent */}
      <div className="h-[5px] rounded-[3px] mb-[22px]" style={{ background: colObj.bg }} />

      <div className="flex flex-col gap-[22px]">
        {/* Title */}
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Event name…"
          className="w-full px-[14px] h-[54px] rounded-[11px] border border-charcoal/10 bg-white dark:bg-[#1e1e1e] text-[17px] font-semibold text-charcoal tracking-[-0.01em] outline-none box-border"
        />

        {/* Type */}
        <div>
          <span className="font-mono text-[11px] text-charcoal/30 uppercase tracking-[0.08em] font-semibold mb-2.5 block">Type</span>
          <div className="flex gap-[7px] flex-wrap">
            {EVENT_TYPES.map(et => (
              <button
                key={et.id}
                onClick={() => setType(et.id)}
                className="h-9 px-[15px] rounded-full cursor-pointer text-[13px] font-semibold transition-all duration-150"
                style={{
                  background: type === et.id ? '#0d1a14' : '#ffffff',
                  color: type === et.id ? '#fff' : undefined,
                  border: `1.5px solid ${type === et.id ? '#0d1a14' : '#e4e6e2'}`,
                }}
              >
                <span className={type !== et.id ? 'text-charcoal/50' : ''}>{et.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Colour */}
        <div>
          <span className="font-mono text-[11px] text-charcoal/30 uppercase tracking-[0.08em] font-semibold mb-2.5 block">Colour</span>
          <ColourPicker value={colour} onChange={setColour} />
        </div>

        {/* Dates */}
        <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden">
          {/* All day row */}
          <button
            onClick={() => setAllDay(!allDay)}
            className="w-full flex items-center justify-between px-4 py-[15px] border-none border-b border-charcoal/6 bg-transparent cursor-pointer"
          >
            <span className="text-[15px] font-medium text-charcoal">All day</span>
            <CalToggle on={allDay} onClick={e => { e.stopPropagation(); setAllDay(!allDay) }} />
          </button>
          <div className={`flex items-center justify-between px-4 py-[15px] ${allDay ? '' : 'border-b border-charcoal/6'}`}>
            <span className="text-[15px] text-charcoal/50 font-medium">Start</span>
            <DatePicker value={startDate} onChange={v => { setStartDate(v); if (v > endDate) setEndDate(v) }} />
          </div>
          {!allDay && (
            <div className="flex items-center justify-between px-4 py-[11px] border-b border-charcoal/6">
              <span className="text-[13px] text-charcoal/30">Start time</span>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
          )}
          <div className={`flex items-center justify-between px-4 py-[15px] ${allDay ? '' : 'border-b border-charcoal/6'}`}>
            <span className="text-[15px] text-charcoal/50 font-medium">End</span>
            <DatePicker value={endDate} min={startDate} onChange={setEndDate} />
          </div>
          {!allDay && (
            <div className="flex items-center justify-between px-4 py-[11px]">
              <span className="text-[13px] text-charcoal/30">End time</span>
              <TimePicker value={endTime} onChange={setEndTime} />
            </div>
          )}
        </div>

        {/* Reminder */}
        <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden">
          <div className="px-4 py-[15px] border-b border-charcoal/6">
            <div className="flex items-center gap-2.5 mb-[14px]">
              <span className="w-8 h-8 rounded-[9px] bg-brand/8 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#13362a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </span>
              <span className="text-[15px] font-semibold text-charcoal">Set reminder</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-surface rounded-[11px] overflow-hidden border border-charcoal/10">
                <button
                  onClick={() => setReminderDays(Math.max(1, reminderDays - 1))}
                  className="w-11 h-11 border-none bg-transparent cursor-pointer font-mono text-[22px] text-charcoal/75 flex items-center justify-center"
                >−</button>
                <span className="font-mono text-[16px] font-bold text-charcoal min-w-[34px] text-center tabular-nums">{reminderDays}</span>
                <button
                  onClick={() => setReminderDays(Math.min(30, reminderDays + 1))}
                  className="w-11 h-11 border-none bg-transparent cursor-pointer font-mono text-[22px] text-charcoal/75 flex items-center justify-center"
                >+</button>
              </div>
              <span className="text-sm text-charcoal/75">{reminderDays === 1 ? 'day' : 'days'} before</span>
            </div>
          </div>
          {/* Backup reminder */}
          <button
            onClick={() => setBackupReminder(!backupReminder)}
            className="w-full flex items-center justify-between px-4 py-[15px] border-none bg-transparent cursor-pointer"
          >
            <div className="text-left">
              <div className="text-sm font-medium text-charcoal">Backup reminder</div>
              <div className="font-mono text-[11px] text-charcoal/50 mt-0.5">Also 1 day before</div>
            </div>
            <CalToggle on={backupReminder} onClick={e => { e.stopPropagation(); setBackupReminder(!backupReminder) }} />
          </button>
        </div>

        {/* Notes */}
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)…" rows={3}
          className="w-full px-[14px] py-3 rounded-[11px] border border-charcoal/10 bg-white dark:bg-[#1e1e1e] text-sm text-charcoal outline-none box-border resize-none leading-[1.55]"
        />

        {/* Delete */}
        {isEdit && !showDelete && (
          <button
            onClick={() => setShowDelete(true)}
            className="w-full h-[46px] rounded-xl border-none bg-danger/10 text-danger text-sm font-semibold cursor-pointer"
          >
            Delete event
          </button>
        )}
        {isEdit && showDelete && (
          <div className="bg-danger/10 border border-danger/20 rounded-[14px] px-4 py-[15px]">
            <div className="text-sm font-semibold text-danger mb-3">Delete this event?</div>
            <div className="flex gap-2">
              <button
                onClick={() => onDelete(event.id)}
                className="flex-1 h-11 rounded-[11px] border-none bg-danger text-white text-sm font-semibold cursor-pointer"
              >Yes, delete</button>
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 h-11 rounded-[11px] border border-charcoal/10 bg-white dark:bg-[#1e1e1e] text-charcoal/75 text-sm font-semibold cursor-pointer"
              >Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarDayView({ dateStr, dayMapItems, onBack, onAdd, onEdit }) {
  const d       = new Date(dateStr + 'T00:00:00')
  const dayNum  = d.getDate()
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const monthYr = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const ownEvents  = dayMapItems.filter(e => !e._staff)
  const staffItems = dayMapItems.filter(e => e._staff)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-0.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-charcoal/75 text-sm font-medium p-0"
        >
          <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
          Calendar
        </button>
        <button
          onClick={() => onAdd(dateStr)}
          className="h-[34px] px-[15px] rounded-full border-none bg-brand text-white text-[13px] font-semibold cursor-pointer flex items-center gap-[5px]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add
        </button>
      </div>

      <div className="px-0.5">
        <div className="text-[28px] font-bold tracking-[-0.03em] leading-none text-charcoal">{dayName} {dayNum}</div>
        <div className="font-mono text-[11px] text-charcoal/30 mt-1 tracking-[0.04em] uppercase">{monthYr}</div>
      </div>

      {dayMapItems.length === 0 && (
        <div className="text-center py-8 text-charcoal/30 text-sm">Nothing on this day</div>
      )}

      {ownEvents.map(ev => {
        const col = colourById(ev.colour)
        const et  = EVENT_TYPES.find(t => t.id === ev.type)
        return (
          <button
            key={ev.id}
            onClick={() => onEdit(ev)}
            className="w-full text-left px-[15px] py-[14px] rounded-[14px] border-none cursor-pointer flex items-center gap-3"
            style={{ background: col.soft }}
          >
            <span className="w-[14px] h-[14px] rounded-[4px] shrink-0" style={{ background: col.bg }} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-charcoal">{ev.title}</div>
              <div className="font-mono text-[11px] text-charcoal/50 mt-[3px] uppercase tracking-[0.04em]">
                {et?.label}{!ev.all_day && ev.start_time ? ` · ${ev.start_time}–${ev.end_time}` : ''}
                {ev.reminder_days ? ` · 🔔 ${ev.reminder_days}d` : ''}
              </div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30"><path d="M1 1l4 4-4 4"/></svg>
          </button>
        )
      })}

      {staffItems.length > 0 && (
        <div>
          <div className="font-mono text-[11px] text-charcoal/30 uppercase tracking-[0.07em] font-semibold px-0.5 pb-2">Staff leave</div>
          {staffItems.map(sl => (
            <div key={sl.id} className="flex items-center gap-2.5 px-[14px] py-[11px] rounded-xl bg-white dark:bg-[#1e1e1e] border border-charcoal/10 mb-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-charcoal/10 shrink-0" />
              <span className="text-sm font-medium text-charcoal/75">{sl.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CellPips({ items, isSelected }) {
  if (!items.length) return null
  const show = items.slice(0, 3)
  return (
    <div className="flex gap-0.5 justify-center mt-[3px]">
      {show.map((ev, i) => {
        const col = colourById(ev.colour)
        return (
          <span
            key={i}
            className="h-1 rounded-[2px]"
            style={{
              width: show.length === 1 ? 16 : 7,
              background: isSelected ? 'rgba(255,255,255,0.7)' : col.bg,
            }}
          />
        )
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
      <div className="grid grid-cols-7 mb-[5px]">
        {DAYS_SHORT.map((d, i) => (
          <div
            key={i}
            className={`text-center font-mono text-[11px] font-semibold tracking-[0.06em] py-1 ${isWknd(i) ? 'text-charcoal/30' : 'text-charcoal/50'}`}
          >{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr    = toDateStr(year, month, d)
          const items      = dayMap[dateStr] || []
          const isToday    = dateStr === today
          const isSelected = dateStr === selectedDate
          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              className="flex flex-col items-center py-[6px] pb-[7px] rounded-[11px] border-none cursor-pointer transition-colors duration-[120ms]"
              style={{
                background: isSelected ? '#13362a' : isToday ? '#eef4f0' : 'transparent',
              }}
            >
              <span
                className="font-mono text-sm tabular-nums leading-none"
                style={{
                  fontWeight: isToday || isSelected ? 700 : isWknd(i) ? 400 : 500,
                  color: isSelected ? '#fff' : isToday ? '#13362a' : isWknd(i) ? '#76817b' : undefined,
                }}
              >
                <span className={!isSelected && !isToday && !isWknd(i) ? 'text-charcoal' : ''}>{d}</span>
              </span>
              <CellPips items={items} isSelected={isSelected} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StaffLeaveBar({ year, month, staffLeave }) {
  const mStr = `${year}-${pad(month + 1)}`
  const active = staffLeave.filter(sl =>
    sl.startDate.startsWith(mStr) || sl.endDate.startsWith(mStr) ||
    (sl.startDate < mStr + '-01' && sl.endDate > mStr + '-31')
  )
  if (!active.length) return null
  return (
    <div>
      <div className="font-mono text-[11px] text-charcoal/30 uppercase tracking-[0.08em] font-semibold mb-[9px]">Staff leave this month</div>
      <div className="flex gap-1.5 flex-wrap">
        {active.map(sl => {
          const start = new Date(sl.startDate + 'T00:00:00')
          const end   = new Date(sl.endDate   + 'T00:00:00')
          const fmt   = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          const label = sl.startDate === sl.endDate ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
          return (
            <div
              key={sl.name + sl.startDate}
              className="inline-flex items-center gap-[7px] py-1.5 pr-3 pl-2 rounded-full bg-white dark:bg-[#1e1e1e] border-[1.5px] border-charcoal/10"
            >
              <span className="w-6 h-6 rounded-[7px] bg-charcoal/6 flex items-center justify-center font-mono text-[11px] font-bold text-charcoal/50">
                {sl.name.split(' ').map(w => w[0]).join('')}
              </span>
              <div>
                <div className="text-[12.5px] font-semibold text-charcoal leading-none">{sl.name.split(' ')[0]}</div>
                <div className="font-mono text-[11px] text-charcoal/30 mt-[1px]">{label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventStrip({ year, month, dayMap, onSelectDate }) {
  const daysInMo = new Date(year, month + 1, 0).getDate()
  const rows = []
  for (let d = 1; d <= daysInMo; d++) {
    const dateStr = toDateStr(year, month, d)
    const items   = (dayMap[dateStr] || []).filter(e => !e._staff)
    if (items.length) rows.push({ dateStr, items })
  }
  if (!rows.length) return (
    <div className="py-[18px] text-center font-mono text-[11px] text-charcoal/30">No events this month</div>
  )
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(({ dateStr, items }) => {
        const dt       = new Date(dateStr + 'T00:00:00')
        const dayLabel = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
        const firstCol = colourById(items[0].colour)
        return (
          <button
            key={dateStr}
            onClick={() => onSelectDate(dateStr)}
            className="w-full text-left bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-xl px-[13px] py-2.5 cursor-pointer flex items-start gap-3 overflow-hidden relative"
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ background: firstCol.bg }}
            />
            <div className="font-mono text-[11px] text-charcoal/50 w-[42px] shrink-0 pt-0.5 ml-2">{dayLabel}</div>
            <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
              {items.map(ev => {
                const col = colourById(ev.colour)
                return (
                  <div key={ev.id} className="flex items-center gap-[7px]">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: col.bg }} />
                    <span className="text-[13px] font-medium text-charcoal flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{ev.title}</span>
                    {!ev.all_day && ev.start_time && <span className="font-mono text-[11px] text-charcoal/50">{ev.start_time}</span>}
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

export default function CalendarPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { events, staffLeave, isLoading, save, remove } = useManagerCalendar()

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

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

  if (calView === 'day' && selectedDate) {
    return (
      <div className="px-4 pb-24">
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

  if (calView === 'add' || calView === 'edit') {
    return (
      <div className="px-4 pb-24">
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

  return (
    <div className="px-4 pb-24">
      {/* Back to team */}
      <button
        onClick={() => navigate(`/v/${venueSlug}/team`)}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-charcoal/75 text-sm font-medium p-0 mb-4"
      >
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
        Team
      </button>

      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="px-0.5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-charcoal m-0">My Calendar</h1>
            <div className="text-[12.5px] text-charcoal/50 mt-1">Events, closures &amp; staff leave</div>
          </div>
          <button
            onClick={() => goAdd(todayStr())}
            className="h-9 px-[15px] rounded-[10px] border-none bg-brand text-white text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add
          </button>
        </div>

        {/* Month navigator */}
        <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] px-[14px] pt-[14px] pb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="w-[34px] h-[34px] rounded-[9px] border border-charcoal/10 bg-transparent cursor-pointer flex items-center justify-center"
            >
              <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/75"><path d="M5 1L1 5l4 4"/></svg>
            </button>
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
              className="text-[15px] font-bold tracking-[-0.015em] bg-transparent border-none cursor-pointer text-charcoal"
            >
              {MONTHS[month]} {year}
            </button>
            <button
              onClick={nextMonth}
              className="w-[34px] h-[34px] rounded-[9px] border border-charcoal/10 bg-transparent cursor-pointer flex items-center justify-center"
            >
              <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/75"><path d="M1 1l4 4-4 4"/></svg>
            </button>
          </div>
          {isLoading
            ? <div className="h-40 flex items-center justify-center text-charcoal/30 font-mono text-[11px]">Loading…</div>
            : <MonthGrid year={year} month={month} dayMap={dayMap} selectedDate={selectedDate} onSelectDate={goDay} />
          }
        </div>

        {/* Staff leave chips */}
        <StaffLeaveBar year={year} month={month} staffLeave={staffLeave} />

        {/* Event strip */}
        <div>
          <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.08em] uppercase font-semibold px-0.5 pb-2">
            {MONTHS[month]} events
          </div>
          <EventStrip year={year} month={month} dayMap={dayMap} onSelectDate={goDay} />
        </div>
      </div>
    </div>
  )
}
