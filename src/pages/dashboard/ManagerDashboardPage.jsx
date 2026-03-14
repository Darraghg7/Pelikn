import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTasksForRole } from '../../hooks/useTasks'
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

function RoleTaskCard({ title, tasks, completions }) {
  const done = completions.filter(c => tasks.some(t => t.id === c.task_template_id)).length
  return (
    <Link to="/tasks" className="bg-white rounded-xl border border-charcoal/10 p-5 hover:border-charcoal/25 hover:shadow-sm transition-all block">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-charcoal">{title}</p>
        <p className="text-xs text-charcoal/40">{done}/{tasks.length} done</p>
      </div>
      <div className="h-1.5 bg-charcoal/8 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-success rounded-full transition-all"
          style={{ width: tasks.length > 0 ? `${(done / tasks.length) * 100}%` : '0%' }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {tasks.slice(0, 5).map(t => {
          const comp = completions.find(c => c.task_template_id === t.id)
          return (
            <div key={t.id} className="flex items-center justify-between">
              <p className={`text-sm ${comp ? 'line-through text-charcoal/30' : 'text-charcoal'}`}>{t.title}</p>
              {comp && <span className="text-xs text-charcoal/30">{comp.completed_by_name}</span>}
            </div>
          )
        })}
        {tasks.length === 0 && <p className="text-xs text-charcoal/30 italic">No tasks set up yet.</p>}
      </div>
      <p className="text-[10px] tracking-widest uppercase text-charcoal/25 mt-4">Manage Tasks →</p>
    </Link>
  )
}

export default function ManagerDashboardPage() {
  const [tempCount, setTempCount] = useState({ total: 0, fail: 0 })
  const { overdueCount } = useCleaningTasks()
  const { templates: kitchenTasks, completions: kitchenComp } = useTasksForRole('kitchen')
  const { templates: fohTasks,     completions: fohComp }     = useTasksForRole('foh')

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Temp Checks"
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
        <StatCard
          label="Kitchen Tasks"
          value={`${kitchenComp.filter(c => kitchenTasks.some(t => t.id === c.task_template_id)).length}/${kitchenTasks.length}`}
          sub="completed today"
          to="/tasks"
        />
        <StatCard
          label="FOH Tasks"
          value={`${fohComp.filter(c => fohTasks.some(t => t.id === c.task_template_id)).length}/${fohTasks.length}`}
          sub="completed today"
          to="/tasks"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RoleTaskCard title="Kitchen"        tasks={kitchenTasks} completions={kitchenComp} />
        <RoleTaskCard title="Front of House" tasks={fohTasks}     completions={fohComp}     />
      </div>
    </div>
  )
}
