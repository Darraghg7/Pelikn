import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { WIDGET_REGISTRY, DEFAULT_WIDGETS, ALL_WIDGET_IDS } from '../../components/widgets/WidgetRegistry'
import ClockPanel from '../../components/shifts/ClockPanel'
import Modal from '../../components/ui/Modal'
import { useVenueBranding } from '../../hooks/useVenueBranding'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'

// Multi-venue is just Pro × number of venues — no separate tier in the app
const PLAN_CONFIG = {
  starter: { label: 'Starter', bg: 'bg-success/8',   text: 'text-brand', border: 'border-success/30'  },
  pro:     { label: 'Pro',     bg: 'bg-accent/10', text: 'text-accent',   border: 'border-accent/25' },
}
function PlanBadge({ plan }) {
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.starter
  return (
    <span className={`text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function UpgradeButton() {
  return (
    <a
      href="mailto:hello@pelikn.app?subject=Upgrade to Pro"
      className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/30 transition-all hover:shadow-lg hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg, #c94f2a 0%, #e06535 50%, #c94f2a 100%)',
        backgroundSize: '200% 100%',
      }}
    >
      {/* Shimmer overlay */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-[shimmer_2.5s_ease-in-out_infinite]"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
      />
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 relative">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
      <span className="relative">Upgrade to Pro</span>
      <span className="relative font-normal opacity-75">· £25/mo</span>
    </a>
  )
}

/* ── Widget preferences hook ─────────────────────────────────────────────── */
function useWidgetPreferences(staffId, venueId) {
  const [widgetIds, setWidgetIds] = useState(null) // null = loading
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false

    supabase
      .from('dashboard_widgets')
      .select('widget_id, position')
      .eq('venue_id', venueId)
      .eq('staff_id', staffId)
      .order('position')
      .then(({ data }) => {
        if (cancelled) return
        setWidgetIds(data?.length > 0 ? data.map(d => d.widget_id) : DEFAULT_WIDGETS)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [staffId, venueId])

  const save = useCallback(async (newIds) => {
    if (!staffId || !venueId) return
    setWidgetIds(newIds)

    // Delete existing, insert new
    await supabase.from('dashboard_widgets').delete().eq('staff_id', staffId).eq('venue_id', venueId)
    if (newIds.length > 0) {
      const rows = newIds.map((id, i) => ({ staff_id: staffId, widget_id: id, position: i, venue_id: venueId }))
      await supabase.from('dashboard_widgets').insert(rows)
    }
  }, [staffId, venueId])

  return { widgetIds: widgetIds ?? DEFAULT_WIDGETS, loading, save }
}

/* ── Widget Picker Modal ─────────────────────────────────────────────────── */
function WidgetPicker({ open, onClose, activeIds, onSave }) {
  const [selected, setSelected] = useState([])

  useEffect(() => {
    if (open) setSelected([...activeIds])
  }, [open, activeIds])

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const moveUp = (id) => {
    setSelected(prev => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (id) => {
    setSelected(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Customise Dashboard">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-charcoal/50">
          Select and reorder the widgets you want on your dashboard.
        </p>

        {/* Active widgets — reorderable */}
        {selected.length > 0 && (
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Your widgets</p>
            <div className="flex flex-col gap-1.5">
              {selected.map((id, idx) => {
                const w = WIDGET_REGISTRY[id]
                if (!w) return null
                return (
                  <div key={id} className="flex items-center gap-2 bg-charcoal/4 rounded-xl px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(id)}
                        disabled={idx === 0}
                        className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-[11px] leading-none"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(id)}
                        disabled={idx === selected.length - 1}
                        className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-[11px] leading-none"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{w.label}</p>
                      <p className="text-[11px] text-charcoal/40 truncate">{w.description}</p>
                    </div>
                    <button
                      onClick={() => toggle(id)}
                      className="text-danger/50 hover:text-danger text-xs px-2 py-1 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Available widgets */}
        {(() => {
          const available = ALL_WIDGET_IDS.filter(id => !selected.includes(id))
          if (available.length === 0) return null
          return (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Available widgets</p>
              <div className="flex flex-col gap-1.5">
                {available.map(id => {
                  const w = WIDGET_REGISTRY[id]
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-charcoal/15 px-3 py-2.5 hover:border-charcoal/30 hover:bg-charcoal/3 transition-all text-left"
                    >
                      <span className="text-charcoal/20 text-lg shrink-0">+</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal/60 truncate">{w.label}</p>
                        <p className="text-[11px] text-charcoal/35 truncate">{w.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Save */}
        <div className="flex gap-2 pt-2 border-t border-charcoal/8">
          <button
            onClick={() => { onSave(selected); onClose() }}
            className="flex-1 bg-charcoal text-cream py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            Save Layout
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Today at a Glance ───────────────────────────────────────────────────── */
function useTodaySummary(venueId) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closedToday, setClosedToday] = useState(false)

  useEffect(() => {
    if (!venueId) return
    const today = new Date()
    const dayStart = startOfDay(today).toISOString()
    const dayEnd   = endOfDay(today).toISOString()
    const todayStr = format(today, 'yyyy-MM-dd')

    let cancelled = false
    const fetchAll = async () => {
      setLoading(true)

      // Check if venue is closed today
      const { data: closureRows } = await supabase
        .from('venue_closures')
        .select('id, reason')
        .eq('venue_id', venueId)
        .lte('start_date', todayStr)
        .gte('end_date', todayStr)
        .limit(1)
      if (cancelled) return
      if (closureRows?.length) {
        setClosedToday(closureRows[0].reason || true)
        setSummary({ overdueClean: 0, onShiftToday: 0, checksToday: 0, uncheckedFridges: 0, pendingLeave: 0, criticalActions: 0 })
        setLoading(false)
        return
      }
      setClosedToday(false)

      const [cleaning, rota, opening, fridges, fridgeLogs, leaveReqs, critActions] = await Promise.all([
        supabase.from('cleaning_tasks').select('id, frequency').eq('venue_id', venueId).eq('is_active', true),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('shift_date', todayStr),
        supabase.from('opening_closing_completions')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId).gte('completed_at', dayStart).lte('completed_at', dayEnd),
        supabase.from('fridges').select('id').eq('venue_id', venueId).eq('is_active', true),
        supabase.from('fridge_temperature_logs').select('fridge_id').eq('venue_id', venueId).gte('logged_at', dayStart).lte('logged_at', dayEnd),
        supabase.from('time_off_requests').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'pending'),
        supabase.from('corrective_actions').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'open').eq('severity', 'critical'),
      ])

      if (cancelled) return

      // Overdue cleaning — limit completions to last 90 days (max frequency window)
      let overdueCount = 0
      if (cleaning.data?.length) {
        const ninetyDaysAgo = subDays(new Date(), 90).toISOString()
        const { data: completions } = await supabase
          .from('cleaning_completions')
          .select('cleaning_task_id, completed_at')
          .eq('venue_id', venueId)
          .gte('completed_at', ninetyDaysAgo)
          .order('completed_at', { ascending: false })
        if (cancelled) return
        const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
        const now = new Date()
        // Build Map for O(1) lookups (completions sorted desc, so first match = latest)
        const latestByTask = new Map()
        for (const c of (completions ?? [])) {
          if (!latestByTask.has(c.cleaning_task_id)) latestByTask.set(c.cleaning_task_id, c)
        }
        for (const t of cleaning.data) {
          const last = latestByTask.get(t.id)
          if (!last) { overdueCount++; continue }
          if ((now - new Date(last.completed_at)) / 86400000 > (freqDays[t.frequency] ?? 1)) overdueCount++
        }
      }

      // Unchecked fridges
      const checkedIds = new Set((fridgeLogs.data ?? []).map(l => l.fridge_id))
      const uncheckedFridges = (fridges.data ?? []).filter(f => !checkedIds.has(f.id)).length

      setSummary({
        overdueClean:     overdueCount,
        onShiftToday:     rota.count ?? 0,
        checksToday:      opening.count ?? 0,
        uncheckedFridges: uncheckedFridges,
        pendingLeave:     leaveReqs.count ?? 0,
        criticalActions:  critActions.count ?? 0,
      })
      setLoading(false)
    }
    fetchAll()
    return () => { cancelled = true }
  }, [venueId])

  return { summary, loading, closedToday }
}

function TodaySummaryCard({ venueId }) {
  const { venueSlug } = useVenue()
  const { summary, loading, closedToday } = useTodaySummary(venueId)
  const vp = (p) => `/v/${venueSlug}${p}`

  const actions = summary ? [
    summary.checksToday === 0 && { label: 'Opening checks not done', to: vp('/opening-closing'), urgency: 'warn' },
    summary.uncheckedFridges > 0 && { label: `${summary.uncheckedFridges} fridge${summary.uncheckedFridges > 1 ? 's' : ''} not logged today`, to: vp('/fridge'), urgency: 'warn' },
    summary.overdueClean > 0 && { label: `${summary.overdueClean} cleaning task${summary.overdueClean > 1 ? 's' : ''} overdue`, to: vp('/cleaning'), urgency: 'danger' },
    summary.criticalActions > 0 && { label: `${summary.criticalActions} critical action${summary.criticalActions > 1 ? 's' : ''} open`, to: vp('/corrective'), urgency: 'danger' },
    summary.pendingLeave > 0 && { label: `${summary.pendingLeave} leave request${summary.pendingLeave > 1 ? 's' : ''} pending`, to: vp('/time-off'), urgency: 'info' },
  ].filter(Boolean) : []

  const urgencyBorder = { warn: 'border-warning', danger: 'border-danger', info: 'border-accent' }
  const urgencyText = { warn: 'text-warning', danger: 'text-danger', info: 'text-accent' }

  if (!loading && closedToday) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="px-5 py-6 text-center">
          <span className="text-charcoal/25 mb-3 flex justify-center"><svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></span>
          <p className="text-xl font-bold text-charcoal">Venue closed today</p>
          <p className="text-sm text-charcoal/45 mt-1">
            {typeof closedToday === 'string' ? closedToday : 'Enjoy the break!'}
          </p>
        </div>
        {summary && (summary.pendingLeave > 0 || summary.criticalActions > 0) && (
          <div className="border-t border-charcoal/6 divide-y divide-charcoal/6">
            {summary.pendingLeave > 0 && (
              <Link to={vp('/time-off')} className="flex items-center border-l-[3px] border-accent pl-4 pr-5 py-3.5 hover:bg-charcoal/3 transition-colors">
                <p className="text-sm flex-1 font-medium text-accent">{summary.pendingLeave} leave request{summary.pendingLeave > 1 ? 's' : ''} pending</p>
              </Link>
            )}
            {summary.criticalActions > 0 && (
              <Link to={vp('/corrective')} className="flex items-center border-l-[3px] border-danger pl-4 pr-5 py-3.5 hover:bg-charcoal/3 transition-colors">
                <p className="text-sm flex-1 font-medium text-danger">{summary.criticalActions} critical action{summary.criticalActions > 1 ? 's' : ''} open</p>
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[11px] tracking-widest uppercase font-semibold text-charcoal/40 mb-3">Today</p>
        {loading || !summary ? (
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-16 rounded-xl bg-charcoal/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-0.5 border border-charcoal/10 rounded-xl py-3 px-2">
              <p className={`text-2xl font-bold ${summary.onShiftToday > 0 ? 'text-charcoal' : 'text-charcoal/30'}`}>
                {summary.onShiftToday}
              </p>
              <p className="text-[10px] text-charcoal/45 leading-tight text-center">On shift</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 border border-charcoal/10 rounded-xl py-3 px-2">
              <p className={`text-2xl font-bold ${summary.checksToday > 0 ? 'text-charcoal' : 'text-charcoal/30'}`}>
                {summary.checksToday}
              </p>
              <p className="text-[10px] text-charcoal/45 leading-tight text-center">Checks done</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 border border-charcoal/10 rounded-xl py-3 px-2">
              <p className={`text-2xl font-bold ${summary.overdueClean > 0 ? 'text-danger' : 'text-charcoal/30'}`}>
                {summary.overdueClean}
              </p>
              <p className="text-[10px] text-charcoal/45 leading-tight text-center">Overdue cleans</p>
            </div>
          </div>
        )}
      </div>

      {/* Action items */}
      {!loading && summary && (
        actions.length === 0 ? (
          <div className="border-t border-charcoal/6 px-5 py-3.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
            <p className="text-sm font-medium text-charcoal/50">All checks on track</p>
          </div>
        ) : (
          <div className="border-t border-charcoal/6 divide-y divide-charcoal/6">
            {actions.map((a) => (
              <Link key={a.to} to={a.to} className={`flex items-center border-l-[3px] ${urgencyBorder[a.urgency]} pl-4 pr-5 py-3.5 hover:bg-charcoal/3 transition-colors`}>
                <p className={`text-sm flex-1 font-medium ${urgencyText[a.urgency]}`}>{a.label}</p>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}

/* ── Push notification opt-in banner ─────────────────────────────────────── */
function pushDismissKey(staffId) { return `pelikn_push_dismissed_${staffId ?? 'anon'}` }

function PushBanner({ staffId, venueId }) {
  const { permission, subscribe, supported, subscribed } = usePushNotifications(staffId, venueId)
  const [dismissed, setDismissed] = useState(false)

  // Re-read when staffId resolves (it may be null on first render)
  useEffect(() => {
    if (!staffId) return
    setDismissed(localStorage.getItem(pushDismissKey(staffId)) === '1')
  }, [staffId])

  if (!supported || permission === 'denied' || subscribed || dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-warning/25 bg-warning/8 px-4 py-3.5">
      <span className="shrink-0 w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </span>
      <p className="text-sm text-charcoal/70 flex-1 leading-snug">
        Enable notifications to get alerts for overdue checks
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={subscribe}
          className="text-[11px] font-bold tracking-wide bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand/90 transition-colors"
        >
          Enable
        </button>
        <button
          onClick={() => { localStorage.setItem(pushDismissKey(staffId), '1'); setDismissed(true) }}
          className="text-charcoal/30 hover:text-charcoal/60 transition-colors p-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  )
}

function GettingStartedCard({ venueId, venueSlug }) {
  const [checklist, setChecklist] = useState(null)
  const [dismissed, setDismissed] = useState(null) // null = loading
  const { isEnabled } = useVenueFeatures()

  useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings')
      .select('key, value')
      .eq('venue_id', venueId)
      .in('key', ['setup_checklist', 'setup_dismissed'])
      .then(({ data }) => {
        const rows = data ?? []
        const cl = rows.find(r => r.key === 'setup_checklist')
        const dm = rows.find(r => r.key === 'setup_dismissed')
        try { setChecklist(cl?.value ? JSON.parse(cl.value) : {}) }
        catch { setChecklist({}) }
        setDismissed(dm?.value === 'true')
      })
  }, [venueId])

  // Listen for reopen event from settings page
  useEffect(() => {
    const handler = () => {
      supabase.from('app_settings').delete().eq('venue_id', venueId).eq('key', 'setup_dismissed').then(() => {})
      setDismissed(false)
    }
    window.addEventListener('pelikn:reopen-setup', handler)
    return () => window.removeEventListener('pelikn:reopen-setup', handler)
  }, [venueId])

  // Still loading (null = not yet fetched)
  if (checklist === null || dismissed === null || dismissed) return null

  const items = [
    { id: 'venue_type', label: 'Choose your venue type', link: `/v/${venueSlug}/setup`, done: !!checklist.venue_type },
    { id: 'staff',      label: 'Add your first staff member', link: `/v/${venueSlug}/settings`, done: !!checklist.staff },
    { id: 'fridge',     label: 'Record a fridge check', link: `/v/${venueSlug}/fridge/log`, done: !!checklist.fridge, show: isEnabled('fridge') },
    { id: 'rota',       label: 'Create this week\'s rota', link: `/v/${venueSlug}/rota`, done: !!checklist.rota, show: isEnabled('rota') },
    { id: 'cleaning',   label: 'Complete a cleaning check', link: `/v/${venueSlug}/cleaning`, done: !!checklist.cleaning, show: isEnabled('cleaning') },
  ].filter(item => item.show !== false)

  const allDone = items.every(i => i.done)
  if (allDone) return null

  const completed = items.filter(i => i.done).length

  return (
    <div className="bg-white rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-charcoal">Getting Started</p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">{completed} of {items.length} complete</p>
        </div>
        <button onClick={() => { supabase.from('app_settings').upsert({ venue_id: venueId, key: 'setup_dismissed', value: 'true' }).then(() => {}); setDismissed(true) }} className="text-charcoal/30 hover:text-charcoal/60 transition-colors text-xl leading-none">&times;</button>
      </div>
      <div className="h-1 bg-charcoal/8 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(completed / items.length) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <Link
            key={item.id}
            to={item.link}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${item.done ? 'bg-success/5' : 'hover:bg-charcoal/3'}`}
          >
            <span className={`${item.done ? 'text-success' : 'text-charcoal/20'}`}>{item.done ? <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4"/></svg>}</span>
            <span className={`text-sm ${item.done ? 'text-charcoal/40 line-through' : 'text-charcoal'}`}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANAGER DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ManagerDashboardPage() {
  const { venueId, venuePlan, venueSlug } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const { venueName, logoUrl } = useVenueBranding(venueId)
  const { widgetIds, loading, save } = useWidgetPreferences(session?.staffId, venueId)
  const [showPicker, setShowPicker] = useState(false)

  const handleSave = (newIds) => {
    save(newIds)
    toast('Dashboard updated')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = session?.staffName?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-widest uppercase text-charcoal/40">{format(new Date(), 'EEEE, d MMMM')}</p>
          <h1 className="text-2xl font-bold text-charcoal leading-tight mt-0.5">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          {venueName && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-medium text-charcoal/50">{venueName}</p>
              <PlanBadge plan={venuePlan} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {venuePlan === 'starter' && <UpgradeButton />}
          <button
            onClick={() => setShowPicker(true)}
            className="text-[11px] font-semibold tracking-wider uppercase text-charcoal/40 hover:text-charcoal/70 border border-charcoal/15 hover:border-charcoal/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            Customise
          </button>
        </div>
      </div>

      {/* Push notification opt-in banner */}
      <PushBanner staffId={session?.staffId} venueId={venueId} />
      <GettingStartedCard venueId={venueId} venueSlug={venueSlug} />

      {/* Desktop: today summary + clock side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <TodaySummaryCard venueId={venueId} />
        <div className="bg-white rounded-2xl p-5">
          <p className="text-[11px] tracking-widest uppercase font-semibold text-charcoal/40 mb-3">My Clock</p>
          <ClockPanel staffId={session?.staffId} hasShift />
        </div>
      </div>

      {/* Widget grid — 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgetIds.map(id => {
          const widget = WIDGET_REGISTRY[id]
          if (!widget) return null
          const Component = widget.component
          return <Component key={id} />
        })}
      </div>

      {widgetIds.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-charcoal/20 p-10 text-center">
          <p className="text-charcoal/30 text-sm mb-3">No widgets on your dashboard</p>
          <button
            onClick={() => setShowPicker(true)}
            className="bg-charcoal text-cream px-4 py-2 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors"
          >
            + Add Widgets
          </button>
        </div>
      )}

      {/* Widget picker modal */}
      <WidgetPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        activeIds={widgetIds}
        onSave={handleSave}
      />
    </div>
  )
}
