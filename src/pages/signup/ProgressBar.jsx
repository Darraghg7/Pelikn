import React from 'react'

// Segmented bar with the current step named underneath, in the same quiet
// style as the marketing page.
export default function ProgressBar({ step, hasExtraVenues }) {
  const steps = hasExtraVenues
    ? ['Choose plan', 'Your details', 'Your PIN', 'Name venues', 'All done']
    : ['Choose plan', 'Your details', 'Your PIN', 'All done']

  return (
    <div className="mb-12 sm:mb-16" role="group" aria-label={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}>
      <div className="flex gap-2">
        {steps.map((label, i) => (
          <span key={label} aria-hidden="true" className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-brand' : 'bg-charcoal/12'}`} />
        ))}
      </div>
      <p className="font-mono text-micro tracking-[0.12em] uppercase text-charcoal/70 mt-4">
        Step {step + 1} of {steps.length} · {steps[step]}
      </p>
    </div>
  )
}
