import React, { memo } from 'react'
import { Link } from 'react-router-dom'
import { subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'
import { EXPLAINED_EXCEEDANCE_REASONS } from '../../lib/constants'
import {
  computeComplianceScore,
  deriveComplianceIssues,
  COMPLIANCE_RANGE_DAYS,
  SCORE_TIERS,
  getScoreTier,
} from '../../lib/compliance'

// Re-exported for existing importers; the definitions now live in lib/compliance
// so this widget and EHOAuditPage can never drift apart again.
export { SCORE_TIERS, getScoreTier }

/** SVG ring gauge — score number centred, no text labels inside */
export function ComplianceGauge({ score }) {
  const tier   = getScoreTier(score)
  const r      = 44
  const cx     = 56
  const cy     = 56
  const circ   = 2 * Math.PI * r
  const offset = circ - (circ * score / 100)

  return (
    <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }} fontFamily="Geist,ui-sans-serif,sans-serif">
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
        fontSize="24" fontWeight="700" fill={tier.color}>
        {score}
      </text>
      {/* /100 sub-label */}
      <text x={cx} y={cy + 17} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fill="rgba(26,26,24,0.35)">
        /100
      </text>
    </svg>
  )
}

function ComplianceScoreWidget() {
  const { venueId, venueSlug } = useVenue()

  const { data } = useWidgetQuery('compliance_score', [venueId], async () => {
      // Same window as EHOAuditPage's default range — a 30-day widget beside a
      // 90-day page produced two different numbers even before the maths
      // differed. See COMPLIANCE_RANGE_DAYS.
      const since = subDays(new Date(), COMPLIANCE_RANGE_DAYS).toISOString()
      const [temps, deliveries, calibrations, actions, training] = await Promise.all([
        supabase.from('fridge_temperature_logs').select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(min_temp, max_temp)').eq('venue_id', venueId).gte('logged_at', since),
        supabase.from('delivery_checks').select('id, overall_pass, is_resolved').eq('venue_id', venueId).gte('checked_at', since),
        supabase.from('probe_calibrations').select('id, pass, is_resolved').eq('venue_id', venueId).gte('calibrated_at', since),
        supabase.from('corrective_actions').select('id, status, severity').eq('venue_id', venueId).gte('reported_at', since),
        supabase.from('staff_training').select('id, expiry_date, is_resolved').eq('venue_id', venueId),
      ])

      // Every metric below counts UNRESOLVED records only, so marking
      // something resolved moves the score back up.
      const t = temps.data ?? []
      const tempFails = t.filter(x =>
        x.fridge &&
        (x.temperature < x.fridge.min_temp || x.temperature > x.fridge.max_temp) &&
        !EXPLAINED_EXCEEDANCE_REASONS.includes(x.exceedance_reason) &&
        !x.is_resolved
      ).length

      const d = deliveries.data ?? []
      const c = calibrations.data ?? []
      const a = actions.data ?? []
      const tr = training.data ?? []
      const now = new Date()

      const metrics = {
        tempTotal:     t.length,
        tempFails,
        tempPassRate:  t.length > 0 ? Math.round(((t.length - tempFails) / t.length) * 100) : 100,
        deliveryTotal: d.length,
        deliveryFails: d.filter(x => !x.overall_pass && !x.is_resolved).length,
        probeTotal:    c.length,
        probeFails:    c.filter(x => !x.pass && !x.is_resolved).length,
        caOpen:        a.filter(x => x.status === 'open').length,
        caCritical:    a.filter(x => x.status === 'open' && x.severity === 'critical').length,
        expiredCerts:  tr.filter(x => x.expiry_date && new Date(x.expiry_date) < now && !x.is_resolved).length,
      }

      const { score } = computeComplianceScore(metrics)
      const issueList = deriveComplianceIssues(metrics)

      return { score, issues: issueList.length, status: getScoreTier(score).status, issueList }
  })

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
        <p className="text-[11px] text-charcoal/35 dark:text-white/30 mt-2 uppercase tracking-wide">{COMPLIANCE_RANGE_DAYS}-day average</p>
      </div>
      {data.issueList?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-charcoal/8 dark:border-white/8 flex flex-col gap-0.5">
          {data.issueList.map(issue => {
            const content = (
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-charcoal/4 dark:hover:bg-white/5 transition-colors cursor-pointer">
                <span className="text-xs text-charcoal/70 dark:text-white/60">{issue.label}</span>
                <span className={`text-xs font-semibold ${issue.severity === 'bad' ? 'text-danger' : 'text-warning'}`}>
                  {issue.detail} →
                </span>
              </div>
            )
            return issue.section ? (
              <Link key={issue.key} to={`/v/${venueSlug}/audit#${issue.section}`}>{content}</Link>
            ) : (
              <div key={issue.key}>{content}</div>
            )
          })}
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(ComplianceScoreWidget)
