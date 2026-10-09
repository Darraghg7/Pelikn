import React, { useEffect, useState, useRef } from 'react'
import { CloseButton } from './Button'

const SIZE_CLASS = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-5xl',
}

export default function Modal({ open, onClose, title, children, size = 'md' }) {
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
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- animation runs only on open/close; `visible` is set here, so depending on it would cancel the exit timer

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!visible) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role={open ? 'dialog' : undefined}
      aria-modal={open ? 'true' : undefined}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-charcoal/40 dark:bg-white/40 backdrop-blur-sm transition-opacity duration-200 ${animating ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative bg-surface dark:bg-paperDark w-full ${SIZE_CLASS[size] ?? SIZE_CLASS.md} rounded-t-3xl sm:rounded-3xl shadow-modal p-6 pb-8 sm:pb-6 z-10 max-h-[90dvh] overflow-y-auto [-webkit-overflow-scrolling:touch] transition-all duration-[250ms] ease-out ${
          animating
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.97]'
        }`}
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-charcoal dark:text-white">{title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}
