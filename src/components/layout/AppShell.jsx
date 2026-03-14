import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { supabase } from '../../lib/supabase'
import NotificationBell from '../notifications/NotificationBell'

function useOverdueCleaning() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const load = async () => {
      const { data: tasks } = await supabase
        .from('cleaning_tasks').select('id, frequency').eq('is_active', true)
      if (!tasks?.length) return
      const { data: completions } = await supabase
        .from('cleaning_completions').select('cleaning_task_id, completed_at')
        .order('completed_at', { ascending: false })
      const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
      const now = new Date()
      let overdue = 0
      for (const t of tasks) {
        const last = completions?.find(c => c.cleaning_task_id === t.id)
        if (!last) { overdue++; continue }
        if ((now - new Date(last.completed_at)) / 86400000 > freqDays[t.frequency]) overdue++
      }
      setCount(overdue)
    }
    load()
  }, [])
  return count
}

function usePendingSwaps() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    supabase.from('shift_swaps').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count: c }) => setCount(c ?? 0))
  }, [])
  return count
}

export default function AppShell({ children }) {
  const { session, isManager } = useSession()
  const location     = useLocation()
  const overdueCount = useOverdueCleaning()
  const pendingSwaps = usePendingSwaps()

  const name = session?.staffName ?? ''

  const handleSignOut = () => {
    const token = session?.token
    if (token) {
      supabase.rpc('invalidate_staff_session', { p_token: token }).catch(() => {})
    }
    localStorage.clear()
    window.location.replace('/')
  }

  // ── Nav links ────────────────────────────────────────────────────────────
  const managerLinks = [
    { to: '/dashboard', label: 'DASHBOARD' },
    { to: '/fridge',    label: 'TEMP LOGS' },
    { to: '/allergens', label: 'ALLERGENS' },
    { to: '/cleaning',  label: overdueCount > 0 ? `CLEANING (${overdueCount})` : 'CLEANING', alert: overdueCount > 0 },
    { to: '/tasks',     label: 'TASKS' },
    { to: '/timesheet', label: 'HOURS' },
    { to: '/rota',      label: pendingSwaps > 0 ? `ROTA (${pendingSwaps})` : 'ROTA', alert: pendingSwaps > 0 },
    { to: '/settings',  label: 'SETTINGS' },
  ]

  const staffLinks = [
    { to: '/dashboard', label: 'MY SHIFT' },
    { to: '/tasks',     label: 'TASKS' },
    ...(session?.showTempLogs  ? [{ to: '/fridge',    label: 'TEMP LOGS' }] : []),
    ...(session?.showAllergens ? [{ to: '/allergens', label: 'ALLERGENS' }] : []),
    { to: '/rota',      label: 'ROTA' },
  ]

  const links    = isManager ? managerLinks : staffLinks
  const bgClass  = isManager ? 'bg-cream'   : 'bg-staffbg'
  const maxW     = isManager ? 'max-w-[900px]' : 'max-w-[560px]'

  return (
    <div className={`min-h-dvh ${bgClass} font-sans flex flex-col`}>

      {/* Header */}
      <header className="bg-charcoal shrink-0">
        <div className={`${maxW} mx-auto px-4 sm:px-8 h-12 flex items-center justify-between gap-2`}>
          {/* Left: logo + role badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-serif text-cream text-lg tracking-tight shrink-0">SafeServ</span>
            <span className="hidden xs:inline-block text-[10px] uppercase tracking-widest text-cream/40 border border-cream/20 px-1.5 py-0.5 rounded shrink-0">
              {session?.staffRole === 'owner' ? 'OWNER' : isManager ? 'MANAGER' : 'STAFF'}
            </span>
          </div>
          {/* Right: bell + name (hidden on small) + sign out */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <span className="hidden sm:block text-xs text-cream/60 font-medium max-w-[120px] truncate">{name}</span>
            <button
              onClick={handleSignOut}
              className="text-[11px] tracking-widest uppercase text-cream/50 border border-cream/20 px-2 py-1 rounded hover:text-cream hover:border-cream/50 transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="bg-white border-b border-charcoal/10 shrink-0">
        <div className={`${maxW} mx-auto px-5 sm:px-8 flex overflow-x-auto`}>
          {links.map(l => {
            const isActive = location.pathname.startsWith(l.to)
            return (
              <NavLink
                key={l.to} to={l.to}
                className={[
                  'px-4 py-3.5 text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'text-charcoal border-accent'
                    : l.alert
                      ? 'text-warning border-transparent hover:text-warning/80'
                      : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
                ].join(' ')}
              >
                {l.label}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Page content */}
      <main className={`flex-1 ${maxW} mx-auto w-full px-5 sm:px-8 py-8`}>
        {children}
      </main>
    </div>
  )
}
