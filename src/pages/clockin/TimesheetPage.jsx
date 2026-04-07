import React, { useState, useEffect } from 'react'
import { format, endOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTimesheetData } from '../../hooks/useClockEvents'
import { formatMinutes, getWeekStart, getWeekDays, downloadCsv } from '../../lib/utils'
import { buildPdfReport } from '../../lib/pdfUtils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function fmtGBP(n) { return `£${Number(n).toFixed(2)}` }

function buildTimesheets(events, staffRates) {
  const results = {}
  for (const e of events) {
    const sid = e.staff_id
    if (!results[sid]) results[sid] = {
      name: e.staff?.name ?? 'Unknown',
      hourlyRate: staffRates[sid] ?? 0,
      sessions: [],
      totalMinutes: 0,
    }
    const r = results[sid]
    if (e.event_type === 'clock_in')    r.sessions.push({ in: e.occurred_at, out: null, breaks: [] })
    if (e.event_type === 'clock_out'   && r.sessions.length) r.sessions.at(-1).out = e.occurred_at
    if (e.event_type === 'break_start' && r.sessions.length) r.sessions.at(-1).breaks.push({ start: e.occurred_at, end: null })
    if (e.event_type === 'break_end'   && r.sessions.length) {
      const br = r.sessions.at(-1).breaks
      if (br.length && !br.at(-1).end) br.at(-1).end = e.occurred_at
    }
  }
  for (const r of Object.values(results)) {
    for (const s of r.sessions) {
      if (!s.in || !s.out) continue
      const worked = (new Date(s.out) - new Date(s.in)) / 60000
      const breaks = s.breaks.reduce((acc, b) => {
        if (!b.start || !b.end) return acc
        return acc + (new Date(b.end) - new Date(b.start)) / 60000
      }, 0)
      r.totalMinutes += Math.max(0, worked - breaks)
    }
  }
  return Object.values(results).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Groups clock events into per-staff, per-day minute totals.
 * Returns sorted array of { name, days: { 'yyyy-MM-dd': minutes } }.
 */
function buildDailyGrid(events) {
  const grid = {}
  for (const e of events) {
    const sid = e.staff_id
    if (!grid[sid]) grid[sid] = { name: e.staff?.name ?? 'Unknown', sessions: [] }
    const r = grid[sid]
    if (e.event_type === 'clock_in')
      r.sessions.push({ in: e.occurred_at, out: null, breaks: [], date: e.occurred_at.slice(0, 10) })
    if (e.event_type === 'clock_out'   && r.sessions.length) r.sessions.at(-1).out = e.occurred_at
    if (e.event_type === 'break_start' && r.sessions.length) r.sessions.at(-1).breaks.push({ start: e.occurred_at, end: null })
    if (e.event_type === 'break_end'   && r.sessions.length) {
      const br = r.sessions.at(-1).breaks
      if (br.length && !br.at(-1).end) br.at(-1).end = e.occurred_at
    }
  }
  const result = {}
  for (const [sid, r] of Object.entries(grid)) {
    result[sid] = { name: r.name, days: {} }
    for (const s of r.sessions) {
      if (!s.in || !s.out) continue
      const worked = (new Date(s.out) - new Date(s.in)) / 60000
      const brk = s.breaks.reduce((acc, b) =>
        (!b.start || !b.end) ? acc : acc + (new Date(b.end) - new Date(b.start)) / 60000, 0)
      const mins = Math.max(0, worked - brk)
      result[sid].days[s.date] = (result[sid].days[s.date] ?? 0) + mins
    }
  }
  return Object.values(result).sort((a, b) => a.name.localeCompare(b.name))
}

const PERIODS = [
  { key: 'this_week',  label: 'This Week' },
  { key: 'last_week',  label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom',     label: 'Custom' },
]

function periodToDates(period, customFrom, customTo) {
  const now = new Date()
  const thisWeekStart = getWeekStart(now)
  const thisWeekEnd   = endOfWeek(thisWeekStart, { weekStartsOn: 1 })

  if (period === 'this_week') return {
    dateFrom: thisWeekStart.toISOString(),
    dateTo:   thisWeekEnd.toISOString(),
    label: `${format(thisWeekStart, 'd MMM')} – ${format(thisWeekEnd, 'd MMM yyyy')}`,
  }
  if (period === 'last_week') {
    const start = addWeeks(thisWeekStart, -1)
    const end   = endOfWeek(start, { weekStartsOn: 1 })
    return {
      dateFrom: start.toISOString(),
      dateTo:   end.toISOString(),
      label: `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`,
    }
  }
  if (period === 'this_month') {
    const start = startOfMonth(now)
    const end   = endOfMonth(now)
    return {
      dateFrom: start.toISOString(),
      dateTo:   end.toISOString(),
      label: format(now, 'MMMM yyyy'),
    }
  }
  if (period === 'last_month') {
    const last  = subMonths(now, 1)
    const start = startOfMonth(last)
    const end   = endOfMonth(last)
    return {
      dateFrom: start.toISOString(),
      dateTo:   end.toISOString(),
      label: format(last, 'MMMM yyyy'),
    }
  }
  // custom
  if (customFrom && customTo) {
    const start = parseISO(customFrom)
    const end   = parseISO(customTo)
    return {
      dateFrom: start.toISOString(),
      dateTo:   new Date(end.getTime() + 86399999).toISOString(), // end of day
      label: `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`,
    }
  }
  return { dateFrom: '', dateTo: '', label: '—' }
}

export default function TimesheetPage() {
  const [period,     setPeriod]     = useState('this_week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [staffRates, setStaffRates] = useState({})
  const [weekOffset, setWeekOffset] = useState(0)

  const { dateFrom, dateTo, label: periodLabel } = periodToDates(period, customFrom, customTo)

  const { rows, loading, reload } = useTimesheetData(dateFrom, dateTo)

  // Weekly grid — independent week navigation
  const gridWeekStart = addWeeks(getWeekStart(new Date()), weekOffset)
  const gridWeekEnd   = addDays(gridWeekStart, 6)
  const gridDays      = getWeekDays(gridWeekStart)
  const gridDateFrom  = gridWeekStart.toISOString()
  const gridDateTo    = new Date(gridWeekEnd.getTime() + 86399999).toISOString()
  const { rows: gridRows, loading: gridLoading, reload: gridReload } = useTimesheetData(gridDateFrom, gridDateTo)

  useEffect(() => {
    supabase
      .from('staff')
      .select('id, hourly_rate')
      .then(({ data }) => {
        if (data) setStaffRates(Object.fromEntries(data.map((s) => [s.id, s.hourly_rate ?? 0])))
      })
  }, [])

  useEffect(() => { reload() }, [reload])
  useEffect(() => { gridReload() }, [gridReload])

  const timesheets = buildTimesheets(rows, staffRates)
  const dailyGrid  = buildDailyGrid(gridRows)
  const totalMins  = timesheets.reduce((a, t) => a + t.totalMinutes, 0)
  const totalWage  = timesheets.reduce((a, t) => a + (t.totalMinutes / 60) * t.hourlyRate, 0)

  const exportPdf = () => {
    const pdfRows = timesheets.map((t) => {
      const hrs  = (t.totalMinutes / 60).toFixed(2)
      const rate = Number(t.hourlyRate).toFixed(2)
      const pay  = ((t.totalMinutes / 60) * t.hourlyRate).toFixed(2)
      return [t.name, `${hrs} hrs`, rate > 0 ? `£${rate}/hr` : '—', pay > 0 ? `£${pay}` : '—']
    })
    pdfRows.push([
      'TOTAL',
      `${(totalMins / 60).toFixed(2)} hrs`,
      '',
      totalWage > 0 ? `£${totalWage.toFixed(2)}` : '—',
    ])
    buildPdfReport({
      title: 'SafeServ',
      subtitle: 'Timesheet Report',
      periodLabel,
      columns: ['Staff Member', 'Hours Worked', 'Hourly Rate', 'Est. Pay'],
      rows: pdfRows,
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.row.index === pdfRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.fillColor = [240, 240, 240]
        }
      },
      filename: `timesheet-${dateFrom.slice(0, 10)}.pdf`,
    })
  }

  const exportCsv = () => {
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`
    const header = ['Name', 'Hours Worked', 'Hourly Rate (£)', 'Gross Pay (£)'].map(escape).join(',')
    const dataRows = timesheets.map((t) => {
      const hrs  = (t.totalMinutes / 60).toFixed(2)
      const rate = Number(t.hourlyRate).toFixed(2)
      const pay  = ((t.totalMinutes / 60) * t.hourlyRate).toFixed(2)
      return [t.name, hrs, rate, pay].map(escape).join(',')
    })
    const totalRow = [
      'TOTAL',
      (totalMins / 60).toFixed(2),
      '',
      totalWage.toFixed(2),
    ].map(escape).join(',')

    const csv = [header, ...dataRows, totalRow].join('\n')
    downloadCsv(csv, `payroll-${dateFrom.slice(0, 10)}-to-${dateTo.slice(0, 10)}.csv`)
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-brand">Timesheets</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={exportCsv}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            ↓ Export CSV
          </button>
          <button
            onClick={exportPdf}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            ↓ Export PDF
          </button>
        </div>
      </div>

      {/* Pay period card */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <SectionLabel>Pay Period Summary</SectionLabel>

        {/* Period selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                period === p.key
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
            <span className="text-xs text-charcoal/40">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
        )}

        {/* Period label */}
        {periodLabel && periodLabel !== '—' && (
          <p className="text-sm font-medium text-charcoal mb-4">{periodLabel}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : timesheets.length === 0 ? (
          <p className="text-sm text-charcoal/35 italic py-4">No clock events recorded for this period.</p>
        ) : (
          <>
            {/* Totals */}
            <div className="mb-4 pb-4 border-b border-charcoal/8 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-charcoal/40 mb-0.5">Total hours · {timesheets.length} staff</p>
                <p className="font-serif text-3xl text-charcoal">{formatMinutes(Math.round(totalMins))}</p>
              </div>
              {totalWage > 0 && (
                <div>
                  <p className="text-xs text-charcoal/40 mb-0.5">Estimated wage bill</p>
                  <p className="font-serif text-3xl text-charcoal font-mono">{fmtGBP(totalWage)}</p>
                </div>
              )}
            </div>

            {/* Per-staff table */}
            <div className="flex flex-col gap-0">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 pb-2 text-[11px] tracking-widest uppercase text-charcoal/40">
                <span>Staff</span>
                <span className="text-right">Hours</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Est. Pay</span>
              </div>
              {timesheets.map((t) => {
                const pay = (t.totalMinutes / 60) * t.hourlyRate
                return (
                  <div key={t.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-3 border-t border-charcoal/5 items-center">
                    <span className="text-sm font-medium text-charcoal truncate">{t.name}</span>
                    <span className="text-right font-mono text-sm font-semibold text-charcoal whitespace-nowrap">
                      {formatMinutes(Math.round(t.totalMinutes))}
                    </span>
                    <span className="text-right font-mono text-xs text-charcoal/40 whitespace-nowrap">
                      {t.hourlyRate > 0 ? `£${Number(t.hourlyRate).toFixed(2)}/hr` : '—'}
                    </span>
                    <div className="text-right whitespace-nowrap">
                      {pay > 0 ? (
                        <span className="font-mono text-sm text-charcoal">{fmtGBP(pay)}</span>
                      ) : (
                        <span className="text-xs text-charcoal/25">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Weekly Hours Grid ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">

        {/* Header + week navigation */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <SectionLabel>Hours by Day</SectionLabel>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="w-7 h-7 rounded-lg border border-charcoal/15 flex items-center justify-center text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal transition-colors text-sm"
            >
              ←
            </button>
            <span className="text-xs font-medium text-charcoal min-w-[150px] text-center">
              {format(gridWeekStart, 'd MMM')} – {format(gridWeekEnd, 'd MMM yyyy')}
            </span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              className="w-7 h-7 rounded-lg border border-charcoal/15 flex items-center justify-center text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal transition-colors text-sm disabled:opacity-25 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>

        {gridLoading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : dailyGrid.length === 0 ? (
          <p className="text-sm text-charcoal/35 italic py-4">No clock events recorded this week.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[540px]">
              <thead>
                <tr>
                  <th className="text-left pb-3 pr-4 text-[11px] tracking-widest uppercase text-charcoal/40 font-semibold whitespace-nowrap">
                    Staff
                  </th>
                  {gridDays.map(d => (
                    <th key={d.toISOString()} className="pb-3 px-2 text-center min-w-[60px]">
                      <span className="block text-[11px] tracking-widest uppercase text-charcoal/40 font-semibold">
                        {format(d, 'EEE')}
                      </span>
                      <span className="block text-xs text-charcoal/30 font-normal">{format(d, 'd')}</span>
                    </th>
                  ))}
                  <th className="pb-3 pl-4 text-right text-[11px] tracking-widest uppercase text-charcoal/40 font-semibold whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyGrid.map(person => {
                  const total = Object.values(person.days).reduce((a, m) => a + m, 0)
                  return (
                    <tr key={person.name} className="border-t border-charcoal/5">
                      <td className="py-3 pr-4 text-sm font-medium text-charcoal whitespace-nowrap">{person.name}</td>
                      {gridDays.map(d => {
                        const dateStr = format(d, 'yyyy-MM-dd')
                        const mins = person.days[dateStr] ?? 0
                        return (
                          <td key={dateStr} className="py-3 px-2 text-center">
                            {mins > 0 ? (
                              <span className="text-xs font-mono font-semibold text-charcoal">
                                {formatMinutes(Math.round(mins))}
                              </span>
                            ) : (
                              <span className="text-charcoal/15 text-sm">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="py-3 pl-4 text-right font-mono text-sm font-semibold text-charcoal whitespace-nowrap">
                        {total > 0 ? formatMinutes(Math.round(total)) : <span className="text-charcoal/25">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
