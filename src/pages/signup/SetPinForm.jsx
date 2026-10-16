import React, { useState } from 'react'
import Button from '../../components/ui/Button'
import { HEADLINE, LABEL, INPUT, HINT } from './styles'

// The owner chooses their own PIN. Used by the signup flow and by the
// recovery page for an owner who left before setting one.
export default function SetPinForm({ onSubmit, loading = false, error = '', submitLabel = 'Save my PIN' }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  const handle = e => {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) { setLocalError('Your PIN must be 4 to 6 digits.'); return }
    if (pin !== confirm) { setLocalError("Those PINs don't match."); return }
    setLocalError('')
    onSubmit(pin)
  }

  const shown = localError || error

  return (
    <div className="flex flex-col gap-10 w-full max-w-xl">
      <div>
        <h1 className="text-charcoal" style={HEADLINE}>Choose your PIN.</h1>
        <p className="text-title-sm sm:text-title text-charcoal/75 mt-6 leading-[1.4]">
          This is how you sign in to your venue on the shared staff screen. Pick something your team can't guess.
        </p>
      </div>

      <form onSubmit={handle} className="flex flex-col gap-10">
        <div>
          <label htmlFor="owner-pin" className={LABEL}>Your PIN</label>
          <div className="flex flex-col gap-3">
            <input
              id="owner-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required
              minLength={4}
              maxLength={6}
              placeholder="4 to 6 digits"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className={`${INPUT} font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:font-sans`}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required
              minLength={4}
              maxLength={6}
              aria-label="Confirm your PIN"
              placeholder="Type it again"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}
              className={`${INPUT} font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:font-sans`}
            />
            <p className={HINT}>You can change it any time in Settings. Your staff set their own PINs.</p>
          </div>
        </div>

        {shown && (
          <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4">
            <p className="text-bad text-body-lg">{shown}</p>
          </div>
        )}

        <Button pill size="lg" type="submit" loading={loading} className="self-start px-8">
          {loading ? 'Saving…' : submitLabel}
        </Button>
      </form>
    </div>
  )
}
