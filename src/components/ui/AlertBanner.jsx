import React from 'react'

const styles = {
  danger:  { wrapper: 'bg-danger/10 border-danger/30 text-danger', icon: '⚠️' },
  warning: { wrapper: 'bg-warning/10 border-warning/30 text-warning', icon: '⚠️' },
  success: { wrapper: 'bg-success/10 border-success/30 text-success', icon: '✓' },
  info:    { wrapper: 'bg-blue-50 border-blue-200 text-blue-700', icon: 'ℹ' },
}

export default function AlertBanner({ type = 'info', message, className = '' }) {
  const s = styles[type]
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${s.wrapper} ${className}`}>
      <span>{s.icon}</span>
      <span>{message}</span>
    </div>
  )
}
