import React from 'react'
import Button from '../ui/Button'

export default function SettingsSubHeader({ title, onBack, backLabel = 'Settings' }) {
  return (
    <div className="sticky top-0 z-10 bg-surface/90 dark:bg-[#111111]/90 backdrop-blur-xl backdrop-saturate-[180%] border-b border-charcoal/10 dark:border-white/10 flex items-center justify-between py-[10px]">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-3"
        leadingIcon={
          <svg viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1L1.5 7.5 8 14"/>
          </svg>
        }
      >
        {backLabel}
      </Button>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-charcoal dark:text-white">{title}</span>
      <span className="w-[70px]" />
    </div>
  )
}
