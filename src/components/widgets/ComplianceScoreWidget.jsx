import React, { memo, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'
import { EXPLAINED_EXCEEDANCE_REASONS } from '../../lib/constants'

export const SCORE_TIERS = [
  { min: 90, label: 'Excellent',         color: '#15803d', status: 'good'    },
  { min: 75, label: 'Good',              color: '#16a34a', status: 'good'    },
  { min: 60, label: 'Needs Improvement', color: '#d97706', status: 'warning' },
  { min: 0,  label: 'Poor',              color: '#dc2626', status: 'bad'     },
]

export function getScoreTier(score) {
  return SCORE_TIERS.find(t => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}

/** SVG ring gauge — score number centred, no text labels inside */
export function ComplianceGauge({ score }) {
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

      const t = temps.data ?? []
      const tempFails = t.filter(x =>
        x.fridge &&
        (x.temperature < x.fridge.min_temp || x.temperature > x.fridge.max_temp) &&
        !EXPLAINED_EXCEEDANCE_REASONS.includes(x.exceedance_reason) &&
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
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
              All checks on track
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

export default memo(ComplianceScoreWidget)
