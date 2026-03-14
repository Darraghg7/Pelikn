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

export default function ManagerDashboardPage() {
  const [tempCount, setTempCount] = useState({ total: 0, fail: 0 })
  const { overdueCount } = useCleaningTasks()

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
    </div>
  )
}
