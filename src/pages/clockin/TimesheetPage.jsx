import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { format, endOfWeek, addWeeks, startOfMonth, endOfMonth, subMonths, parseISO, eachDayOfInterval } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { useTimesheetData } from '../../hooks/useClockEvents'
import { useStaffList } from '../../hooks/useShifts'
import { formatMinutes, getWeekStart, downloadCsv } from '../../lib/utils'
import { buildPdfReport } from '../../lib/pdfUtils'
import { countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AddSessionModal from './AddSessionModal'
import ClockEditApprovalCard from '../../components/shifts/ClockEditApprovalCard'

// ── Design tokens ─────────────────────────────────────────────────────────────
const MC = {
  ink: '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line: '#e4e6e2', line2: '#eef0ec',
  bg: '#f3f3ef', paper: '#ffffff',
  brand: '#13362a', brandTint: '#eef4f0',
  good: '#1a7a4c',
  warn: '#a85d12', warnBg: '#fbeedc',
  bad:  '#b3331c', badBg: '#fbeae6',
}
const MF = '"Geist", -apple-system, "SF Pro Text", system-ui, sans-serif'
const MM = '"Geist Mono", ui-monospace, "SF Mono", monospace'

const STATIONS = {
  Kitchen: { bg: '#f0ebde', fg: '#6b5028' },
  FOH:     { bg: '#e7eef3', fg: '#2a4a66' },
  Bar:     { bg: '#eaeae6', fg: '#3a3a30' },
  KP:      { bg: '#ecdfe1', fg: '#5a3036' },
}

// ── Wheel picker constants ─────────────────────────────────────────────────────
const WH_HOURS  = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const WH_MINS   = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const WH_BREAKS = [0, 5, 10, 15, 20, 30, 45, 60]
const WH_IH = 36, WH_VIS = 5

// ── Data helpers ───────────────────────────────────────────────────────────────
function fmtGBP(n) { return `£${Number(n).toFixed(2)}` }

function minsStr(mins) {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function buildTimesheets(events, staffRates) {
  const results = {}
  for (const e of events) {
    const sid = e.staff_id
    if (!results[sid]) results[sid] = { staffId: sid, name: e.staff?.name ?? 'Unknown', hourlyRate: staffRates[sid] ?? 0, sessions: [], totalMinutes: 0 }
    const r = results[sid]
    if (e.event_type === 'clock_in')    r.sessions.push({ in: e.occurred_at, out: null, breaks: [] })
    if (e.event_type === 'clock_out'   && r.sessions.length) r.sessions[r.sessions.length - 1].out = e.occurred_at
    if (e.event_type === 'break_start' && r.sessions.length) r.sessions[r.sessions.length - 1].breaks.push({ start: e.occurred_at, end: null })
    if (e.event_type === 'break_end'   && r.sessions.length) {
      const br = r.sessions[r.sessions.length - 1].breaks
      if (br.length) { const lb = br[br.length - 1]; if (!lb.end) lb.end = e.occurred_at }
    }
  }
  for (const r of Object.values(results)) {
    for (const s of r.sessions) {
      if (!s.in || !s.out) continue
      const worked = (new Date(s.out) - new Date(s.in)) / 60000
      const breaks = s.breaks.reduce((acc, b) => (!b.start || !b.end) ? acc : acc + (new Date(b.end) - new Date(b.start)) / 60000, 0)
      r.totalMinutes += Math.max(0, worked - breaks)
    }
  }
  return Object.values(results).sort((a, b) => a.name.localeCompare(b.name))
}

function buildDailyGrid(events) {
  const grid = {}
  for (const e of events) {
    const sid = e.staff_id
    if (!grid[sid]) grid[sid] = { sessions: [] }
    const r = grid[sid]
    if (e.event_type === 'clock_in')
      r.sessions.push({ in: e.occurred_at, inId: e.id, out: null, outId: null, breaks: [], date: e.occurred_at.slice(0, 10) })
    if (e.event_type === 'clock_out' && r.sessions.length) {
      const last = r.sessions[r.sessions.length - 1]; last.out = e.occurred_at; last.outId = e.id
    }
    if (e.event_type === 'break_start' && r.sessions.length)
      r.sessions[r.sessions.length - 1].breaks.push({ start: e.occurred_at, startId: e.id, end: null, endId: null })
    if (e.event_type === 'break_end' && r.sessions.length) {
      const br = r.sessions[r.sessions.length - 1].breaks
      if (br.length) { const lb = br[br.length - 1]; if (!lb.end) { lb.end = e.occurred_at; lb.endId = e.id } }
    }
  }
  const result = {}
  for (const [sid, r] of Object.entries(grid)) {
    result[sid] = { staffId: sid, days: {} }
    for (const s of r.sessions) {
      if (!s.in) continue
      const date = s.date
      if (!result[sid].days[date]) result[sid].days[date] = { minutes: 0, sessions: [] }
      const day = result[sid].days[date]
      day.sessions.push({ in: s.in, inId: s.inId, out: s.out, outId: s.outId, breaks: s.breaks })
      if (s.out) {
        const worked = (new Date(s.out) - new Date(s.in)) / 60000
        const brk = s.breaks.reduce((acc, b) => (!b.start || !b.end) ? acc : acc + (new Date(b.end) - new Date(b.start)) / 60000, 0)
        day.minutes += Math.max(0, worked - brk)
      }
    }
  }
  return result
}

function calcHolidayMins(leaveReqs, staffId, profile, periodFrom, periodTo) {
  const reqs = leaveReqs.filter(r => r.staff_id === staffId)
  if (!reqs.length) return 0
  const { contractedHours, workingDays } = profile
  if (!contractedHours || contractedHours <= 0) return 0
  const daysPerWeek = workingDays?.length > 0 ? workingDays.length : 5
  const dailyHours  = contractedHours / daysPerWeek
  return reqs.reduce((sum, r) => {
    const clippedStart = periodFrom && r.start_date < periodFrom ? periodFrom : r.start_date
    const clippedEnd   = periodTo   && r.end_date   > periodTo   ? periodTo   : r.end_date
    return sum + countWorkingDaysInRequest(clippedStart, clippedEnd, workingDays) * dailyHours * 60
  }, 0)
}

const END_OF_DAY_MS = 86_399_999

const PERIODS = [
  { key: 'this_week',  label: 'This Week'  },
  { key: 'last_week',  label: 'Last Week'  },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom',     label: 'Custom'     },
]

function periodToDates(period, customFrom, customTo) {
  const now = new Date()
  const thisWeekStart = getWeekStart(now)
  const thisWeekEnd   = endOfWeek(thisWeekStart, { weekStartsOn: 1 })
  if (period === 'this_week') return { dateFrom: thisWeekStart.toISOString(), dateTo: thisWeekEnd.toISOString(), label: `${format(thisWeekStart, 'd MMM')} – ${format(thisWeekEnd, 'd MMM yyyy')}` }
  if (period === 'last_week') {
    const start = addWeeks(thisWeekStart, -1), end = endOfWeek(start, { weekStartsOn: 1 })
    return { dateFrom: start.toISOString(), dateTo: end.toISOString(), label: `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}` }
  }
  if (period === 'this_month') {
    const start = startOfMonth(now), end = endOfMonth(now)
    return { dateFrom: start.toISOString(), dateTo: end.toISOString(), label: format(now, 'MMMM yyyy') }
  }
  if (period === 'last_month') {
    const last = subMonths(now, 1), start = startOfMonth(last), end = endOfMonth(last)
    return { dateFrom: start.toISOString(), dateTo: end.toISOString(), label: format(last, 'MMMM yyyy') }
  }
  if (customFrom && customTo) {
    const start = parseISO(customFrom), end = parseISO(customTo)
    return { dateFrom: start.toISOString(), dateTo: new Date(end.getTime() + END_OF_DAY_MS).toISOString(), label: `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}` }
  }
  return { dateFrom: '', dateTo: '', label: '—' }
}

// ── UI atoms ───────────────────────────────────────────────────────────────────
function Avatar({ name, station, size = 34 }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  const st = STATIONS[station] || { bg: MC.brandTint, fg: MC.brand }
  return (
    <span style={{ width: size, height: size, borderRadius: 9, flexShrink: 0, background: st.bg, color: st.fg, display: 'grid', placeItems: 'center', fontFamily: MM, fontSize: Math.round(size * 0.32), fontWeight: 600, letterSpacing: '0.02em' }}>
      {initials}
    </span>
  )
}

function SumTile({ label, value, sub, subGood }) {
  return (
    <div style={{ flex: 1, background: MC.bg, borderRadius: 11, padding: '10px 12px' }}>
      <div style={{ fontFamily: MM, fontSize: 9, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 5, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontFamily: MM, fontSize: 17, fontWeight: 600, color: MC.ink, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value || '—'}</div>
      {sub && <div style={{ fontFamily: MM, fontSize: 10, color: subGood ? MC.good : MC.warn, marginTop: 5, fontWeight: 600 }}>{sub}</div>}
    </div>
  )
}

function PeriodChips({ period, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 1 }}>
      {PERIODS.map(p => {
        const on = period === p.key
        return (
          <button key={p.key} onClick={() => onChange(p.key)} style={{ flexShrink: 0, fontFamily: MF, fontSize: 13.5, fontWeight: on ? 600 : 500, cursor: 'pointer', padding: '7px 15px', borderRadius: 999, background: on ? MC.brand : MC.paper, color: on ? '#fff' : MC.ink2, border: on ? `1px solid ${MC.brand}` : `1px solid ${MC.line}` }}>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

function StaffRow({ t, station, last, onTap }) {
  const hasData = t.totalMinutes > 0
  const pay = (t.totalMinutes / 60) * t.hourlyRate
  return (
    <button onClick={onTap} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: MF, borderBottom: last ? 'none' : `1px solid ${MC.line2}` }}>
      <Avatar name={t.name} station={station} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: MC.ink, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{t.name}</div>
        {t.hourlyRate > 0 && <div style={{ fontFamily: MM, fontSize: 10.5, color: MC.ink3, marginTop: 3 }}>£{Number(t.hourlyRate).toFixed(2)}/hr</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: MM, fontSize: 15, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: hasData ? MC.ink : MC.ink4 }}>{minsStr(t.totalMinutes)}</div>
          <div style={{ fontFamily: MM, fontSize: 10.5, marginTop: 4, fontWeight: 600, color: hasData && pay > 0 ? MC.good : MC.ink4 }}>
            {hasData && pay > 0 ? `£${pay.toFixed(2)}` : '—'}
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.ink4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4" /></svg>
      </div>
    </button>
  )
}

// ── Wheel picker ───────────────────────────────────────────────────────────────
function TsWheel({ values, value, onChange }) {
  const ref   = useRef(null)
  const timer = useRef(null)
  const strVals = useMemo(() => values.map(String), [values])
  const strVal  = String(value)
  const idx = Math.max(0, strVals.indexOf(strVal))

  const setNode = useCallback((node) => {
    ref.current = node
    if (node) node.scrollTop = idx * WH_IH
  }, []) // eslint-disable-line

  useEffect(() => { const el = ref.current; if (el) el.scrollTop = idx * WH_IH }, [strVal]) // eslint-disable-line

  const onScroll = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current; if (!el) return
      const i = Math.max(0, Math.min(strVals.length - 1, Math.round(el.scrollTop / WH_IH)))
      if (el.scrollTop !== i * WH_IH) el.scrollTo({ top: i * WH_IH, behavior: 'smooth' })
      if (strVals[i] !== strVal) onChange(strVals[i])
    }, 80)
  }, [strVals, strVal, onChange])

  const pad = ((WH_VIS - 1) / 2) * WH_IH
  return (
    <div style={{ position: 'relative', height: WH_VIS * WH_IH, flex: 1 }}>
      <div ref={setNode} onScroll={onScroll} style={{ height: WH_VIS * WH_IH, overflowY: 'scroll', scrollSnapType: 'y mandatory', padding: `${pad}px 0`, scrollbarWidth: 'none' }}>
        {strVals.map((v, i) => {
          const on = v === strVal
          return (
            <div key={v} onClick={() => { ref.current?.scrollTo({ top: i * WH_IH, behavior: 'smooth' }); onChange(v) }} style={{ height: WH_IH, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center', cursor: 'pointer', fontFamily: MM, fontVariantNumeric: 'tabular-nums', fontSize: on ? 23 : 18, fontWeight: on ? 600 : 500, color: on ? MC.ink : MC.ink4, transition: 'font-size .1s, color .1s' }}>
              {v}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: pad, height: WH_IH, pointerEvents: 'none', borderTop: `1px solid ${MC.line}`, borderBottom: `1px solid ${MC.line}`, background: 'rgba(19,54,42,0.03)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: pad, pointerEvents: 'none', background: `linear-gradient(${MC.bg}, ${MC.bg}00)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: pad, pointerEvents: 'none', background: `linear-gradient(${MC.bg}00, ${MC.bg})` }} />
    </div>
  )
}

// ── Edit session sheet (wheel picker) ──────────────────────────────────────────
function EditSessionSheet({ staffName, dayLabel, session, onSave, onClose }) {
  const toHM = (iso) => iso ? format(new Date(iso), 'HH:mm') : null
  const [clockIn,  setIn]  = useState(toHM(session?.in)  || '08:00')
  const [clockOut, setOut] = useState(toHM(session?.out) || '16:00')
  const [brk,      setBrk] = useState(0)
  const [edge,     setEdge]= useState('out')
  const [ch, cm] = (edge === 'in' ? clockIn : clockOut).split(':')
  const setCur = (h, m) => { const v = `${h}:${m}`; edge === 'in' ? setIn(v) : setOut(v) }
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const worked = (s, e, b = 0) => { let d = toMin(e) - toMin(s); if (d < 0) d += 1440; return Math.max(0, d - b) }
  const mins = worked(clockIn, clockOut, brk)
  const valid = mins > 0
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(9,18,13,0.52)' }} />
      <div style={{ position: 'relative', background: MC.bg, borderRadius: '22px 22px 0 0', padding: '10px 16px 34px', maxHeight: '90%', overflowY: 'auto', boxShadow: '0 -12px 40px rgba(9,18,13,0.24)' }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{dayLabel}</div>
            <div style={{ fontSize: 12, color: MC.ink3, marginTop: 2 }}>{staffName}</div>
          </div>
          {session?.in && <span style={{ fontFamily: MM, fontSize: 9.5, fontWeight: 700, color: MC.warn, background: MC.warnBg, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 9px', borderRadius: 999 }}>Editing</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, background: MC.line2, padding: 4, borderRadius: 12 }}>
          {[['in', 'Clock in', clockIn], ['out', 'Clock out', clockOut]].map(([k, label, val]) => {
            const on = edge === k
            return (
              <button key={k} onClick={() => setEdge(k)} style={{ flex: 1, cursor: 'pointer', fontFamily: MF, border: 'none', borderRadius: 9, padding: '8px 0', background: on ? MC.paper : 'transparent', boxShadow: on ? '0 1px 3px rgba(9,18,13,0.1)' : 'none' }}>
                <div style={{ fontFamily: MM, fontSize: 9, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
                <div style={{ fontFamily: MM, fontSize: 17, fontWeight: 600, color: on ? MC.brand : MC.ink3, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 }}>
          <TsWheel values={WH_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
          <span style={{ fontFamily: MM, fontSize: 22, fontWeight: 600, color: MC.ink3, paddingBottom: 2 }}>:</span>
          <TsWheel values={WH_MINS}  value={cm} onChange={(m) => setCur(ch, m)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: MM, fontSize: 9.5, color: MC.ink3, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Unpaid break</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WH_BREAKS.map(b => {
              const on = b === brk
              return <button key={b} onClick={() => setBrk(b)} style={{ fontFamily: MM, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 11px', borderRadius: 9, border: `1px solid ${on ? MC.brand : MC.line}`, background: on ? MC.brand : MC.paper, color: on ? '#fff' : MC.ink2 }}>{b === 0 ? 'None' : `${b}m`}</button>
            })}
          </div>
        </div>
        <div style={{ marginTop: 10, padding: '10px 13px', borderRadius: 11, background: valid ? MC.brandTint : MC.badBg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MM, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{clockIn} – {clockOut}</span>
          <span style={{ fontSize: 12.5, color: valid ? MC.ink3 : MC.bad }}>· {valid ? minsStr(worked(clockIn, clockOut, brk)) : 'clock out must be after in'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ width: 90, height: 50, borderRadius: 13, border: `1px solid ${MC.line}`, background: MC.paper, color: MC.ink2, cursor: 'pointer', fontFamily: MF, fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button disabled={!valid} onClick={() => { onSave({ clockIn, clockOut, brk }); onClose() }} style={{ flex: 1, height: 50, borderRadius: 13, border: 'none', cursor: valid ? 'pointer' : 'not-allowed', background: valid ? MC.brand : MC.line, color: valid ? '#fff' : MC.ink4, fontFamily: MF, fontSize: 15, fontWeight: 700 }}>Save hours</button>
        </div>
      </div>
    </div>
  )
}

// ── Staff hours bottom sheet ───────────────────────────────────────────────────
function StaffHoursSheet({ t, station, periodDays, dailyGrid, periodLabel, onEditDay, onAddDay, onClose }) {
  const staffGrid = dailyGrid[t.staffId] || null
  const pay = (t.totalMinutes / 60) * t.hourlyRate
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(9,18,13,0.52)' }} />
      <div style={{ position: 'relative', background: MC.bg, borderRadius: '22px 22px 0 0', padding: '20px 16px 34px', maxHeight: '90%', overflowY: 'auto', boxShadow: '0 -12px 40px rgba(9,18,13,0.24)' }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar name={t.name} station={station} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{t.name}</div>
            <div style={{ fontSize: 12, color: MC.ink3, marginTop: 2 }}>{periodLabel}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {periodDays.map((d, i) => {
            const dateStr = format(d, 'yyyy-MM-dd')
            const dayData = staffGrid?.days[dateStr]
            const session = dayData?.sessions?.[0] || null
            const has = !!(session?.in && session?.out)
            const inTime  = has ? format(new Date(session.in),  'HH:mm') : null
            const outTime = has ? format(new Date(session.out), 'HH:mm') : null
            const breakMins = has ? session.breaks.reduce((acc, b) =>
              (!b.start || !b.end) ? acc : acc + Math.round((new Date(b.end) - new Date(b.start)) / 60000), 0) : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: has ? MC.paper : MC.bg, border: `1px solid ${has ? MC.line : MC.line2}` }}>
                <div style={{ width: 42, height: 46, borderRadius: 9, background: has ? MC.bg : MC.line2, border: `1px solid ${MC.line}`, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <span style={{ fontFamily: MM, fontSize: 8.5, color: MC.ink3, fontWeight: 600, letterSpacing: '0.06em' }}>{format(d, 'EEE').toUpperCase()}</span>
                  <span style={{ fontFamily: MM, fontSize: 15, fontWeight: 600, color: has ? MC.ink : MC.ink4, lineHeight: 1 }}>{format(d, 'd')}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {has ? (
                    <>
                      <div style={{ fontFamily: MM, fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{inTime} – {outTime}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <span style={{ fontFamily: MM, fontSize: 11.5, color: MC.ink3 }}>{minsStr(dayData.minutes)}</span>
                        {breakMins > 0 && <><span style={{ color: MC.ink4 }}>·</span><span style={{ fontSize: 11.5, color: MC.ink3 }}>{breakMins}m break</span></>}
                      </div>
                    </>
                  ) : <div style={{ fontSize: 13, color: MC.ink4 }}>Off</div>}
                </div>
                <button onClick={() => has ? onEditDay({ dateStr, session }) : onAddDay(dateStr)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: MF, fontSize: 12, fontWeight: 600, color: MC.ink2, background: MC.bg, border: `1px solid ${MC.line}` }}>
                  {has
                    ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Edit</>
                    : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add</>}
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 14, padding: '13px 14px', background: MC.paper, borderRadius: 12, border: `1px solid ${MC.line}`, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <div style={{ fontFamily: MM, fontSize: 9, color: MC.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
            <div style={{ fontFamily: MM, fontSize: 17, fontWeight: 600, color: MC.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{minsStr(t.totalMinutes)}</div>
          </div>
          {t.hourlyRate > 0 && (
            <div>
              <div style={{ fontFamily: MM, fontSize: 9, color: MC.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Est. pay</div>
              <div style={{ fontFamily: MM, fontSize: 17, fontWeight: 600, color: pay > 0 ? MC.good : MC.ink4, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{pay > 0 ? `£${pay.toFixed(2)}` : '—'}</div>
            </div>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontFamily: MM, fontSize: 9, color: MC.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Rate</div>
            <div style={{ fontFamily: MM, fontSize: 12, fontWeight: 600, color: MC.ink3, marginTop: 3 }}>£{Number(t.hourlyRate).toFixed(2)}/hr</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TimesheetPage() {
  const [period,        setPeriod]        = useState('this_week')
  const [customFrom,    setCustomFrom]    = useState('')
  const [customTo,      setCustomTo]      = useState('')
  const [staffRates,    setStaffRates]    = useState({})
  const [staffProfiles, setStaffProfiles] = useState({})
  const [periodLeave,   setPeriodLeave]   = useState([])
  const [periodShifts,  setPeriodShifts]  = useState([])
  const [payrollLocks,  setPayrollLocks]  = useState([])
  const [lockSaving,    setLockSaving]    = useState(false)
  const [selStaff,      setSelStaff]      = useState(null)
  const [editCtx,       setEditCtx]       = useState(null)  // { dateStr, session }
  const [addTarget,     setAddTarget]     = useState(null)  // { staffId, date }

  const { venueId }   = useVenue()
  const { isManager } = useSession()
  const toast         = useToast()
  const { staff: staffList } = useStaffList()

  const { dateFrom, dateTo, label: periodLabel } = useMemo(
    () => periodToDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  )

  const { rows, loading, reload } = useTimesheetData(dateFrom, dateTo)

  const timesheets   = useMemo(() => buildTimesheets(rows, staffRates), [rows, staffRates])
  const dailyGrid    = useMemo(() => buildDailyGrid(rows), [rows])
  const totalMins    = useMemo(() => timesheets.reduce((a, t) => a + t.totalMinutes, 0), [timesheets])
  const totalWage    = useMemo(() => timesheets.reduce((a, t) => a + (t.totalMinutes / 60) * t.hourlyRate, 0), [timesheets])

  const totalHolidayPay = useMemo(() => timesheets.reduce((a, t) => {
    const profile = staffProfiles[t.staffId] ?? { contractedHours: null, workingDays: [] }
    return a + (calcHolidayMins(periodLeave, t.staffId, profile, dateFrom.slice(0, 10), dateTo.slice(0, 10)) / 60) * t.hourlyRate
  }, 0), [timesheets, periodLeave, staffProfiles, dateFrom, dateTo])

  const periodScheduled = useMemo(() => {
    let totalM = 0, totalCost = 0
    for (const sh of periodShifts) {
      const [sh_h, sh_m] = sh.start_time.split(':').map(Number)
      const [eh, em]     = sh.end_time.split(':').map(Number)
      const mins = (eh * 60 + em) - (sh_h * 60 + sh_m)
      totalM    += mins
      totalCost += (mins / 60) * (staffRates[sh.staff_id] ?? 0)
    }
    return { totalMins: totalM, totalCost }
  }, [periodShifts, staffRates])

  const stationMap = useMemo(() => {
    const map = {}
    for (const s of staffList ?? []) map[s.id] = s.station ?? ''
    return map
  }, [staffList])

  // Enumerate days in selected period up to today (caps future days)
  const periodDays = useMemo(() => {
    if (!dateFrom || !dateTo) return []
    try {
      const end = new Date(Math.min(new Date(dateTo).getTime(), Date.now()))
      return eachDayOfInterval({ start: new Date(dateFrom), end })
    } catch { return [] }
  }, [dateFrom, dateTo])

  const periodFrom = dateFrom ? dateFrom.slice(0, 10) : ''
  const periodTo   = dateTo   ? dateTo.slice(0, 10)   : ''
  const isPeriodLocked = payrollLocks.some(l => l.from === periodFrom && l.to === periodTo)

  useEffect(() => {
    if (!venueId) return
    supabase.from('staff').select('id, hourly_rate, contracted_hours, working_days').eq('venue_id', venueId)
      .then(({ data }) => {
        if (!data) return
        const rates = {}, profiles = {}
        for (const s of data) { rates[s.id] = s.hourly_rate ?? 0; profiles[s.id] = { contractedHours: s.contracted_hours ?? null, workingDays: s.working_days ?? [] } }
        setStaffRates(rates); setStaffProfiles(profiles)
      })
  }, [venueId])

  useEffect(() => {
    if (!venueId || !dateFrom || !dateTo) return
    supabase.from('time_off_requests').select('staff_id, start_date, end_date')
      .eq('venue_id', venueId).eq('status', 'approved').eq('leave_type', 'annual')
      .lte('start_date', dateTo.slice(0, 10)).gte('end_date', dateFrom.slice(0, 10))
      .then(({ data }) => setPeriodLeave(data ?? []))
  }, [venueId, dateFrom, dateTo])

  useEffect(() => {
    if (!venueId || !periodFrom || !periodTo) return
    supabase.from('shifts').select('staff_id, start_time, end_time, shift_date')
      .eq('venue_id', venueId).gte('shift_date', periodFrom).lte('shift_date', periodTo)
      .then(({ data }) => setPeriodShifts(data ?? []))
  }, [venueId, periodFrom, periodTo])

  useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', 'payroll_locks').maybeSingle()
      .then(({ data }) => { try { setPayrollLocks(JSON.parse(data?.value ?? '[]')) } catch { setPayrollLocks([]) } })
  }, [venueId])

  useEffect(() => { reload() }, [reload])

  const saveLocks = useCallback(async (locks) => {
    await supabase.from('app_settings').upsert({ venue_id: venueId, key: 'payroll_locks', value: JSON.stringify(locks) }, { onConflict: 'venue_id,key' })
    setPayrollLocks(locks)
  }, [venueId])

  const togglePayrollLock = useCallback(async () => {
    if (!periodFrom || !periodTo || periodFrom > periodTo) return
    setLockSaving(true)
    if (isPeriodLocked) {
      await saveLocks(payrollLocks.filter(l => !(l.from === periodFrom && l.to === periodTo)))
      toast('Period unlocked')
    } else {
      await saveLocks([...payrollLocks, { from: periodFrom, to: periodTo }])
      toast('Period locked for payroll')
    }
    setLockSaving(false)
  }, [isPeriodLocked, payrollLocks, periodFrom, periodTo, saveLocks, toast])

  const saveEditedSession = useCallback(async ({ dateStr, session }, { clockIn, clockOut }) => {
    const newIn  = `${dateStr}T${clockIn}:00`
    const newOut = `${dateStr}T${clockOut}:00`
    const updates = []
    if (session.inId)  updates.push(supabase.from('clock_events').update({ occurred_at: newIn  }).eq('id', session.inId))
    if (session.outId) updates.push(supabase.from('clock_events').update({ occurred_at: newOut }).eq('id', session.outId))
    const results = await Promise.all(updates)
    const err = results.find(r => r.error)?.error
    if (err) { toast(err.message, 'error'); return }
    toast('Hours updated')
    reload()
  }, [reload, toast])

  const exportPdf = () => {
    const pFrom = dateFrom.slice(0, 10), pTo = dateTo.slice(0, 10)
    const pdfRows = timesheets.map(t => {
      const hrs    = (t.totalMinutes / 60).toFixed(2)
      const rate   = Number(t.hourlyRate).toFixed(2)
      const worked = ((t.totalMinutes / 60) * t.hourlyRate).toFixed(2)
      const profile = staffProfiles[t.staffId] ?? { contractedHours: null, workingDays: [] }
      const holPay  = ((calcHolidayMins(periodLeave, t.staffId, profile, pFrom, pTo) / 60) * t.hourlyRate).toFixed(2)
      return [t.name, `${hrs} hrs`, rate > 0 ? `£${rate}/hr` : '—', worked > 0 ? `£${worked}` : '—', holPay > 0 ? `£${holPay}` : '—', `£${(parseFloat(worked) + parseFloat(holPay)).toFixed(2)}`]
    })
    pdfRows.push(['TOTAL', `${(totalMins / 60).toFixed(2)} hrs`, '', totalWage > 0 ? fmtGBP(totalWage) : '—', totalHolidayPay > 0 ? fmtGBP(totalHolidayPay) : '—', fmtGBP(totalWage + totalHolidayPay)])
    buildPdfReport({ title: 'Pelikn', subtitle: 'Timesheet Report', periodLabel, columns: ['Staff Member', 'Hours Worked', 'Hourly Rate', 'Worked Pay', 'Holiday Pay', 'Total Pay'], rows: pdfRows, didParseCell(h) { if (h.section === 'body' && h.row.index === pdfRows.length - 1) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [240, 240, 240] } }, filename: `timesheet-${dateFrom.slice(0, 10)}.pdf` })
  }

  const exportCsv = () => {
    const esc = v => `"${String(v).replace(/"/g, '""')}"`
    const pFrom = dateFrom.slice(0, 10), pTo = dateTo.slice(0, 10)
    const header = ['Name', 'Hours Worked', 'Hourly Rate (£)', 'Worked Pay (£)', 'Holiday Pay (£)', 'Total Pay (£)'].map(esc).join(',')
    const dataRows = timesheets.map(t => {
      const hrs = (t.totalMinutes / 60).toFixed(2), rate = Number(t.hourlyRate).toFixed(2)
      const worked = ((t.totalMinutes / 60) * t.hourlyRate).toFixed(2)
      const profile = staffProfiles[t.staffId] ?? { contractedHours: null, workingDays: [] }
      const holPay  = ((calcHolidayMins(periodLeave, t.staffId, profile, pFrom, pTo) / 60) * t.hourlyRate).toFixed(2)
      return [t.name, hrs, rate, worked, holPay, (parseFloat(worked) + parseFloat(holPay)).toFixed(2)].map(esc).join(',')
    })
    downloadCsv([header, ...dataRows, ['TOTAL', (totalMins / 60).toFixed(2), '', totalWage.toFixed(2), totalHolidayPay.toFixed(2), (totalWage + totalHolidayPay).toFixed(2)].map(esc).join(',')].join('\n'), `payroll-${periodFrom}-to-${periodTo}.csv`)
  }

  const under = totalWage > 0 ? periodScheduled.totalCost - totalWage : 0
  const underLabel = under > 0 ? `£${Math.round(under).toLocaleString()} under` : under < 0 ? `£${Math.round(Math.abs(under)).toLocaleString()} over` : null

  return (
    <div style={{ fontFamily: MF, color: MC.ink }}>
      {isManager && <ClockEditApprovalCard />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, margin: 0 }}>Timesheets</h1>
        <div style={{ display: 'flex', gap: 16 }}>
          {[['CSV', exportCsv], ['PDF', exportPdf]].map(([fmt, fn]) => (
            <button key={fmt} onClick={fn} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: MM, fontSize: 10.5, fontWeight: 700, color: MC.ink3, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Pay Period Summary card */}
      <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 18, padding: '15px 14px 16px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
        <div style={{ fontFamily: MM, fontSize: 9.5, color: MC.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Pay Period Summary</div>
        <PeriodChips period={period} onChange={setPeriod} />

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, background: MC.paper, color: MC.ink, outline: 'none' }} />
            <span style={{ fontSize: 12, color: MC.ink4, flexShrink: 0 }}>to</span>
            <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, background: MC.paper, color: MC.ink, outline: 'none' }} />
          </div>
        )}

        {periodLabel && periodLabel !== '—' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: MC.ink }}>{periodLabel}</span>
            {isManager && periodFrom && periodTo && (
              <button onClick={togglePayrollLock} disabled={lockSaving} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MF, fontSize: 11.5, fontWeight: 600, color: isPeriodLocked ? MC.good : MC.ink2, background: MC.paper, border: `1px solid ${isPeriodLocked ? MC.good + '55' : MC.line}`, borderRadius: 9, padding: '6px 11px', cursor: 'pointer', flexShrink: 0, opacity: lockSaving ? 0.4 : 1, whiteSpace: 'nowrap' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d={isPeriodLocked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1'}/></svg>
                {isPeriodLocked ? 'Locked' : lockSaving ? 'Locking…' : 'Lock for payroll'}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><LoadingSpinner /></div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 7 }}>
              <SumTile label={`Actual hours · ${timesheets.length} staff`} value={totalMins > 0 ? minsStr(totalMins) : null} />
              <SumTile label="Scheduled hours" value={periodScheduled.totalMins > 0 ? minsStr(periodScheduled.totalMins) : null} />
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <SumTile label="Actual wage bill" value={totalWage > 0 ? fmtGBP(totalWage + totalHolidayPay) : null} />
              <SumTile label="Scheduled cost" value={periodScheduled.totalCost > 0 ? fmtGBP(periodScheduled.totalCost) : null} sub={underLabel} subGood={under > 0} />
            </div>
          </>
        )}
      </div>

      {/* Staff list */}
      {!loading && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 9px' }}>
            <span style={{ fontFamily: MM, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Staff</span>
            <span style={{ fontFamily: MM, fontSize: 11, color: MC.ink3 }}>{timesheets.length} members{totalMins > 0 ? ` · ${minsStr(totalMins)} total` : ''}</span>
          </div>
          {timesheets.length === 0 ? (
            <p style={{ fontSize: 13, color: MC.ink4, fontStyle: 'italic', padding: '8px 2px' }}>No clock events recorded for this period.</p>
          ) : (
            <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 16, overflow: 'hidden' }}>
              {timesheets.map((t, i) => (
                <StaffRow key={t.staffId} t={t} station={stationMap[t.staffId] ?? ''} last={i === timesheets.length - 1} onTap={() => setSelStaff(t)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff hours bottom sheet */}
      {selStaff && (
        <StaffHoursSheet
          t={selStaff}
          station={stationMap[selStaff.staffId] ?? ''}
          periodDays={periodDays}
          dailyGrid={dailyGrid}
          periodLabel={periodLabel}
          onEditDay={ctx => setEditCtx(ctx)}
          onAddDay={dateStr => setAddTarget({ staffId: selStaff.staffId, date: dateStr })}
          onClose={() => setSelStaff(null)}
        />
      )}

      {/* Wheel picker edit sheet */}
      {editCtx && selStaff && (
        <EditSessionSheet
          staffName={selStaff.name}
          dayLabel={format(parseISO(editCtx.dateStr), 'EEE d MMM')}
          session={editCtx.session}
          onSave={times => saveEditedSession(editCtx, times)}
          onClose={() => setEditCtx(null)}
        />
      )}

      {/* Add session modal */}
      <AddSessionModal
        open={!!addTarget}
        onClose={() => setAddTarget(null)}
        staffList={staffList}
        initialStaffId={addTarget?.staffId ?? ''}
        initialDate={addTarget?.date ?? ''}
        venueId={venueId}
        onSaved={() => { setAddTarget(null); reload() }}
      />
    </div>
  )
}
