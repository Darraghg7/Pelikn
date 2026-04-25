import React, { useEffect, useState, useRef } from 'react'

export default function Modal({ open, onClose, title, children }) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (open) {
      setVisible(true)
      // Trigger enter animation on next frame
      requestAnimationFrame(() => setAnimating(true))
    } else if (visible) {
      // Exit animation
      setAnimating(false)
      const timer = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(timer)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-charcoal/40 backdrop-blur-sm transition-opacity duration-200 ${animating ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative bg-surface dark:bg-[#1e1e1e] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-modal p-6 pb-8 sm:pb-6 z-10 max-h-[90dvh] overflow-y-auto transition-all duration-[250ms] ease-out ${
          animating
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.97]'
        }`}
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-charcoal">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-charcoal/10 text-charcoal/60 text-lg"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
