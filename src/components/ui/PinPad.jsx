import React, { useState } from 'react'

const MAX_LENGTH = 4

export default function PinPad({ onComplete, loading, error, onReset }) {
  const [digits, setDigits] = useState([])

  const push = (d) => {
    if (loading) return
    const next = [...digits, d]
    setDigits(next)
    if (next.length === MAX_LENGTH) {
      onComplete(next.join(''))
      setTimeout(() => setDigits([]), 600)
    }
  }

  const pop = () => {
    if (loading) return
    setDigits((prev) => prev.slice(0, -1))
    onReset?.()
  }

  const clear = () => {
    if (loading) return
    setDigits([])
    onReset?.()
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Dot indicators */}
      <div className="flex gap-4">
        {Array.from({ length: MAX_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={[
              'w-4 h-4 rounded-full transition-all duration-150',
              i < digits.length
                ? error ? 'bg-danger' : 'bg-charcoal'
                : 'border-2 border-charcoal/30',
            ].join(' ')}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger -mt-2">{error}</p>
      )}

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((k, i) => {
          if (k === '') return <div key={i} />
          if (k === '⌫') {
            return (
              <button
                key={i}
                onPointerDown={pop}
                className="h-16 flex items-center justify-center rounded-2xl text-2xl text-charcoal/60 active:bg-charcoal/10 transition-colors"
              >
                {k}
              </button>
            )
          }
          return (
            <button
              key={i}
              onPointerDown={() => push(k)}
              className="h-16 flex items-center justify-center rounded-2xl bg-white/70 text-2xl font-medium text-charcoal shadow-sm active:bg-charcoal/10 active:scale-95 transition-all"
            >
              {k}
            </button>
          )
        })}
      </div>
    </div>
  )
}
