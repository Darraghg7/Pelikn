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
import { formatLondon, londonWallTimeToInstant } from '../../lib/time'
import { offlineRpc } from '../../lib/offlineSupabase'

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
  const st = STATIONS[station] || { bg: '#eef4f0', fg: '#13362a' }
  return (
    <span
      className="shrink-0 flex items-center justify-center font-mono font-semibold"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.265), background: st.bg, color: st.fg, fontSize: Math.round(size * 0.32), letterSpacing: '0.02em' }}
    >
      {initials}
    </span>
  )
}

function SumTile({ label, value, sub, subGood }) {
  return (
    <div className="flex-1 bg-surface rounded-[11px] px-3 py-[10px]">
      <div className="font-mono text-[11px] text-charcoal/50 uppercase tracking-[0.1em] font-semibold mb-[5px] leading-[1.3]">{label}</div>
      <div className="font-mono text-[17px] font-semibold text-charcoal tracking-[-0.025em] tabular-nums leading-none">{value || '—'}</div>
      {sub && <div className={`font-mono text-[11px] font-semibold mt-[5px] ${subGood ? 'text-success' : 'text-warning'}`}>{sub}</div>}
    </div>
  )
}

function PeriodChips({ period, onChange }) {
  return (
    <div className="flex gap-[6px] overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] pb-px">
      {PERIODS.map(p => {
        const on = period === p.key
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={`shrink-0 text-[13.5px] cursor-pointer px-[15px] py-[7px] rounded-full border transition-colors ${on ? 'font-semibold bg-brand text-white border-brand' : 'font-medium bg-white dark:bg-paperDark text-charcoal/75 border-charcoal/10'}`}
          >
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
    <button
      onClick={onTap}
      className={`flex items-center gap-[11px] px-[14px] py-3 w-full text-left cursor-pointer bg-transparent border-none ${last ? '' : 'border-b border-charcoal/[0.06]'}`}
    >
      <Avatar name={t.name} station={station} size={38} />
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold text-charcoal tracking-[-0.01em] leading-[1.2]">{t.name}</div>
        {t.hourlyRate > 0 && <div className="font-mono text-[11px] text-charcoal/50 mt-[3px]">£{Number(t.hourlyRate).toFixed(2)}/hr</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div className={`font-mono text-[15px] font-semibold leading-none tabular-nums ${hasData ? 'text-charcoal' : 'text-charcoal/30'}`}>{minsStr(t.totalMinutes)}</div>
          <div className={`font-mono text-[11px] mt-1 font-semibold ${hasData && pay > 0 ? 'text-success' : 'text-charcoal/30'}`}>
            {hasData && pay > 0 ? `£${pay.toFixed(2)}` : '—'}
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30"><path d="M1 1l4 4-4 4" /></svg>
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
    <div className="relative flex-1" style={{ height: WH_VIS * WH_IH }}>
      <div
        ref={setNode}
        onScroll={onScroll}
        className="overflow-y-scroll [scroll-snap-type:y_mandatory] [scrollbar-width:none]"
        style={{ height: WH_VIS * WH_IH, padding: `${pad}px 0` }}
      >
        {strVals.map((v, i) => {
          const on = v === strVal
          return (
            <div
              key={v}
              onClick={() => { ref.current?.scrollTo({ top: i * WH_IH, behavior: 'smooth' }); onChange(v) }}
              className="flex items-center justify-center [scroll-snap-align:center] cursor-pointer font-mono tabular-nums transition-[font-size,color] duration-100"
              style={{ height: WH_IH, fontSize: on ? 23 : 18, fontWeight: on ? 600 : 500, color: on ? '#0d1a14' : '#b3b9b5' }}
            >
              {v}
            </div>
          )
        })}
      </div>
      <div className="absolute left-0 right-0 pointer-events-none border-t border-b border-charcoal/10" style={{ top: pad, height: WH_IH, background: 'rgba(19,54,42,0.03)' }} />
      <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{ height: pad, background: 'linear-gradient(#f3f3ef, #f3f3ef00)' }} />
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none" style={{ height: pad, background: 'linear-gradient(#f3f3ef00, #f3f3ef)' }} />
    </div>
  )
}

// ── Edit session sheet (wheel picker) ──────────────────────────────────────────
function EditSessionSheet({ staffName, dayLabel, session, onSave, onClose }) {
  const toHM = (iso) => iso ? formatLondon(iso, 'HH:mm') : null
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
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'rgba(9,18,13,0.52)' }} />
      <div className="relative bg-surface rounded-t-[22px] px-4 pb-[34px] pt-[10px] max-h-[90%] overflow-y-auto" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.24)' }}>
        <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[17px] font-semibold tracking-[-0.015em]">{dayLabel}</div>
            <div className="text-xs text-charcoal/50 mt-0.5">{staffName}</div>
          </div>
          {session?.in && <span className="font-mono text-[11px] font-bold text-warning bg-warning/10 uppercase tracking-[0.05em] px-[9px] py-1 rounded-full">Editing</span>}
        </div>
        <div className="flex gap-2 bg-charcoal/[0.06] p-1 rounded-xl mb-3">
          {[['in', 'Clock in', clockIn], ['out', 'Clock out', clockOut]].map(([k, label, val]) => {
            const on = edge === k
            return (
              <button
                key={k}
                onClick={() => setEdge(k)}
                className={`flex-1 cursor-pointer border-none rounded-[9px] py-2 ${on ? 'bg-white dark:bg-paperDark shadow-[0_1px_3px_rgba(9,18,13,0.1)]' : 'bg-transparent'}`}
              >
                <div className="font-mono text-[11px] text-charcoal/50 uppercase tracking-[0.06em] font-semibold">{label}</div>
                <div className={`font-mono text-[17px] font-semibold mt-0.5 tabular-nums ${on ? 'text-brand' : 'text-charcoal/50'}`}>{val}</div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-center gap-1 mt-3">
          <TsWheel values={WH_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
          <span className="font-mono text-[22px] font-semibold text-charcoal/50 pb-0.5">:</span>
          <TsWheel values={WH_MINS}  value={cm} onChange={(m) => setCur(ch, m)} />
        </div>
        <div className="mt-2">
          <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.07em] uppercase font-semibold px-0.5 pb-[7px]">Unpaid break</div>
          <div className="flex flex-wrap gap-[6px]">
            {WH_BREAKS.map(b => {
              const on = b === brk
              return (
                <button
                  key={b}
                  onClick={() => setBrk(b)}
                  className={`font-mono text-xs font-semibold cursor-pointer px-[11px] py-[6px] rounded-[9px] border ${on ? 'border-brand bg-brand text-white' : 'border-charcoal/10 bg-white dark:bg-paperDark text-charcoal/75'}`}
                >
                  {b === 0 ? 'None' : `${b}m`}
                </button>
              )
            })}
          </div>
        </div>
        <div className={`mt-[10px] px-[13px] py-[10px] rounded-[11px] flex items-center gap-2 ${valid ? 'bg-brand/8' : 'bg-danger/10'}`}>
          <span className="font-mono text-sm font-semibold tabular-nums">{clockIn} – {clockOut}</span>
          <span className={`text-[12.5px] ${valid ? 'text-charcoal/50' : 'text-danger'}`}>· {valid ? minsStr(worked(clockIn, clockOut, brk)) : 'clock out must be after in'}</span>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="w-[90px] h-[50px] rounded-[13px] border border-charcoal/10 bg-white dark:bg-paperDark text-charcoal/75 cursor-pointer text-sm font-semibold">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => { onSave({ clockIn, clockOut, brk }); onClose() }}
            className={`flex-1 h-[50px] rounded-[13px] border-none text-[15px] font-bold ${valid ? 'bg-brand text-white cursor-pointer' : 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'}`}
          >
            Save hours
          </button>
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
    <div className="fixed inset-0 z-[50] flex flex-col justify-end">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'rgba(9,18,13,0.52)' }} />
      <div className="relative bg-surface rounded-t-[22px] px-4 pt-5 pb-[34px] max-h-[90%] overflow-y-auto" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.24)' }}>
        <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-[14px]">
          <Avatar name={t.name} station={station} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.015em]">{t.name}</div>
            <div className="text-xs text-charcoal/50 mt-0.5">{periodLabel}</div>
          </div>
        </div>
        <div className="flex flex-col gap-[6px]">
          {periodDays.map((d, i) => {
            const dateStr = format(d, 'yyyy-MM-dd')
            const dayData = staffGrid?.days[dateStr]
            const session = dayData?.sessions?.[0] || null
            const has = !!(session?.in && session?.out)
            const inTime  = has ? formatLondon(session.in,  'HH:mm') : null
            const outTime = has ? formatLondon(session.out, 'HH:mm') : null
            const breakMins = has ? session.breaks.reduce((acc, b) =>
              (!b.start || !b.end) ? acc : acc + Math.round((new Date(b.end) - new Date(b.start)) / 60000), 0) : 0
            return (
              <div key={i} className={`flex items-center gap-[10px] px-3 py-[10px] rounded-xl border ${has ? 'bg-white dark:bg-paperDark border-charcoal/10' : 'bg-surface border-charcoal/[0.06]'}`}>
                <div className={`w-[42px] h-[46px] rounded-[9px] border border-charcoal/10 shrink-0 flex flex-col items-center justify-center gap-px ${has ? 'bg-surface' : 'bg-charcoal/[0.06]'}`}>
                  <span className="font-mono text-[11px] text-charcoal/50 font-semibold tracking-[0.06em]">{format(d, 'EEE').toUpperCase()}</span>
                  <span className={`font-mono text-[15px] font-semibold leading-none ${has ? 'text-charcoal' : 'text-charcoal/30'}`}>{format(d, 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {has ? (
                    <>
                      <div className="font-mono text-[13.5px] font-semibold tabular-nums">{inTime} – {outTime}</div>
                      <div className="flex items-center gap-[5px] mt-0.5">
                        <span className="font-mono text-[11.5px] text-charcoal/50">{minsStr(dayData.minutes)}</span>
                        {breakMins > 0 && <><span className="text-charcoal/30">·</span><span className="text-[11.5px] text-charcoal/50">{breakMins}m break</span></>}
                      </div>
                    </>
                  ) : <div className="text-[13px] text-charcoal/30">Off</div>}
                </div>
                <button
                  onClick={() => has ? onEditDay({ dateStr, session }) : onAddDay(dateStr)}
                  className="shrink-0 flex items-center gap-1 px-3 py-[7px] rounded-[9px] cursor-pointer text-xs font-semibold text-charcoal/75 bg-surface border border-charcoal/10"
                >
                  {has
                    ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Edit</>
                    : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add</>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="mt-[14px] px-[14px] py-[13px] bg-white dark:bg-paperDark rounded-xl border border-charcoal/10 flex items-center gap-5">
          <div>
            <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.1em] uppercase font-semibold">Total</div>
            <div className="font-mono text-[17px] font-semibold text-charcoal mt-[3px] tabular-nums">{minsStr(t.totalMinutes)}</div>
          </div>
          {t.hourlyRate > 0 && (
            <div>
              <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.1em] uppercase font-semibold">Est. pay</div>
              <div className={`font-mono text-[17px] font-semibold mt-[3px] tabular-nums ${pay > 0 ? 'text-success' : 'text-charcoal/30'}`}>{pay > 0 ? `£${pay.toFixed(2)}` : '—'}</div>
            </div>
          )}
          <div className="ml-auto">
            <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.1em] uppercase font-semibold">Rate</div>
            <div className="font-mono text-xs font-semibold text-charcoal/50 mt-[3px]">£{Number(t.hourlyRate).toFixed(2)}/hr</div>
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
  const [editCtx,       setEditCtx]       = useState(null)
  const [addTarget,     setAddTarget]     = useState(null)

  const { venueId }   = useVenue()
  const { isManager } = useSession()
  const toast         = useToast()
  const { staff: staffList } = useStaffList()

  const { dateFrom, dateTo, label: periodLabel } = useMemo(
    () => periodToDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  )

  const { rows, loading, error: loadError, reload } = useTimesheetData(dateFrom, dateTo)

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

  const saveEditedSession = useCallback(async ({ dateStr, session }, { clockIn, clockOut, brk }) => {
    // Interpret the edited times as UK wall-clock and store the resulting UTC
    // instant (ISO with offset) — a bare string would be read as UTC by Postgres.
    const newIn  = londonWallTimeToInstant(dateStr, clockIn).toISOString()
    const newOut = londonWallTimeToInstant(dateStr, clockOut).toISOString()
    // Routed through edit_clock_session (not a raw table update) so the break
    // duration picked in the sheet is actually replaced in clock_events —
    // this RPC also handles deleting/re-inserting break_start/break_end.
    const { error } = await offlineRpc('edit_clock_session', {
      p_clock_in_id:    session.inId,
      p_clock_in_time:  newIn,
      p_clock_out_id:   session.outId ?? null,
      p_clock_out_time: newOut,
      p_break_minutes:  brk || 0,
    })
    if (error) { toast(error.message, 'error'); return }
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
    <div className="text-charcoal">
      {isManager && <ClockEditApprovalCard />}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] font-bold tracking-[-0.03em] leading-[1.05] m-0">Timesheets</h1>
        <div className="flex gap-4">
          {[['CSV', exportCsv], ['PDF', exportPdf]].map(([fmt, fn]) => (
            <button key={fmt} onClick={fn} className="flex items-center gap-1 font-mono text-[11px] font-bold text-charcoal/50 tracking-[0.05em] uppercase bg-transparent border-none cursor-pointer p-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Pay Period Summary card */}
      <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[18px] px-[14px] pt-[15px] pb-4 flex flex-col gap-3 mb-[14px]">
        <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.12em] uppercase font-semibold">Pay Period Summary</div>
        <PeriodChips period={period} onChange={setPeriod} />

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="flex-1 px-[10px] py-[7px] rounded-[9px] border border-charcoal/10 text-[13px] bg-white dark:bg-paperDark text-charcoal outline-none" />
            <span className="text-xs text-charcoal/30 shrink-0">to</span>
            <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} className="flex-1 px-[10px] py-[7px] rounded-[9px] border border-charcoal/10 text-[13px] bg-white dark:bg-paperDark text-charcoal outline-none" />
          </div>
        )}

        {periodLabel && periodLabel !== '—' && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-charcoal">{periodLabel}</span>
            {isManager && periodFrom && periodTo && (
              <button
                onClick={togglePayrollLock}
                disabled={lockSaving}
                className={`flex items-center gap-[5px] text-[11.5px] font-semibold bg-white dark:bg-paperDark rounded-[9px] px-[11px] py-[6px] cursor-pointer shrink-0 whitespace-nowrap transition-opacity ${isPeriodLocked ? 'text-success border border-success/[0.33]' : 'text-charcoal/75 border border-charcoal/10'} ${lockSaving ? 'opacity-40' : 'opacity-100'}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d={isPeriodLocked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1'}/></svg>
                {isPeriodLocked ? 'Locked' : lockSaving ? 'Locking…' : 'Lock for payroll'}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><LoadingSpinner /></div>
        ) : loadError ? (
          <div className="flex items-center gap-3 bg-danger/10 rounded-[11px] px-[13px] py-[11px]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-danger"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-danger leading-tight">Couldn't load hours</div>
              <div className="text-[11.5px] text-charcoal/50 mt-[3px] leading-snug">The clock-in data failed to load — this can happen on an out-of-date app. Try again, or fully close and reopen the app.</div>
            </div>
            <button onClick={reload} className="shrink-0 text-[12px] font-semibold text-charcoal bg-white dark:bg-paperDark border border-charcoal/10 rounded-[9px] px-[13px] py-[8px] cursor-pointer">Retry</button>
          </div>
        ) : (
          <>
            <div className="flex gap-[7px]">
              <SumTile label={`Actual hours · ${timesheets.length} staff`} value={totalMins > 0 ? minsStr(totalMins) : null} />
              <SumTile label="Scheduled hours" value={periodScheduled.totalMins > 0 ? minsStr(periodScheduled.totalMins) : null} />
            </div>
            <div className="flex gap-[7px]">
              <SumTile label="Actual wage bill" value={totalWage > 0 ? fmtGBP(totalWage + totalHolidayPay) : null} />
              <SumTile label="Scheduled cost" value={periodScheduled.totalCost > 0 ? fmtGBP(periodScheduled.totalCost) : null} sub={underLabel} subGood={under > 0} />
            </div>
          </>
        )}
      </div>

      {/* Staff list */}
      {!loading && !loadError && (
        <div>
          <div className="flex items-center justify-between px-0.5 pb-[9px]">
            <span className="font-mono text-[11px] text-charcoal/50 tracking-[0.1em] uppercase font-semibold">Staff</span>
            <span className="font-mono text-[11px] text-charcoal/50">{timesheets.length} members{totalMins > 0 ? ` · ${minsStr(totalMins)} total` : ''}</span>
          </div>
          {timesheets.length === 0 ? (
            <p className="text-[13px] text-charcoal/30 italic px-0.5 py-2">No clock events recorded for this period.</p>
          ) : (
            <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-2xl overflow-hidden">
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
