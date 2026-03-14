import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title, subtitle, backTo, action }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-start justify-between mb-8">
      <div className="flex items-start gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="mt-2 text-charcoal/40 hover:text-charcoal transition-colors"
          >
            ←
          </button>
        )}
        <div>
          <h1 className="font-serif text-3xl text-charcoal leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-charcoal/40 mt-1 tracking-wide">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
