import React from 'react'
import { IconCheck } from './SignupIcons'

export default function ProgressBar({ step, hasExtraVenues }) {
  const steps = hasExtraVenues
    ? ['Choose plan', 'Your details', 'Name venues', 'All done']
    : ['Choose plan', 'Your details', 'All done']

  return (
    <div className="flex items-center gap-0 max-w-sm mx-auto mb-10">
      {steps.map((label, i) => {
        const active = i === step
        const done = i < step
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                done ? 'bg-brand text-cream'
                : active ? 'bg-brand text-cream ring-4 ring-brand/20'
                : 'bg-charcoal/10 text-charcoal/35'
              }`}>
                {done ? <IconCheck size={13} color="white" /> : i + 1}
              </div>
              <span className={`text-[10px] tracking-wide whitespace-nowrap transition-colors ${active ? 'text-brand font-medium' : 'text-charcoal/35'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px flex-1 mx-1 mb-4 transition-colors ${done ? 'bg-brand' : 'bg-charcoal/10'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
