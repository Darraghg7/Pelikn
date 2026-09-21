import React from 'react'
import { fmtDays } from './timeOffConstants'

export default function BalancePill({ entitlement, used, remaining, isZeroHours, accrued, small }) {
  if (isZeroHours) return (
    <span className={`inline-flex items-center gap-1 ${small ? 'text-[11px]' : 'text-xs'} font-medium text-charcoal/60 dark:text-white/50 bg-charcoal/6 dark:bg-white/8 px-2 py-0.5 rounded-full`}>
      {accrued != null ? `${accrued} hrs accrued` : 'Calculating…'}
    </span>
  )
  if (entitlement == null) return null
  const colour   = remaining === 0 ? 'text-danger' : remaining <= 5 ? 'text-warning' : 'text-success'
  return (
    <span className={`inline-flex items-center gap-1 ${small ? 'text-[11px]' : 'text-xs'} font-medium`}>
      <span className={colour}>{fmtDays(remaining)} left</span>
      <span className="text-charcoal/30 dark:text-white/30">({used}/{entitlement} used)</span>
    </span>
  )
}
