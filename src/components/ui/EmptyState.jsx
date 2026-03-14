import React from 'react'

export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <span className="text-5xl">{icon}</span>
      <h3 className="font-serif text-lg text-charcoal">{title}</h3>
      {message && <p className="text-sm text-charcoal/60 max-w-xs">{message}</p>}
      {action}
    </div>
  )
}
