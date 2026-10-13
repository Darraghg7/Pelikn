import React, { useEffect, useState, useRef, useId } from 'react'
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
  const titleId = useId()
  // Read during render, before children's autoFocus runs, so it is the real opener.
  const openerRef = useRef(null)
  if (!open) openerRef.current = null
  else if (!openerRef.current && typeof document !== 'undefined') openerRef.current = document.activeElement

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

  // Keyboard and screen-reader users: move focus into the dialog when it opens,
  // keep Tab inside it, and hand focus back to whatever opened it on close.
  useEffect(() => {
    if (!open || !visible) return
    const opener = openerRef.current
    const panel = panelRef.current
    const focusable = () => Array.from(panel?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    // Don't steal focus from a field the modal already focused itself (autoFocus).
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true })
    const trap = (e) => {
      if (e.key !== 'Tab' || !panel) return
      const items = focusable()
      if (!items.length) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [open, visible])

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
      aria-labelledby={open ? titleId : undefined}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-charcoal/40 dark:bg-white/40 backdrop-blur-sm transition-opacity duration-200 ${animating ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative bg-surface dark:bg-paperDark w-full ${SIZE_CLASS[size] ?? SIZE_CLASS.md} rounded-t-sheet sm:rounded-sheet shadow-modal focus:outline-none p-6 pb-8 sm:pb-6 z-10 max-h-[90dvh] overflow-y-auto [-webkit-overflow-scrolling:touch] transition-all duration-[250ms] ease-out ${
          animating
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.97]'
        }`}
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id={titleId} className="text-lg font-bold text-charcoal dark:text-white">{title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}
