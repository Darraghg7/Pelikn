import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'

function StatCard({ label, value, sub, alert, to }) {
  const inner = (
    <>
      <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">{label}</p>
      <p className={`font-serif text-3xl ${alert ? 'text-danger' : 'text-charcoal'}`}>{value}</p>
      {sub && <p className="text-xs text-charcoal/40 mt-1">{sub}</p>}
      {to && <p className="text-[10px] tracking-widest uppercase text-charcoal/25 mt-3">View →</p>}
    </>
  )
  if (to) {
    return (
      <Link to={to} className="bg-white rounded-xl border border-charcoal/10 p-5 hover:border-charcoal/25 hover:shadow-sm transition-all block">
        {inner}
      </Link>
    )
  }
  return <div className="bg-white rounded-xl border border-charcoal/10 p-5">{inner}</div>
}

const JOB_LABELS = { kitchen: 'Kitchen', foh: 'FOH' }

function useTodaysShifts() {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    supabase
      .from('shifts')
      .select('id, start_time, end_time, role_label, staff:staff_id(id, name, job_role)')
      .eq('shift_date', today)
      .order('start_time')
      .then(({ data }) => {
        setShifts(data ?? [])
        setLoading(false)
      })
  }, [])

  return { shifts, loading }
}

export default function ManagerDashboardPage() {
  const [tempCount, setTempCount] = useState({ total: 0, fail: 0 })
  const { overdueCount } = useCleaningTasks()
  const { shifts, loading: shiftsLoading } = useTodaysShifts()

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    supabase
      .from('fridge_temperature_logs')
      .select('id, temperature, fridge:fridge_id(min_temp, max_temp)')
      .gte('logged_at', today)
      .then(({ data }) => {
        const total = data?.length ?? 0
        const fail  = data?.filter(l => l.fridge && (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp)).length ?? 0
        setTempCount({ total, fail })
      })
  }, [])

  const now = format(new Date(), 'HH:mm')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-charcoal/40 mb-1">{format(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="font-serif text-3xl text-charcoal">Manager Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Temp Checks Today"
          value={tempCount.total}
          sub={`${tempCount.total - tempCount.fail} pass · ${tempCount.fail} fail`}
          alert={tempCount.fail > 0}
          to="/fridge"
        />
        <StatCard
          label="Cleaning Overdue"
          value={overdueCount}
          sub={overdueCount > 0 ? 'Needs attention' : 'All on track'}
          alert={overdueCount > 0}
          to="/cleaning"
        />
      </div>

      {/* Today's Staff */}
      <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40">On Shift Today</p>
          <Link to="/rota" className="text-[10px] tracking-widest uppercase text-charcoal/30 hover:text-charcoal transition-colors">
            View Rota →
          </Link>
        </div>

        {shiftsLoading ? (
          <p className="text-sm text-charcoal/35 italic px-5 pb-5">Loading…</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-charcoal/35 italic px-5 pb-5">No shifts scheduled today.</p>
        ) : (
          <div className="divide-y divide-charcoal/6">
            {shifts.map(s => {
              const start = s.start_time?.slice(0, 5) ?? ''
              const end   = s.end_time?.slice(0, 5)   ?? ''
              const active = now >= start && now <= end
              return (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-success' : now > end ? 'bg-charcoal/20' : 'bg-warning'}`} />
                  {/* Name + department */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{s.staff?.name ?? '—'}</p>
                    <p className="text-[11px] text-charcoal/40">
                      {JOB_LABELS[s.staff?.job_role] ?? s.staff?.job_role}
                      {s.role_label ? ` · ${s.role_label}` : ''}
                    </p>
                  </div>
                  {/* Shift time */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-charcoal">{start}–{end}</p>
                    <p className={`text-[10px] tracking-widest uppercase font-medium ${
                      active      ? 'text-success' :
                      now > end   ? 'text-charcoal/30' :
                                    'text-warning'
                    }`}>
                      {active ? 'On shift' : now > end ? 'Finished' : 'Upcoming'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
