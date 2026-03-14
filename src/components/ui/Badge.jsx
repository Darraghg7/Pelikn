import React from 'react'
import { ALLERGEN_COLORS } from '../../lib/constants'

export default function Badge({ label, className = '' }) {
  const colorClass = ALLERGEN_COLORS[label] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const styles = {
    clocked_in:  'bg-success/10 text-success',
    on_break:    'bg-warning/10 text-warning',
    clocked_out: 'bg-charcoal/10 text-charcoal/70',
  }
  const labels = {
    clocked_in:  'Clocked In',
    on_break:    'On Break',
    clocked_out: 'Clocked Out',
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${styles[status] ?? styles.clocked_out}`}>
      {labels[status] ?? 'Clocked Out'}
    </span>
  )
}
