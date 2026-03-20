import React, { useEffect } from 'react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-cream dark:bg-[#1e1e1e] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 pb-8 sm:pb-6 z-10 max-h-[90dvh] overflow-y-auto" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl text-charcoal">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-charcoal/10 text-charcoal/60 text-lg"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
