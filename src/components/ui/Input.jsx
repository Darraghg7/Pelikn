import React from 'react'

export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-charcoal/70">{label}</label>
      )}
      <input
        className={[
          'w-full px-4 py-3 rounded-xl border bg-white/80',
          'focus:outline-none focus:ring-2 focus:ring-charcoal/30',
          error ? 'border-danger' : 'border-charcoal/20',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-charcoal/70">{label}</label>
      )}
      <select
        className={[
          'w-full px-4 py-3 rounded-xl border bg-white/80 appearance-none',
          'focus:outline-none focus:ring-2 focus:ring-charcoal/30',
          error ? 'border-danger' : 'border-charcoal/20',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-charcoal/70">{label}</label>
      )}
      <textarea
        rows={3}
        className={[
          'w-full px-4 py-3 rounded-xl border bg-white/80 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-charcoal/30',
          error ? 'border-danger' : 'border-charcoal/20',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
