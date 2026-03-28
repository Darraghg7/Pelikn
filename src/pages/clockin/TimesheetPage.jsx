import React, { useState, useEffect } from 'react'
import { format, endOfWeek, addWeeks } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTimesheetData } from '../../hooks/useClockEvents'
import { formatMinutes, getWeekStart } from '../../lib/utils'
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

export default function TimesheetPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [staffRates, setStaffRates] = useState({})

  const dateFrom = weekStart.toISOString()
  const dateTo   = endOfWeek(weekStart, { weekStartsOn: 1 }).toISOString()

  const { rows, loading, reload } = useTimesheetData(null, dateFrom, dateTo)

  // Load hourly rates once
  useEffect(() => {
    supabase
      .from('staff')
      .select('id, hourly_rate')
      .then(({ data }) => {
        if (data) setStaffRates(Object.fromEntries(data.map((s) => [s.id, s.hourly_rate ?? 0])))
      })
  }, [])

  useEffect(() => { reload() }, [reload])

  const timesheets = buildTimesheets(rows, staffRates)
  const weekEnd    = endOfWeek(weekStart, { weekStartsOn: 1 })
  const totalMins  = timesheets.reduce((a, t) => a + t.totalMinutes, 0)
  const totalWage  = timesheets.reduce((a, t) => a + (t.totalMinutes / 60) * t.hourlyRate, 0)

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -1))
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1))

  const exportPdf = () => {
    const rows = timesheets.map((t) => {
      const hrs = (t.totalMinutes / 60).toFixed(2)
      const rate = Number(t.hourlyRate).toFixed(2)
      const pay = ((t.totalMinutes / 60) * t.hourlyRate).toFixed(2)
      return [t.name, `${hrs} hrs`, rate > 0 ? `£${rate}/hr` : '—', pay > 0 ? `£${pay}` : '—']
    })

    // Totals row
    rows.push([
      'TOTAL',
      `${(totalMins / 60).toFixed(2)} hrs`,
      '',
      totalWage > 0 ? `£${totalWage.toFixed(2)}` : '—',
    ])

    buildPdfReport({
      title: 'SafeServ',
      subtitle: 'Timesheet Report',
      periodLabel: `${format(weekStart, 'd MMM yyyy')} – ${format(weekEnd, 'd MMM yyyy')}`,
      columns: ['Staff Member', 'Hours Worked', 'Hourly Rate', 'Est. Pay'],
      rows,
      didParseCell(hookData) {
        // Bold the totals row
        if (hookData.section === 'body' && hookData.row.index === rows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.fillColor = [240, 240, 240]
        }
      },
      filename: `timesheet-${format(weekStart, 'yyyy-MM-dd')}.pdf`,
    })
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-brand">Timesheets</h1>
        <button
          onClick={exportPdf}
          className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
        >
          ↓ Export PDF
        </button>
      </div>

      {/* Week summary card */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <SectionLabel>Weekly Summary</SectionLabel>

        {/* Week nav */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
          <span className="text-sm font-medium text-charcoal">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
          </span>
          <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : timesheets.length === 0 ? (
          <p className="text-sm text-charcoal/35 italic py-4">No clock events recorded this week.</p>
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
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-2 text-[11px] tracking-widest uppercase text-charcoal/40">
                <span>Staff</span>
                <span className="text-right">Hours</span>
                <span className="text-right">Est. Pay</span>
              </div>
              {timesheets.map((t) => {
                const pay = (t.totalMinutes / 60) * t.hourlyRate
                return (
                  <div key={t.name} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-3 border-t border-charcoal/5 items-center">
                    <span className="text-sm font-medium text-charcoal truncate">{t.name}</span>
                    <span className="text-right font-mono text-sm font-semibold text-charcoal whitespace-nowrap">
                      {formatMinutes(Math.round(t.totalMinutes))}
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
    </div>
  )
}
