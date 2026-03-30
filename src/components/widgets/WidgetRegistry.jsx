/**
 * Widget Registry — defines all available dashboard widgets.
 * Each widget is self-contained: it fetches its own data and renders itself.
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'
import { useAppSettings } from '../../hooks/useSettings'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'
import LoadingSpinner from '../ui/LoadingSpinner'

/* ── Shared components ─────────────────────────────────────────────────── */
function WidgetShell({ title, to, children, status }) {
  const { venueSlug } = useVenue()
  const statusBorder = {
    good: 'border-l-success',
    warning: 'border-l-warning',
    bad: 'border-l-danger',
  }
  const href = to && venueSlug ? `/v/${venueSlug}${to}` : to
  return (
    <div className={`bg-white rounded-xl overflow-hidden ${status ? `border-l-4 ${statusBorder[status] ?? ''}` : ''}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">{title}</p>
        {href && (
          <Link to={href} className="text-[11px] tracking-widest uppercase text-charcoal/25 hover:text-charcoal/50 transition-colors">
            View →
          </Link>
        )}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </div>
  )
}

function BigNumber({ value, label, alert }) {
  return (
    <div className="text-center py-1">
      <p className={`font-serif text-3xl font-bold ${alert ? 'text-danger' : 'text-charcoal'}`}>{value}</p>
      {label && <p className="text-xs text-charcoal/40 mt-0.5">{label}</p>}
    </div>
  )
}

function MiniRow({ label, value, warn }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-charcoal/60">{label}</span>
      <span className={`text-sm font-semibold ${warn ? 'text-danger' : 'text-charcoal'}`}>{value}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIDGET COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* 1. Compliance Score */
const SCORE_TIERS = [
  { min: 90, label: 'Excellent',         color: '#15803d', status: 'good'    },
  { min: 75, label: 'Good',              color: '#16a34a', status: 'good'    },
  { min: 60, label: 'Needs Improvement', color: '#d97706', status: 'warning' },
  { min: 0,  label: 'Poor',              color: '#dc2626', status: 'bad'     },
]

function getScoreTier(score) {
  return SCORE_TIERS.find(t => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}

/** SVG ring gauge — score number centred, no text labels inside */
function ComplianceGauge({ score }) {
  const tier   = getScoreTier(score)
  const r      = 44
  const cx     = 56
  const cy     = 56
  const circ   = 2 * Math.PI * r
  const offset = circ - (circ * score / 100)

  return (
    <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(26,26,24,0.07)" strokeWidth="11" />
      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={tier.color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
      {/* Score number */}
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="24" fontWeight="700" fontFamily="DM Sans,sans-serif" fill={tier.color}>
        {score}
      </text>
      {/* /100 sub-label */}
      <text x={cx} y={cy + 17} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fill="rgba(26,26,24,0.35)" fontFamily="DM Sans,sans-serif">
        /100
      </text>
    </svg>
  )
}

function ComplianceScoreWidget() {
  const { venueId, venueSlug } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    const load = async () => {
      const since = subDays(new Date(), 30).toISOString()
      const [temps, deliveries, calibrations, actions, training, coolingLogs, pestIssues] = await Promise.all([
        supabase.from('fridge_temperature_logs').select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(min_temp, max_temp)').eq('venue_id', venueId).gte('logged_at', since),
        supabase.from('delivery_checks').select('id, overall_pass, is_resolved').eq('venue_id', venueId).gte('checked_at', since),
        supabase.from('probe_calibrations').select('id, pass, is_resolved').eq('venue_id', venueId).gte('calibrated_at', since),
        supabase.from('corrective_actions').select('id, status, severity').eq('venue_id', venueId),
        supabase.from('staff_training').select('id, expiry_date, is_resolved').eq('venue_id', venueId),
        supabase.from('cooling_logs').select('id, end_temp, target_temp').eq('venue_id', venueId).gte('logged_at', since),
        supabase.from('pest_control_logs').select('id, status, severity, log_type, logged_at').eq('venue_id', venueId).in('log_type', ['sighting', 'treatment']).eq('status', 'open'),
      ])

      const EXPLAINED_REASONS = ['delivery', 'defrost', 'service_access']
      const t = temps.data ?? []
      const tempFails = t.filter(x =>
        x.fridge &&
        (x.temperature < x.fridge.min_temp || x.temperature > x.fridge.max_temp) &&
        !EXPLAINED_REASONS.includes(x.exceedance_reason) &&
        !x.is_resolved
      ).length
      const tempRate = t.length > 0 ? Math.round(((t.length - tempFails) / t.length) * 100) : 100

      const d = deliveries.data ?? []
      const deliveryFails = d.filter(x => !x.overall_pass && !x.is_resolved).length

      const c = calibrations.data ?? []
      const probeFails = c.filter(x => !x.pass && !x.is_resolved).length

      const a = actions.data ?? []
      const openCritical = a.filter(x => x.status === 'open' && x.severity === 'critical').length
      const openActions  = a.filter(x => x.status === 'open').length

      const tr = training.data ?? []
      const expired = tr.filter(x => x.expiry_date && new Date(x.expiry_date) < new Date() && !x.is_resolved).length

      const cl = coolingLogs.data ?? []
      const coolingFails = cl.filter(x => Number(x.end_temp) > Number(x.target_temp ?? 8)).length

      const pi = pestIssues.data ?? []
      const openHighPest = pi.filter(x => x.severity === 'high').length
      const openMedPest  = pi.filter(x => x.severity === 'medium').length

      let score = 100
      let issues = 0
      if (tempRate < 95)       { score -= 20; issues++ } else if (tempRate < 100) { score -= 5; issues++ }
      if (deliveryFails > 0)   { score -= 10; issues++ }
      if (probeFails > 0)      { score -= 10; issues++ }
      if (openCritical > 0)    { score -= 25; issues++ } else if (openActions > 3) { score -= 10; issues++ }
      if (expired > 0)         { score -= 10; issues++ }
      if (c.length === 0)      { score -= 5 }
      if (d.length === 0)      { score -= 5 }
      if (coolingFails > 0)    { score -= 10; issues++ }
      if (openHighPest > 0)    { score -= 15; issues++ } else if (openMedPest > 0) { score -= 5; issues++ }
      score = Math.max(0, score)

      const issueList = []
      if (tempFails > 0) issueList.push({ label: 'Temperature logs', detail: `${tempFails} out-of-range`, section: 'temps', severity: tempRate < 95 ? 'bad' : 'warning' })
      if (deliveryFails > 0) issueList.push({ label: 'Delivery checks', detail: `${deliveryFails} failed`, section: 'deliveries', severity: 'warning' })
      if (probeFails > 0) issueList.push({ label: 'Probe calibration', detail: `${probeFails} failed`, section: 'probes', severity: 'warning' })
      if (openCritical > 0) issueList.push({ label: 'Corrective actions', detail: `${openCritical} critical open`, section: 'actions', severity: 'bad' })
      else if (openActions > 3) issueList.push({ label: 'Corrective actions', detail: `${openActions} open`, section: 'actions', severity: 'warning' })
      if (expired > 0) issueList.push({ label: 'Staff training', detail: `${expired} expired cert${expired !== 1 ? 's' : ''}`, section: 'training', severity: 'warning' })
      if (coolingFails > 0) issueList.push({ label: 'Cooling logs', detail: `${coolingFails} exceeded target`, section: null, severity: 'warning' })
      if (openHighPest > 0) issueList.push({ label: 'Pest control', detail: `${openHighPest} high-severity open`, section: null, severity: 'bad' })

      setData({ score, issues, status: getScoreTier(score).status, issueList })
    }
    load()
  }, [venueId])

  if (!data) return (
    <WidgetShell title="Compliance Score" to="/audit">
      <div className="flex justify-center py-4"><LoadingSpinner /></div>
    </WidgetShell>
  )

  const tier = getScoreTier(data.score)

  return (
    <WidgetShell title="Compliance Score" to="/audit" status={data.status}>
      <div className="py-1">
        <p className="text-5xl font-bold leading-none" style={{ color: tier.color }}>{data.score}%</p>
        <div className="mt-3">
          {data.issues > 0 ? (
            <span className="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-semibold px-2.5 py-1 rounded-full">
              ↓ {data.issues} item{data.issues !== 1 ? 's' : ''} need attention
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-success/10 text-success text-xs font-semibold px-2.5 py-1 rounded-full">
              ✓ All checks on track
            </span>
          )}
        </div>
        <p className="text-[11px] text-charcoal/35 mt-2 uppercase tracking-wide">30-day average</p>
      </div>
      {data.issueList?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-0.5">
          {data.issueList.map(issue => {
            const content = (
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-charcoal/4 transition-colors cursor-pointer">
                <span className="text-xs text-charcoal/70">{issue.label}</span>
                <span className={`text-xs font-semibold ${issue.severity === 'bad' ? 'text-danger' : 'text-warning'}`}>
                  {issue.detail} →
                </span>
              </div>
            )
            return issue.section ? (
              <Link key={issue.section} to={`/v/${venueSlug}/audit#${issue.section}`}>{content}</Link>
            ) : (
              <div key={issue.label}>{content}</div>
            )
          })}
        </div>
      )}
    </WidgetShell>
  )
}

