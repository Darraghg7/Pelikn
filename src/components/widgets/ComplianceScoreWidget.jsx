import React, { memo } from 'react'
import { Link } from 'react-router-dom'
import { fetchComplianceScoreWidget } from '../../lib/api/widgets'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import { WidgetShell, WidgetPending } from './shared'
import {
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
    <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }} className={tier.cls} fontFamily="Geist,ui-sans-serif,sans-serif">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" className="stroke-charcoal/7 dark:stroke-white/10" strokeWidth="11" />
      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
      {/* Score number */}
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="24" fontWeight="700" fill="currentColor">
        {score}
      </text>
      {/* /100 sub-label */}
      <text x={cx} y={cy + 17} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fill="currentColor" className="text-charcoal/35">
        /100
      </text>
    </svg>
  )
}

function ComplianceScoreWidget() {
  const { venueId, venueSlug } = useVenue()

  const { data, isError, refetch } = useWidgetQuery('compliance_score', [venueId], () => fetchComplianceScoreWidget(venueId))

  if (!data) return (
    <WidgetShell title="Compliance" to="/audit">
      <WidgetPending isError={isError} onRetry={refetch} className="py-2.5" />
    </WidgetShell>
  )

  const tier = getScoreTier(data.score)

  return (
    <WidgetShell title="Compliance" to="/audit">
      <div className="py-1">
        <p className={`font-mono text-display font-semibold leading-none tracking-tight ${tier.cls}`}>{data.score}%</p>
        {data.issues > 0 ? (
          <p className="mt-2 text-body-sm font-semibold text-bad dark:text-badDark">
            ↓ {data.issues} item{data.issues !== 1 ? 's' : ''} need attention
          </p>
        ) : (
          <p className="mt-2 text-body-sm font-semibold text-good dark:text-goodDark inline-flex items-center gap-1.5">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
            On track · {COMPLIANCE_RANGE_DAYS}-day avg
          </p>
        )}
        {data.issues > 0 && <p className="text-body-sm text-ink3 dark:text-white/45 mt-1">{COMPLIANCE_RANGE_DAYS}-day average</p>}
      </div>
      {data.issueList?.length > 0 && (
        <div className="mt-2 pt-2.5 border-t border-line dark:border-white/10 flex flex-col gap-0.5">
          {data.issueList.map(issue => {
            const content = (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-1.5 px-2 -mx-2 rounded-control hover:bg-cream dark:hover:bg-white/5 transition-colors cursor-pointer">
                <span className="text-body-sm text-ink2 dark:text-white/70">{issue.label}</span>
                <span className={`text-body-sm font-semibold ${issue.severity === 'bad' ? 'text-bad dark:text-badDark' : 'text-warn dark:text-warnDark'}`}>
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
