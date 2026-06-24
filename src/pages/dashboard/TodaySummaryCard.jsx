import React from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { isActionDueToday, useTodaySummary } from '../../hooks/useTodaySummary'
import { TODAY_ITEM_REGISTRY, DEFAULT_TODAY_ITEMS } from './todayItemRegistry'

export default function TodaySummaryCard({ venueId, closedDays, itemIds, actionSchedules }) {
  const { venueSlug } = useVenue()
  const { isEnabled } = useVenueFeatures()
  const { summary, loading, closedToday } = useTodaySummary(venueId, closedDays, actionSchedules)
  const vp = (p) => `/v/${venueSlug}${p}`

  const activeItems = (itemIds?.length ? itemIds : DEFAULT_TODAY_ITEMS)
    .map(id => TODAY_ITEM_REGISTRY[id])
    .filter(item => {
      if (!item) return false
      if (item.feature && !isEnabled(item.feature)) return false
      if (item.scheduleKey && !isActionDueToday(item.scheduleKey, actionSchedules)) return false
      return true
    })

  const actions = summary
    ? activeItems.map(item => item.action?.(summary, vp)).filter(Boolean)
    : []

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
        {summary && actions.length > 0 && (
          <div className="border-t border-charcoal/6 divide-y divide-charcoal/6">
            {actions.map((a) => (
              <Link key={a.to} to={a.to} className={`flex items-center border-l-[3px] ${urgencyBorder[a.urgency]} pl-4 pr-5 py-3.5 hover:bg-charcoal/3 transition-colors`}>
                <p className={`text-sm flex-1 font-medium ${urgencyText[a.urgency]}`}>{a.label}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-charcoal/40 mb-3">Today</p>
        {loading || !summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[100px] rounded-xl bg-charcoal/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {summary.overdueClean > 0 && (
              <Link to={vp('/cleaning')} className="flex items-center gap-2.5 px-3.5 py-2.5 mb-3 rounded-xl bg-danger/8 border border-danger/15 text-danger hover:bg-danger/12 transition-colors">
                <span className="w-5 h-5 rounded-full bg-danger/18 flex items-center justify-center shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                <p className="text-sm font-semibold flex-1">{summary.overdueClean} overdue {summary.overdueClean === 1 ? 'clean' : 'cleans'}</p>
                <span className="font-mono text-xs opacity-60">→</span>
              </Link>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeItems.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-charcoal/15 py-6 px-3 text-center">
                  <p className="text-sm text-charcoal/35">No Today items selected</p>
                </div>
              ) : activeItems.map(item => {
                const value = item.metric(summary) ?? 0
                const isDanger = item.dangerWhenPositive && value > 0
                const isGood   = item.dangerWhenPositive && value === 0
                return (
                  <div key={item.id} className="flex flex-col gap-2 border border-charcoal/10 rounded-xl p-4 min-h-[100px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDanger ? 'bg-danger' : isGood ? 'bg-success' : 'bg-charcoal/20'}`} />
                      <span className="font-mono text-[10px] text-charcoal/40 uppercase tracking-[0.08em] leading-none">{item.metricLabel}</span>
                    </div>
                    <div className={`text-[34px] font-medium tracking-[-0.035em] leading-none tabular-nums ${isDanger ? 'text-danger' : 'text-charcoal'}`}>
                      {value}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
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
