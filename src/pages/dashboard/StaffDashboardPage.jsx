import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useTasksForRole } from '../../hooks/useTasks'
import { formatMinutes } from '../../lib/utils'
import ClockPanel from '../../components/ClockPanel'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

export default function StaffDashboardPage() {
  const { session } = useSession()
  const [todayShift, setTodayShift] = useState(null)
  const [weekMins, setWeekMins]     = useState(0)
  const [loading, setLoading]       = useState(true)

  const { templates, oneOffs, completions } = useTasksForRole(session?.jobRole ?? 'kitchen')
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!session?.staffId) return
    const load = async () => {
      setLoading(true)
      const weekStart = format(
        new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)),
        'yyyy-MM-dd'
      )
      const [shiftRes, weekRes] = await Promise.all([
        supabase.from('shifts').select('*')
          .eq('staff_id', session.staffId).eq('shift_date', today)
          .order('start_time').limit(1),
        supabase.from('clock_events').select('*')
          .eq('staff_id', session.staffId).gte('occurred_at', weekStart),
      ])
      setTodayShift(shiftRes.data?.[0] ?? null)
      const events = [...(weekRes.data ?? [])].sort(
        (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
      )
      let mins = 0, lastIn = null
      for (const e of events) {
        if (e.event_type === 'clock_in') lastIn = new Date(e.occurred_at)
        if (e.event_type === 'clock_out' && lastIn) {
          mins += (new Date(e.occurred_at) - lastIn) / 60000
          lastIn = null
        }
      }
      setWeekMins(Math.round(mins))
      setLoading(false)
    }
    load()
  }, [session?.staffId, today])

  if (!session) return null
  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'
  const firstName = session.staffName?.split(' ')[0] ?? ''
  const myTasks   = [...templates, ...oneOffs]
  const myDone    = completions.filter(c =>
    templates.some(t => t.id === c.task_template_id) || oneOffs.some(o => o.id === c.task_one_off_id)
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-charcoal/40 mb-1">{format(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="font-serif text-3xl text-charcoal">Good {greeting}, {firstName}</h1>
      </div>

      <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
        <SectionLabel>Today's Shift</SectionLabel>
        {todayShift ? (
          <div>
            <p className="font-serif text-2xl text-charcoal">{todayShift.start_time.slice(0,5)}–{todayShift.end_time.slice(0,5)}</p>
            <p className="text-sm text-charcoal/50 mt-0.5">{todayShift.role_label}</p>
          </div>
        ) : (
          <p className="text-sm text-charcoal/40 italic">No shift scheduled today</p>
        )}
        <div className="border-t border-charcoal/8 pt-4">
          <ClockPanel staffId={session.staffId} hasShift={!!todayShift} />
        </div>
        <Link to="/rota" className="text-center text-xs text-charcoal/40 hover:text-charcoal transition-colors">View Rota →</Link>
      </div>

      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Today's Tasks</SectionLabel>
          <Link to="/tasks" className="text-[10px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors">See All</Link>
        </div>
        <div className="h-1.5 bg-charcoal/8 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-success rounded-full transition-all" style={{ width: myTasks.length > 0 ? `${(myDone/myTasks.length)*100}%` : '0%' }} />
        </div>
        <div className="flex flex-col gap-2">
          {myTasks.slice(0,5).map(t => {
            const comp = completions.find(c => (c.task_template_id && c.task_template_id === t.id) || (c.task_one_off_id && c.task_one_off_id === t.id))
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${comp ? 'bg-success border-success text-white' : 'border-charcoal/20'}`}>{comp ? '✓' : ''}</span>
                <p className={`text-sm ${comp ? 'line-through text-charcoal/30' : 'text-charcoal'}`}>{t.title}</p>
              </div>
            )
          })}
          {myTasks.length === 0 && <p className="text-sm text-charcoal/35 italic">No tasks assigned today.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <SectionLabel>Hours This Week</SectionLabel>
        <p className="font-serif text-3xl text-charcoal">{formatMinutes(weekMins)}</p>
        <p className="text-xs text-charcoal/40 mt-1">{weekMins > 0 ? `${(weekMins/60).toFixed(1)} hours logged` : 'No hours logged yet this week'}</p>
      </div>
    </div>
  )
}
