import React, { useState } from 'react'

export default function SettingsSection({ title, subtitle, children, defaultOpen = false, locked = false }) {
  const [open, setOpen] = useState(defaultOpen && !locked)
  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => !locked && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${locked ? 'cursor-default opacity-60' : 'hover:bg-charcoal/[0.02] dark:hover:bg-white/[0.02]'}`}
      >
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/60 dark:text-white/50">{title}</p>
            {locked && (
              <span className="text-[9px] tracking-widest uppercase font-bold bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">Pro</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-charcoal/40 dark:text-white/30 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {locked ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/20 shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        ) : open ? (
          <svg className="w-4 h-4 text-charcoal/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
        ) : (
          <svg className="w-4 h-4 text-charcoal/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        )}
      </button>
      {open && !locked && (
        <div className="px-5 pb-5 pt-4 border-t border-charcoal/6 dark:border-white/8">
          {children}
        </div>
      )}
    </div>
  )
}