/* 2. Fridge Alerts */
function FridgeAlertsWidget() {
  const { venueId, venueSlug } = useVenue()
  const { closedDays } = useAppSettings()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    const load = async () => {
      const today = format(new Date(), 'yyyy-MM-dd')

      // Is today a regular closed day-of-week? (closedDays: 0=Mon…6=Sun)
      const todayDow = (new Date().getDay() + 6) % 7
      const isDowClosed = closedDays.includes(todayDow)

      // Is today inside a venue closure period?
      const { data: closureRows } = await supabase
        .from('venue_closures')
        .select('id')
        .eq('venue_id', venueId)
        .lte('start_date', today)
        .gte('end_date', today)
        .limit(1)
      const isClosed = isDowClosed || (closureRows?.length ?? 0) > 0

      const { data: logs } = await supabase
        .from('fridge_temperature_logs')
        .select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(name, min_temp, max_temp)')
        .eq('venue_id', venueId)
        .gte('logged_at', today)
        .order('logged_at', { ascending: false })

      const EXPLAINED_W = ['delivery', 'defrost', 'service_access']
      const items = logs ?? []
      const outOfRange = items.filter(l =>
        l.fridge &&
        (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp) &&
        !EXPLAINED_W.includes(l.exceedance_reason) &&
        !l.is_resolved
      )
      const total = items.length
      const { data: fridges } = await supabase.from('fridges').select('id, name').eq('venue_id', venueId).eq('is_active', true)
      const fridgeCount = fridges?.length ?? 0
      const checkedFridgeIds = new Set(items.map(l => l.fridge?.name).filter(Boolean))
      // Don't flag unchecked fridges on closed days
      const unchecked = isClosed ? 0 : Math.max(0, fridgeCount - checkedFridgeIds.size)

      setData({ total, alerts: outOfRange.length, unchecked, fridgeCount, isClosed, alertItems: outOfRange.slice(0, 4) })
    }
    load()
  }, [venueId, closedDays])

  if (!data) return <WidgetShell title="Fridge Status" to="/fridge"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.alerts > 0 ? 'bad' : data.unchecked > 0 ? 'warning' : 'good'

  return (
    <WidgetShell title="Fridge Status" to="/fridge" status={status}>
      <MiniRow label="Readings today" value={data.total} />
      <MiniRow label="Out of range" value={data.alerts} warn={data.alerts > 0} />
      {data.isClosed ? (
        <p className="text-[11px] text-charcoal/35 italic pt-1">Venue closed today — checks not required</p>
      ) : (
        <MiniRow label="Not yet checked" value={data.unchecked} warn={data.unchecked > 0} />
      )}
      {data.alerts > 0 && data.alertItems?.map((l) => (
        <Link
          key={l.id}
          to={`/v/${venueSlug}/fridge/history`}
          className="flex items-center justify-between py-1 border-t border-charcoal/5 group"
        >
          <span className="text-xs text-charcoal/60 truncate group-hover:text-charcoal transition-colors">{l.fridge?.name ?? 'Unknown'}</span>
          <span className="text-xs font-semibold text-danger">{Number(l.temperature).toFixed(1)} °C</span>
        </Link>
      ))}
    </WidgetShell>
  )
}

