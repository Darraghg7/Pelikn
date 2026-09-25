import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { format, endOfWeek, addWeeks, startOfMonth, endOfMonth, subMonths, parseISO, eachDayOfInterval } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { fetchStaffPayRates, fetchStaffPrivateFields } from '../../lib/api/staffRestricted'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { useTimesheetData } from '../../hooks/useClockEvents'
import { useStaffList } from '../../hooks/useShifts'
import { formatMinutes, getWeekStart, downloadCsv } from '../../lib/utils'
import { buildPdfReport } from '../../lib/pdfUtils'
import { countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { SkeletonList } from '../../components/ui/Skeleton'
import AddSessionModal from './AddSessionModal'
import ClockEditApprovalCard from '../../components/shifts/ClockEditApprovalCard'
import { formatLondon, resolveShiftInstants } from '../../lib/time'
import { buildTimesheets, buildDailyGrid, partitionDaySessions, breakMinutes, sessionMinutes } from '../../lib/timesheet'
import { offlineRpc } from '../../lib/offlineSupabase'
import { Link } from 'react-router-dom'
import { CARD, TabBar } from '../../components/temperature/TempPageParts'

function useBodyScrollLock() {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])
}

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

// £1,270.96 — thousands separators for the summary figures
function money(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 89h 51m / 220h 00m / 8h 03m — fixed-width minutes so columns line up
function hm(mins) {
  const total = Math.max(0, Math.round(mins))
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

// "21 – 27 Sep 2026", "29 Sep – 5 Oct 2026", "30 Dec 2026 – 5 Jan 2027"
function rangeLabel(from, to) {
  if (format(from, 'yyyy') !== format(to, 'yyyy')) return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`
  if (format(from, 'MMM') !== format(to, 'MMM')) return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`
  return `${format(from, 'd')} – ${format(to, 'd MMM yyyy')}`
}

function minsStr(mins) {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
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

const PERIOD_TABS  = [
  { id: 'this_week',  label: 'This week'  },
  { id: 'last_week',  label: 'Last week'  },
  { id: 'this_month', label: 'This month' },
]
const OTHER_PERIODS = [
  { key: 'last_month', label: 'Last month' },
  { key: 'custom',     label: 'Custom dates' },
]

function periodToDates(period, customFrom, customTo) {
  const now = new Date()
  const thisWeekStart = getWeekStart(now)
  const thisWeekEnd   = endOfWeek(thisWeekStart, { weekStartsOn: 1 })
  if (period === 'this_week') return { dateFrom: thisWeekStart.toISOString(), dateTo: thisWeekEnd.toISOString(), label: rangeLabel(thisWeekStart, thisWeekEnd) }
  if (period === 'last_week') {
    const start = addWeeks(thisWeekStart, -1), end = endOfWeek(start, { weekStartsOn: 1 })
    return { dateFrom: start.toISOString(), dateTo: end.toISOString(), label: rangeLabel(start, end) }
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
    return { dateFrom: start.toISOString(), dateTo: new Date(end.getTime() + END_OF_DAY_MS).toISOString(), label: rangeLabel(start, end) }
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

function SumCell({ label, value }) {
  return (
    <div className="px-4 sm:px-5 py-4 min-w-0">
      <p className="text-sm text-ink3 dark:text-white/45">{label}</p>
      <p className="font-mono text-[26px] min-[420px]:text-[30px] leading-tight font-semibold text-ink dark:text-white mt-1 truncate tabular-nums">{value}</p>
    </div>
  )
}

function staffInitials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function StaffRow({ t, onTap }) {
  const hasData = t.totalMinutes > 0
  const pay = (t.totalMinutes / 60) * t.hourlyRate
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
    >
      <span className="shrink-0 w-14 h-14 rounded-2xl bg-brand-tint dark:bg-white/10 inline-flex items-center justify-center text-[17px] font-semibold text-ink dark:text-white">
        {staffInitials(t.name)}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[19px] font-semibold text-ink dark:text-white truncate">{t.name}</span>
        {t.hourlyRate > 0 && <span className="block font-mono text-[15px] text-ink3 dark:text-white/45 mt-0.5">£{Number(t.hourlyRate).toFixed(2)}/hr</span>}
      </span>
      {hasData ? (
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[19px] font-semibold text-ink dark:text-white tabular-nums">{hm(t.totalMinutes)}</span>
          {pay > 0 && <span className="block font-mono text-[15px] font-semibold text-good dark:text-[#7fd1a4] mt-0.5 tabular-nums">{fmtGBP(pay)}</span>}
        </span>
      ) : (
        <span className="shrink-0 font-mono text-[19px] text-ink4 dark:text-white/30" aria-label="No hours">–</span>
      )}
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const el = ref.current; if (el) el.scrollTop = idx * WH_IH }, [strVal]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="absolute left-0 right-0 pointer-events-none border-t border-b border-charcoal/10 dark:border-white/10" style={{ top: pad, height: WH_IH, background: 'rgba(19,54,42,0.03)' }} />
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
  // Prefill the break already on the session. Left at 0 this sheet silently
  // erased it: saving routes through edit_clock_session, which replaces the
  // break events with p_break_minutes, so opening the sheet to nudge a clock-out
  // by five minutes also paid back every recorded break.
  const [brk,      setBrk] = useState(() => {
    const mins = (session?.breaks ?? []).reduce((acc, b) =>
      (!b.start || !b.end) ? acc : acc + (new Date(b.end) - new Date(b.start)) / 60000, 0)
    return Math.round(mins)
  })
  const [edge,     setEdge]= useState('out')
  const [ch, cm] = (edge === 'in' ? clockIn : clockOut).split(':')
  const setCur = (h, m) => { const v = `${h}:${m}`; edge === 'in' ? setIn(v) : setOut(v) }
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const worked = (s, e, b = 0) => { let d = toMin(e) - toMin(s); if (d < 0) d += 1440; return Math.max(0, d - b) }
  const mins = worked(clockIn, clockOut, brk)
  const valid = mins > 0
  useBodyScrollLock()
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'rgba(9,18,13,0.52)' }} />
      <div className="relative bg-surface rounded-t-[22px] px-4 pb-[34px] pt-[10px] max-h-[90%] overflow-y-auto [-webkit-overflow-scrolling:touch]" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.24)' }}>
        <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 dark:bg-white/10 mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[17px] font-semibold tracking-[-0.015em]">{dayLabel}</div>
            <div className="text-xs text-charcoal/50 dark:text-white/40 mt-0.5">{staffName}</div>
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
                <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.06em] font-semibold">{label}</div>
                <div className={`font-mono text-[17px] font-semibold mt-0.5 tabular-nums ${on ? 'text-brand' : 'text-charcoal/50 dark:text-white/40'}`}>{val}</div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-center gap-1 mt-3">
          <TsWheel values={WH_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
          <span className="font-mono text-[22px] font-semibold text-charcoal/50 dark:text-white/40 pb-0.5">:</span>
          <TsWheel values={WH_MINS}  value={cm} onChange={(m) => setCur(ch, m)} />
        </div>
        <div className="mt-2">
          <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 tracking-[0.07em] uppercase font-semibold px-0.5 pb-[7px]">Unpaid break</div>
          <div className="flex flex-wrap gap-[6px]">
            {/* The recorded break is rarely a round number, so offer it as its
                own chip — otherwise a 37m break renders with nothing selected
                and reads as "no break". */}
            {(WH_BREAKS.includes(brk) ? WH_BREAKS : [...WH_BREAKS, brk].sort((a, b) => a - b)).map(b => {
              const on = b === brk
              return (
                <button
                  key={b}
                  onClick={() => setBrk(b)}
                  className={`font-mono text-xs font-semibold cursor-pointer px-[11px] py-[6px] rounded-[9px] border ${on ? 'border-brand bg-brand text-white' : 'border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-charcoal/75 dark:text-white/60'}`}
                >
                  {b === 0 ? 'None' : `${b}m`}
                </button>
              )
            })}
          </div>
        </div>
        <div className={`mt-[10px] px-[13px] py-[10px] rounded-[11px] flex items-center gap-2 ${valid ? 'bg-brand/8' : 'bg-danger/10'}`}>
          <span className="font-mono text-sm font-semibold tabular-nums">{clockIn} – {clockOut}</span>
          <span className={`text-[12.5px] ${valid ? 'text-charcoal/50 dark:text-white/40' : 'text-danger'}`}>· {valid ? minsStr(worked(clockIn, clockOut, brk)) : 'clock out must be after in'}</span>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="w-[90px] h-[50px] rounded-[13px] border border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-charcoal/75 dark:text-white/60 cursor-pointer text-sm font-semibold">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => { onSave({ clockIn, clockOut, brk }); onClose() }}
            className={`flex-1 h-[50px] rounded-[13px] border-none text-[15px] font-bold ${valid ? 'bg-brand text-white cursor-pointer' : 'bg-charcoal/10 dark:bg-white/10 text-charcoal/30 dark:text-white/30 cursor-not-allowed'}`}
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
  useBodyScrollLock()
  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'rgba(9,18,13,0.52)' }} />
      <div className="relative bg-surface rounded-t-[22px] px-4 pt-5 pb-[34px] max-h-[90%] overflow-y-auto [-webkit-overflow-scrolling:touch]" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.24)' }}>
        <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 dark:bg-white/10 mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-[14px]">
          <Avatar name={t.name} station={station} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.015em]">{t.name}</div>
            <div className="text-xs text-charcoal/50 dark:text-white/40 mt-0.5">{periodLabel}</div>
          </div>
        </div>
        <div className="flex flex-col gap-[6px]">
          {periodDays.map((d, i) => {
            const dateStr = format(d, 'yyyy-MM-dd')
            const dayData = staffGrid?.days[dateStr]
            // Every session of the day, not just the first — a split shift
            // (lunch then dinner) is two, and showing only one hid the rest of
            // the day's hours even though the totals below counted them.
            const { real, orphans } = partitionDaySessions(dayData?.sessions ?? [])
            const has = real.length > 0
            return (
              <div key={i} className={`flex items-center gap-[10px] px-3 py-[10px] rounded-xl border ${has ? 'bg-white dark:bg-paperDark border-charcoal/10 dark:border-white/10' : 'bg-surface border-charcoal/[0.06]'}`}>
                <div className={`w-[42px] h-[46px] rounded-[9px] border border-charcoal/10 dark:border-white/10 shrink-0 flex flex-col items-center justify-center gap-px ${has ? 'bg-surface' : 'bg-charcoal/[0.06]'}`}>
                  <span className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 font-semibold tracking-[0.06em]">{format(d, 'EEE').toUpperCase()}</span>
                  <span className={`font-mono text-[15px] font-semibold leading-none ${has ? 'text-charcoal dark:text-white' : 'text-charcoal/30 dark:text-white/30'}`}>{format(d, 'd')}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  {has ? real.map((session, si) => {
                    const complete = !!(session.in && session.out)
                    const breakMins = Math.round(breakMinutes(session.breaks))
                    const mins = sessionMinutes(session)
                    return (
                      <button
                        key={si}
                        onClick={() => onEditDay({ dateStr, session })}
                        className="text-left bg-transparent border-none p-0 cursor-pointer"
                      >
                        <div className="font-mono text-[13.5px] font-semibold tabular-nums">
                          {formatLondon(session.in, 'HH:mm')} – {complete
                            ? formatLondon(session.out, 'HH:mm')
                            : <span className="text-warning">still in</span>}
                        </div>
                        <div className="flex items-center gap-[5px] mt-0.5">
                          <span className="font-mono text-[11.5px] text-charcoal/50 dark:text-white/40">{complete ? minsStr(mins) : 'no clock out'}</span>
                          {breakMins > 0 && <><span className="text-charcoal/30 dark:text-white/30">·</span><span className="text-[11.5px] text-charcoal/50 dark:text-white/40">{breakMins}m break</span></>}
                        </div>
                      </button>
                    )
                  }) : <div className="text-[13px] text-charcoal/30 dark:text-white/30">Off</div>}
                  {orphans.length > 0 && (
                    <div className="font-mono text-[11px] text-charcoal/40 dark:text-white/35">
                      {orphans.length} duplicate punch{orphans.length > 1 ? 'es' : ''} ignored
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onAddDay(dateStr)}
                  className="shrink-0 flex items-center gap-1 px-3 py-[7px] rounded-[9px] cursor-pointer text-xs font-semibold text-charcoal/75 dark:text-white/60 bg-surface border border-charcoal/10 dark:border-white/10"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add
                </button>
              </div>
            )
          })}
        </div>
        <div className="mt-[14px] px-[14px] py-[13px] bg-white dark:bg-paperDark rounded-xl border border-charcoal/10 dark:border-white/10 flex items-center gap-5">
          <div>
            <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 tracking-[0.1em] uppercase font-semibold">Total</div>
            <div className="font-mono text-[17px] font-semibold text-charcoal dark:text-white mt-[3px] tabular-nums">{minsStr(t.totalMinutes)}</div>
          </div>
          {t.hourlyRate > 0 && (
            <div>
              <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 tracking-[0.1em] uppercase font-semibold">Est. pay</div>
              <div className={`font-mono text-[17px] font-semibold mt-[3px] tabular-nums ${pay > 0 ? 'text-success' : 'text-charcoal/30 dark:text-white/30'}`}>{pay > 0 ? `£${pay.toFixed(2)}` : '—'}</div>
            </div>
          )}
          <div className="ml-auto">
            <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 tracking-[0.1em] uppercase font-semibold">Rate</div>
            <div className="font-mono text-xs font-semibold text-charcoal/50 dark:text-white/40 mt-[3px]">£{Number(t.hourlyRate).toFixed(2)}/hr</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full h-[50px] mt-4 rounded-[13px] border border-charcoal/10 bg-white dark:bg-paperDark text-charcoal/75 cursor-pointer text-sm font-semibold"
        >
          Close
        </button>
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

  const { venueId, venueSlug } = useVenue()
  const { isManager } = useSession()
  const toast         = useToast()
  const { staff: staffList } = useStaffList()

  const { dateFrom, dateTo, label: periodLabel } = useMemo(
    () => periodToDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  )

  const { rows, loading, error: loadError, reload } = useTimesheetData(dateFrom, dateTo)

  const clockedIn    = useMemo(() => buildTimesheets(rows, staffRates), [rows, staffRates])
  // Everyone on the team is listed, not just who clocked in — a row with no
  // hours is where a manager taps to add a missed shift.
  const timesheets   = useMemo(() => {
    const seen = new Set(clockedIn.map(t => t.staffId))
    const idle = (staffList ?? [])
      .filter(s => !seen.has(s.id))
      .map(s => ({ staffId: s.id, name: s.name ?? 'Unknown', hourlyRate: staffRates[s.id] ?? 0, sessions: [], totalMinutes: 0 }))
    return [...clockedIn, ...idle].sort((a, b) => a.name.localeCompare(b.name))
  }, [clockedIn, staffList, staffRates])
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
    // hourly_rate (117) and contracted_hours (118) are no longer selectable
    // from the table; both come from RPCs that return the venue for a manager
    // and just your own row otherwise. Timesheets are a manager screen, so
    // this is the full set. working_days stays on the table — it drives
    // availability and is not private.
    Promise.all([
      supabase.from('staff').select('id, working_days').eq('venue_id', venueId),
      fetchStaffPayRates(),
      fetchStaffPrivateFields(),
    ]).then(([{ data }, payRates, priv]) => {
      if (!data) return
      const rates = {}, profiles = {}
      for (const s of data) {
        rates[s.id] = payRates.get(s.id) ?? 0
        profiles[s.id] = { contractedHours: priv.get(s.id)?.contracted_hours ?? null, workingDays: s.working_days ?? [] }
      }
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
    // resolveShiftInstants rolls the clock-out onto the next date when the shift
    // ran past midnight (an 18:00–02:00 close). Pinning both to dateStr stored
    // clock_out *before* clock_in, and every consumer clamps a negative duration
    // to zero via Math.max(0, …) — so editing a late shift at all silently
    // turned it into zero hours worked.
    const { inAt, outAt } = resolveShiftInstants(dateStr, clockIn, clockOut)
    const newIn  = inAt.toISOString()
    const newOut = outAt.toISOString()
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
      if (t.totalMinutes <= 0 && parseFloat(holPay) <= 0) return null  // nothing to pay
      return [t.name, `${hrs} hrs`, rate > 0 ? `£${rate}/hr` : '—', worked > 0 ? `£${worked}` : '—', holPay > 0 ? `£${holPay}` : '—', `£${(parseFloat(worked) + parseFloat(holPay)).toFixed(2)}`]
    }).filter(Boolean)
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
      if (t.totalMinutes <= 0 && parseFloat(holPay) <= 0) return null  // nothing to pay
      return [t.name, hrs, rate, worked, holPay, (parseFloat(worked) + parseFloat(holPay)).toFixed(2)].map(esc).join(',')
    }).filter(Boolean)
    downloadCsv([header, ...dataRows, ['TOTAL', (totalMins / 60).toFixed(2), '', totalWage.toFixed(2), totalHolidayPay.toFixed(2), (totalWage + totalHolidayPay).toFixed(2)].map(esc).join(',')].join('\n'), `payroll-${periodFrom}-to-${periodTo}.csv`)
  }

  // Actual wage bill includes holiday pay, so compare that against the rota's cost
  const actualBill = totalWage + totalHolidayPay
  const variance   = totalWage > 0 && periodScheduled.totalCost > 0 ? periodScheduled.totalCost - actualBill : null
  const [showOther, setShowOther] = useState(false)
  const isOtherPeriod = OTHER_PERIODS.some(p => p.key === period)

  return (
    <div className="flex flex-col gap-4 max-w-3xl text-ink dark:text-white">
      {isManager && <ClockEditApprovalCard />}

      {/* Header */}
      <div className="flex flex-col gap-1">
        {/* On mobile the shell's back row already links to Team */}
        <Link
          to={`/v/${venueSlug}/team`}
          className="hidden self-start lg:inline-flex items-center gap-1 text-[15px] font-semibold text-brand dark:text-white/80 hover:opacity-75 transition-opacity"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Team
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl min-[420px]:text-[26px] sm:text-[32px] leading-tight font-bold tracking-tight">Timesheets</h1>
            <p className="text-[15px] text-ink3 dark:text-white/45 mt-0.5">Hours worked and wage bill</p>
          </div>
          <div className="shrink-0 flex gap-2 mt-1">
            {[['CSV', exportCsv], ['PDF', exportPdf]].map(([fmt, fn]) => (
              <button
                key={fmt}
                type="button"
                onClick={fn}
                disabled={loading || (totalMins <= 0 && totalHolidayPay <= 0)}
                className="h-11 px-4 rounded-xl bg-white dark:bg-paperDark border border-line dark:border-white/10 text-[15px] font-semibold text-ink2 dark:text-white/80 hover:border-ink4 transition-colors disabled:opacity-40"
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Period */}
      <TabBar
        tabs={PERIOD_TABS}
        active={isOtherPeriod ? null : period}
        onChange={(id) => { setPeriod(id); setShowOther(false) }}
      />
      <div className="flex flex-col gap-2 -mt-1">
        <button
          type="button"
          aria-expanded={showOther || isOtherPeriod}
          onClick={() => setShowOther(v => !v)}
          className="self-start px-1 text-sm font-semibold text-ink3 dark:text-white/50 hover:text-ink dark:hover:text-white"
        >
          {isOtherPeriod ? `Showing ${OTHER_PERIODS.find(p => p.key === period).label.toLowerCase()}` : 'Other dates'} ▾
        </button>
        {(showOther || isOtherPeriod) && (
          <div className="flex flex-wrap items-center gap-2">
            {OTHER_PERIODS.map(p => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={`h-10 px-4 rounded-full border text-sm font-semibold transition-colors ${period === p.key ? 'bg-brand border-brand text-white' : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4'}`}
              >
                {p.label}
              </button>
            ))}
            {period === 'custom' && (
              <span className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" aria-label="From" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="flex-1 h-10 px-3 rounded-xl border border-line dark:border-white/10 bg-white dark:bg-paperDark text-sm" />
                <span className="text-sm text-ink3">to</span>
                <input type="date" aria-label="To" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} className="flex-1 h-10 px-3 rounded-xl border border-line dark:border-white/10 bg-white dark:bg-paperDark text-sm" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line dark:border-white/10">
          <p className="font-mono text-[15px] min-[420px]:text-[17px] font-semibold text-ink dark:text-white whitespace-nowrap">{periodLabel}</p>
          {isManager && periodFrom && periodTo && (
            <button
              type="button"
              onClick={togglePayrollLock}
              disabled={lockSaving}
              className={`shrink-0 inline-flex items-center gap-2 h-11 px-3 min-[420px]:px-4 rounded-xl border text-sm min-[420px]:text-[15px] font-semibold transition-colors disabled:opacity-40 ${isPeriodLocked ? 'border-good/40 bg-goodBg text-good dark:bg-good/20 dark:text-[#7fd1a4]' : 'border-line dark:border-white/10 bg-white dark:bg-paperDark text-ink2 dark:text-white/80 hover:border-ink4'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d={isPeriodLocked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1'}/></svg>
              {isPeriodLocked ? 'Locked for payroll' : lockSaving ? 'Locking…' : 'Lock for payroll'}
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonList rows={2} />
        ) : loadError ? (
          <div className="flex items-center gap-3 bg-badBg dark:bg-bad/20 px-4 sm:px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-bad dark:text-[#f19a86]">Couldn't load hours</p>
              <p className="text-sm text-ink2 dark:text-white/70 mt-0.5">The clock-in data failed to load — this can happen on an out-of-date app. Try again, or fully close and reopen the app.</p>
            </div>
            <button type="button" onClick={reload} className="shrink-0 h-10 px-4 rounded-xl bg-white dark:bg-paperDark border border-line dark:border-white/10 text-sm font-semibold">Retry</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 divide-x divide-line dark:divide-white/10 border-b border-line dark:border-white/10">
              <SumCell label="Actual hours" value={totalMins > 0 ? hm(totalMins) : '–'} />
              <SumCell label="Scheduled hours" value={periodScheduled.totalMins > 0 ? hm(periodScheduled.totalMins) : '–'} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-line dark:divide-white/10">
              <SumCell label="Actual wage bill" value={totalWage > 0 ? money(actualBill) : '–'} />
              <SumCell label="Scheduled cost" value={periodScheduled.totalCost > 0 ? money(periodScheduled.totalCost) : '–'} />
            </div>
            {variance !== null && Math.abs(variance) >= 0.01 && (
              <p className={`px-4 sm:px-5 py-3 text-[15px] font-semibold ${variance > 0 ? 'bg-goodBg text-good dark:bg-good/20 dark:text-[#7fd1a4]' : 'bg-badBg text-bad dark:bg-bad/20 dark:text-[#f19a86]'}`}>
                {money(Math.abs(variance))} {variance > 0 ? 'under' : 'over'} scheduled cost
              </p>
            )}
          </>
        )}
      </div>

      {/* Staff list */}
      {!loading && !loadError && (
        <>
          <div className="flex items-baseline justify-between gap-3 px-1 -mb-1">
            <p className="text-[13px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Staff</p>
            <p className="font-mono text-[13px] text-ink3 dark:text-white/45">
              {timesheets.length} staff{totalMins > 0 ? ` · ${hm(totalMins)}` : ''}
            </p>
          </div>
          {timesheets.length === 0 ? (
            <div className={`${CARD} px-5 py-8 text-center`}>
              <p className="text-[17px] font-semibold text-ink dark:text-white">No hours recorded</p>
              <p className="text-sm text-ink3 dark:text-white/45 mt-1">Nobody clocked in during this period.</p>
            </div>
          ) : (
            <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
              {timesheets.map(t => (
                <StaffRow key={t.staffId} t={t} onTap={() => setSelStaff(t)} />
              ))}
            </div>
          )}
        </>
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
