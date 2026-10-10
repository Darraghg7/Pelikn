import React from 'react'
import { CARD } from '../../components/temperature/TempPageParts'

const gbp = (n) => `£${Number(n).toFixed(2)}`

/**
 * Approved holiday paid in the timesheet period. Read-only: approving a
 * request (or a manager adding leave) is the decision to pay it, and these
 * hours are already in the wage bill and the exports.
 *
 * rows: [{ staffId, name, hourlyRate, hours, days }]
 */
export default function HolidayPaySection({ rows }) {
  if (!rows.length) return null
  return (
    <>
      <p className="px-1 -mb-1 text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Holiday pay</p>
      <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
        {rows.map(r => (
          <div key={r.staffId} className="flex items-center gap-2.5 px-3.5 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-ink dark:text-white truncate">{r.name}</p>
              <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">
                {r.days > 0 ? `${r.days} day${r.days === 1 ? '' : 's'} off` : 'Holiday'}
              </p>
            </div>
            {r.hours > 0 ? (
              <span className="shrink-0 text-right">
                <span className="block font-mono text-body font-semibold text-ink dark:text-white tabular-nums">{r.hours} h</span>
                {r.hourlyRate > 0 && <span className="block font-mono text-body-sm font-semibold text-good dark:text-goodDark tabular-nums">{gbp(r.hours * r.hourlyRate)}</span>}
              </span>
            ) : (
              <span className="shrink-0 text-body-sm text-warn dark:text-warnDark">No hours set</span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
