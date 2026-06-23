import React from 'react'

export default function SettingsSubHeader({ title, onBack, backLabel = 'Settings' }) {
  return (
    <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-xl backdrop-saturate-[180%] border-b border-charcoal/10 flex items-center justify-between px-4 py-[10px]">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-brand text-[15px] font-medium py-1"
      >
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L1.5 7.5 8 14"/>
        </svg>
        {backLabel}
      </button>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-charcoal">{title}</span>
      <span className="w-[70px]" />
    </div>
  )
}