/* 3. Cleaning Overdue */
const CLEANING_PAGE_SIZE = 3
const FREQ_DAYS = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }

function CleaningOverdueWidget() {
  const { tasks, overdueCount, reload } = useCleaningTasks()
  const { session } = useSession()
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [completing, setCompleting] = useState(null)
  const status = overdueCount > 3 ? 'bad' : overdueCount > 0 ? 'warning' : 'good'

  const completeTask = async (taskId) => {
    setCompleting(taskId)
    const { error } = await supabase.rpc('complete_cleaning_task', {
      p_token: session?.token,
      p_cleaning_task_id: taskId,
      p_notes: null,
    })
    setCompleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Task completed ✓')
    reload()
  }

  const overdueTasks = tasks.filter(t => t.status === 'overdue')
  const totalPages = Math.ceil(overdueTasks.length / CLEANING_PAGE_SIZE)
  const pageItems = overdueTasks.slice(page * CLEANING_PAGE_SIZE, (page + 1) * CLEANING_PAGE_SIZE)

  // Reset page if tasks change
  useEffect(() => { setPage(0) }, [overdueTasks.length])

  if (overdueCount === 0) {
    return (
      <WidgetShell title="Cleaning" to="/cleaning" status={status}>
        <BigNumber value={0} label="All on track" alert={false} />
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title="Cleaning" to="/cleaning" status={status}>
      <p className="text-xs font-semibold text-danger mb-2">{overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue</p>
      <div className="flex flex-col gap-1">
        {pageItems.map(t => {
          const days = t.lastCompletion
            ? Math.floor((Date.now() - new Date(t.lastCompletion.completed_at)) / 86400000)
            : null
          const threshold = FREQ_DAYS[t.frequency] ?? 1
          const overBy = days !== null ? days - threshold : null
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 py-1 border-b border-charcoal/6 last:border-0">
              <button
                onClick={(e) => { e.preventDefault(); completeTask(t.id) }}
                disabled={completing === t.id}
                className="shrink-0 w-6 h-6 rounded-full border-2 border-charcoal/20 flex items-center justify-center hover:border-success hover:bg-success/10 transition-colors disabled:opacity-40 text-success text-xs"
                title="Mark complete"
              >
                {completing === t.id ? '…' : '✓'}
              </button>
              <p className="text-xs text-charcoal truncate flex-1">{t.title}</p>
              <span className="text-[11px] text-danger/70 whitespace-nowrap shrink-0">
                {overBy !== null ? `${overBy}d overdue` : 'Never done'}
              </span>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-2 pt-1 border-t border-charcoal/6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[11px] text-charcoal/40 hover:text-charcoal disabled:opacity-20"
          >
            ‹
          </button>
          <span className="text-[11px] text-charcoal/30">{page + 1}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-[11px] text-charcoal/40 hover:text-charcoal disabled:opacity-20"
          >
            ›
          </button>
        </div>
      )}
    </WidgetShell>
  )
}

/* 4. Staff On Shift */
function StaffOnShiftWidget() {
  const { venueId } = useVenue()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    const today = format(new Date(), 'yyyy-MM-dd')
    supabase.from('shifts')
      .select('id, start_time, end_time, role_label, staff:staff_id(name, job_role)')
      .eq('venue_id', venueId)
      .eq('shift_date', today)
      .order('start_time')
      .then(({ data }) => { setShifts(data ?? []); setLoading(false) })
  }, [venueId])

  const now = format(new Date(), 'HH:mm')

  return (
    <WidgetShell title="On Shift Today" to="/rota">
      {loading ? (
        <div className="flex justify-center py-4"><LoadingSpinner /></div>
      ) : shifts.length === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No shifts today</p>
      ) : (
        <div className="flex flex-col divide-y divide-charcoal/6 -mx-5">
          {shifts.slice(0, 5).map(s => {
            const start = s.start_time?.slice(0, 5) ?? ''
            const end = s.end_time?.slice(0, 5) ?? ''
            const active = now >= start && now <= end
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-success' : now > end ? 'bg-charcoal/20' : 'bg-warning'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{s.staff?.name ?? '—'}</p>
                  <p className="text-[11px] text-charcoal/40">{s.role_label}</p>
                </div>
                <p className="text-xs font-mono text-charcoal/50">{start}–{end}</p>
              </div>
            )
          })}
          {shifts.length > 5 && (
            <p className="text-[11px] text-charcoal/30 px-5 py-2">+{shifts.length - 5} more</p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

/* 5. Open Corrective Actions */
function OpenActionsWidget() {
  const { venueId, venueSlug } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    supabase.from('corrective_actions')
      .select('id, severity, status, title, reported_at')
      .eq('venue_id', venueId)
      .eq('status', 'open')
      .order('severity')
      .then(({ data: actions }) => {
        const items = actions ?? []
        const critical = items.filter(a => a.severity === 'critical').length
        const major = items.filter(a => a.severity === 'major').length
        setData({ total: items.length, critical, major, items })
      })
  }, [venueId])

  if (!data) return <WidgetShell title="Open Actions" to="/corrective"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.critical > 0 ? 'bad' : data.total > 0 ? 'warning' : 'good'

  return (
    <WidgetShell title="Open Actions" to="/corrective" status={status}>
      <BigNumber value={data.total} label={data.total === 0 ? 'No open issues' : 'unresolved'} alert={data.critical > 0} />
      {data.total > 0 && (
        <div className="flex justify-center gap-3 mt-1">
          {data.critical > 0 && <span className="text-[11px] text-danger font-medium">{data.critical} critical</span>}
          {data.major > 0 && <span className="text-[11px] text-orange-600 font-medium">{data.major} major</span>}
        </div>
      )}
      {data.total > 0 && data.items.slice(0, 4).map(a => (
        <Link
          key={a.id}
          to={`/v/${venueSlug}/corrective`}
          className="flex items-center justify-between py-1.5 border-t border-charcoal/5 group"
        >
          <span className="text-xs text-charcoal/70 truncate flex-1 group-hover:text-charcoal transition-colors">{a.title ?? 'Untitled'}</span>
          <span className={`text-[11px] font-semibold shrink-0 ml-2 ${
            a.severity === 'critical' ? 'text-danger' :
            a.severity === 'major' ? 'text-warning' : 'text-charcoal/40'
          }`}>{a.severity?.toUpperCase()}</span>
        </Link>
      ))}
    </WidgetShell>
  )
}

/* 6. Expiring Training */
function ExpiringTrainingWidget() {
  const { venueId, venueSlug } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    supabase.from('staff_training')
      .select('id, title, expiry_date, staff:staff_id(name)')
      .eq('venue_id', venueId)
      .not('expiry_date', 'is', null)
      .order('expiry_date')
      .then(({ data: certs }) => {
        const now = new Date()
        const thirtyDays = new Date(now.getTime() + 30 * 86400000)
        const items = certs ?? []
        const expired = items.filter(c => new Date(c.expiry_date) < now)
        const expiring = items.filter(c => {
          const d = new Date(c.expiry_date)
          return d >= now && d <= thirtyDays
        })
        setData({ expired: expired.length, expiring: expiring.length, items: [...expired, ...expiring].slice(0, 4) })
      })
  }, [venueId])

  if (!data) return <WidgetShell title="Training Expiry" to="/training"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.expired > 0 ? 'bad' : data.expiring > 0 ? 'warning' : 'good'

  return (
    <WidgetShell title="Training Expiry" to="/training" status={status}>
      <MiniRow label="Expired" value={data.expired} warn={data.expired > 0} />
      <MiniRow label="Expiring (30 days)" value={data.expiring} warn={data.expiring > 0} />
      {data.items.length > 0 && (
        <div className="mt-2 border-t border-charcoal/6 pt-2">
          {data.items.map(c => (
            <Link key={c.id} to={`/v/${venueSlug}/training`} className="flex items-center justify-between py-0.5 hover:text-charcoal transition-colors group">
              <span className="text-xs text-charcoal/50 truncate group-hover:text-charcoal">{c.staff?.name} — {c.title}</span>
              <span className={`text-[11px] font-semibold ml-2 shrink-0 ${new Date(c.expiry_date) < new Date() ? 'text-danger' : 'text-warning'}`}>
                {format(new Date(c.expiry_date), 'd MMM yy')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}

/* 7. Today's Deliveries */
function TodaysDeliveriesWidget() {
  const { venueId } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    supabase.from('delivery_checks')
      .select('id, supplier_name, overall_pass, checked_at')
      .eq('venue_id', venueId)
      .gte('checked_at', today.toISOString())
      .order('checked_at', { ascending: false })
      .limit(5)
      .then(({ data: checks }) => {
        const items = checks ?? []
        const fails = items.filter(c => !c.overall_pass).length
        setData({ total: items.length, fails, items })
      })
  }, [venueId])

  if (!data) return <WidgetShell title="Today's Deliveries" to="/deliveries"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.fails > 0 ? 'bad' : data.total > 0 ? 'good' : 'neutral'

  return (
    <WidgetShell title="Today's Deliveries" to="/deliveries" status={status !== 'neutral' ? status : undefined}>
      {data.total === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No deliveries logged today</p>
      ) : (
        <>
          <MiniRow label="Deliveries" value={data.total} />
          <MiniRow label="Failed" value={data.fails} warn={data.fails > 0} />
          <div className="mt-2 border-t border-charcoal/6 pt-2">
            {data.items.map(c => (
              <div key={c.id} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-charcoal/60 truncate">{c.supplier_name}</span>
                <span className={`text-[11px] font-medium ${c.overall_pass ? 'text-success' : 'text-danger'}`}>
                  {c.overall_pass ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  )
}

/* 8. Weekly Labour Cost */
function WeeklyLabourWidget() {
  const { venueId } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    const load = async () => {
      const now = new Date()
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const weekStart = format(monday, 'yyyy-MM-dd')

      const { data: shifts } = await supabase
        .from('shifts')
        .select('start_time, end_time, staff:staff_id(hourly_rate)')
        .eq('venue_id', venueId)
        .eq('week_start', weekStart)

      const items = shifts ?? []
      let totalHrs = 0
      let totalCost = 0
      for (const s of items) {
        const [sh, sm] = s.start_time.split(':').map(Number)
        const [eh, em] = s.end_time.split(':').map(Number)
        const hrs = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60)
        totalHrs += hrs
        totalCost += hrs * (s.staff?.hourly_rate ?? 0)
      }

      setData({ shifts: items.length, hours: totalHrs.toFixed(1), cost: totalCost.toFixed(2) })
    }
    load()
  }, [venueId])

  if (!data) return <WidgetShell title="Weekly Labour" to="/rota"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  return (
    <WidgetShell title="Weekly Labour" to="/rota">
      <div className="text-center py-1">
        <p className="font-serif text-3xl font-bold text-charcoal font-mono">&pound;{data.cost}</p>
        <p className="text-xs text-charcoal/40 mt-0.5">{data.hours}h across {data.shifts} shifts</p>
      </div>
    </WidgetShell>
  )
}

/* 9. Pending Swap Requests */
function PendingSwapsWidget() {
  const { venueId } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    supabase.from('shift_swaps')
      .select('id, requester_name, target_staff_name, status')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .limit(5)
      .then(({ data: swaps }) => setData({ items: swaps ?? [], count: swaps?.length ?? 0 }))
  }, [venueId])

  if (!data) return <WidgetShell title="Swap Requests" to="/rota"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  return (
    <WidgetShell title="Swap Requests" to="/rota" status={data.count > 0 ? 'warning' : undefined}>
      {data.count === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No pending requests</p>
      ) : (
        <>
          <BigNumber value={data.count} label="pending" alert={false} />
          <div className="mt-1 border-t border-charcoal/6 pt-2">
            {data.items.map(s => (
              <p key={s.id} className="text-xs text-charcoal/50 py-0.5 truncate">
                {s.requester_name} → {s.target_staff_name}
              </p>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  )
}

/* 10. Probe Calibration Due */
function ProbeCalDueWidget() {
  const { venueId } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    supabase.from('probe_calibrations')
      .select('id, probe_name, pass, calibrated_at')
      .eq('venue_id', venueId)
      .order('calibrated_at', { ascending: false })
      .limit(10)
      .then(({ data: records }) => {
        const items = records ?? []
        const last = items[0]
        const daysSince = last
          ? Math.floor((new Date() - new Date(last.calibrated_at)) / 86400000)
          : null
        const recentFails = items.filter(r => !r.pass).length
        setData({ daysSince, recentFails, lastDate: last ? format(new Date(last.calibrated_at), 'd MMM') : 'Never' })
      })
  }, [venueId])

  if (!data) return <WidgetShell title="Probe Calibration" to="/probe"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.daysSince === null || data.daysSince > 30 ? 'warning' : data.recentFails > 0 ? 'bad' : 'good'

  return (
    <WidgetShell title="Probe Calibration" to="/probe" status={status}>
      <MiniRow label="Last calibration" value={data.lastDate} />
      <MiniRow
        label="Days since"
        value={data.daysSince ?? '—'}
        warn={data.daysSince !== null && data.daysSince > 30}
      />
      <MiniRow label="Recent failures" value={data.recentFails} warn={data.recentFails > 0} />
    </WidgetShell>
  )
}

/* 11. Staff Notifications — leave requests + swap requests */
function StaffNotificationsWidget() {
  const { venueId, venueSlug } = useVenue()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!venueId) return
    Promise.all([
      supabase
        .from('time_off_requests')
        .select('id, start_date, end_date, reason, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('shift_swaps')
        .select('id, requester_name, target_staff_name')
        .eq('venue_id', venueId)
        .eq('status', 'pending')
        .limit(5),
      supabase
        .from('training_sign_offs')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .eq('staff_acknowledged', false),
    ]).then(([{ data: leave }, { data: swaps }, { count: trainCount }]) => {
      setData({
        leave:      leave  ?? [],
        swaps:      swaps  ?? [],
        trainCount: trainCount ?? 0,
      })
    })
  }, [venueId])

  if (!data) {
    return (
      <WidgetShell title="Staff Notifications" to="/time-off">
        <div className="flex justify-center py-4"><LoadingSpinner /></div>
      </WidgetShell>
    )
  }

  const total = data.leave.length + data.swaps.length + data.trainCount
  const status = total > 0 ? 'warning' : undefined

  return (
    <WidgetShell title="Staff Notifications" status={status}>
      {total === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No pending notifications</p>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          {data.leave.map(r => (
            <a
              key={r.id}
              href={`/v/${venueSlug}/time-off`}
              className="flex items-start gap-2 group"
            >
              <span className="text-warning text-xs mt-0.5 shrink-0">●</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate group-hover:text-accent transition-colors">
                  {r.staff?.name ?? 'Staff'} — Leave Request
                </p>
                <p className="text-[11px] text-charcoal/40">
                  {format(new Date(r.start_date), 'd MMM')} – {format(new Date(r.end_date), 'd MMM yyyy')}
                  {r.reason ? ` · ${r.reason}` : ''}
                </p>
              </div>
            </a>
          ))}
          {data.swaps.map(s => (
            <a
              key={s.id}
              href={`/v/${venueSlug}/rota`}
              className="flex items-start gap-2 group"
            >
              <span className="text-accent text-xs mt-0.5 shrink-0">●</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate group-hover:text-accent transition-colors">
                  Swap: {s.requester_name} → {s.target_staff_name}
                </p>
                <p className="text-[11px] text-charcoal/40">Shift swap pending approval</p>
              </div>
            </a>
          ))}
          {data.trainCount > 0 && (
            <a
              href={`/v/${venueSlug}/training`}
              className="flex items-start gap-2 group"
            >
              <span className="text-charcoal/40 text-xs mt-0.5 shrink-0">●</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal group-hover:text-accent transition-colors">
                  {data.trainCount} training record{data.trainCount !== 1 ? 's' : ''} unsigned
                </p>
                <p className="text-[11px] text-charcoal/40">Awaiting employee signature</p>
              </div>
            </a>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGISTRY — maps widget IDs to components + metadata
   ═══════════════════════════════════════════════════════════════════════════ */

export const WIDGET_REGISTRY = {
  compliance_score:   { id: 'compliance_score',   label: 'Compliance Score',      description: 'Overall compliance percentage based on all checks', component: ComplianceScoreWidget },
  fridge_alerts:      { id: 'fridge_alerts',      label: 'Fridge Status',         description: 'Today\'s readings, out-of-range alerts, unchecked fridges', component: FridgeAlertsWidget },
  cleaning_overdue:   { id: 'cleaning_overdue',   label: 'Cleaning',              description: 'Number of overdue cleaning tasks', component: CleaningOverdueWidget },
  staff_on_shift:     { id: 'staff_on_shift',     label: 'Staff On Shift',        description: 'Who\'s working today with shift times', component: StaffOnShiftWidget },
  open_actions:       { id: 'open_actions',       label: 'Open Actions',          description: 'Unresolved corrective actions by severity', component: OpenActionsWidget },
  expiring_training:  { id: 'expiring_training',  label: 'Training Expiry',       description: 'Staff certificates expiring within 30 days', component: ExpiringTrainingWidget },
  todays_deliveries:  { id: 'todays_deliveries',  label: 'Today\'s Deliveries',   description: 'Delivery checks logged today with pass/fail', component: TodaysDeliveriesWidget },
  weekly_labour:      { id: 'weekly_labour',      label: 'Weekly Labour Cost',    description: 'Total wage bill from this week\'s rota', component: WeeklyLabourWidget },
  pending_swaps:          { id: 'pending_swaps',          label: 'Swap Requests',         description: 'Pending shift swap requests awaiting approval', component: PendingSwapsWidget },
  probe_calibration:      { id: 'probe_calibration',      label: 'Probe Calibration',     description: 'Days since last calibration and recent failures', component: ProbeCalDueWidget },
  staff_notifications:    { id: 'staff_notifications',    label: 'Staff Notifications',   description: 'Pending leave requests, shift swaps, and training sign-offs', component: StaffNotificationsWidget },
}

export const DEFAULT_WIDGETS = [
  'compliance_score',
  'fridge_alerts',
  'cleaning_overdue',
  'staff_on_shift',
  'staff_notifications',
]

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY)
