import React, { useState } from 'react'
import Button from '../../components/ui/Button'
import { HEADLINE, LABEL, INPUT } from './styles'

// Shown after the account is made and before the venue is. The venue is only
// created once the owner opens the link in the email (anti-abuse: no venues
// for addresses nobody owns). `expired` is set when they came back from a
// link that no longer works; then we may not know their address, so they can
// type it in.
export default function StepCheckEmail({ email: knownEmail, expired = false, onResend, onBack }) {
  const [email, setEmail] = useState(knownEmail || '')
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState('')

  const resend = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setState('sending')
    setError('')
    const err = await onResend(email.trim())
    if (err) {
      setError(err)
      setState('idle')
    } else {
      setState('sent')
    }
  }

  return (
    <div className="flex flex-col gap-10 w-full max-w-xl">
      <div>
        <h1 className="text-charcoal" style={HEADLINE}>
          {expired ? 'That link has expired.' : 'Check your email.'}
        </h1>
        <p className="text-title-sm sm:text-title text-charcoal/75 mt-6 leading-[1.4]">
          {expired
            ? 'Email links only work once and for a limited time. Send yourself a new one below.'
            : <>We've sent a link to <strong className="font-medium text-charcoal break-all">{knownEmail}</strong>. Open it to confirm your email and we'll set up your venue.</>}
        </p>
        {!expired && (
          <p className="text-body-lg text-charcoal/70 mt-4 leading-[1.5]">
            You can open it on this device or any other. If it hasn't arrived in a few minutes, check your spam folder.
          </p>
        )}
      </div>

      <form onSubmit={resend} className="flex flex-col gap-6">
        {!knownEmail && (
          <div>
            <label htmlFor="resend-email" className={LABEL}>Your email</label>
            <input
              id="resend-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={INPUT}
            />
          </div>
        )}

        {error && (
          <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4">
            <p className="text-bad text-body-lg">{error}</p>
          </div>
        )}
        {state === 'sent' && (
          <p role="status" className="text-body-lg text-charcoal/75">New link sent. Use the latest email: older links stop working.</p>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button pill size="lg" variant={expired ? 'primary' : 'secondary'} type="submit" loading={state === 'sending'} className="px-8">
            {state === 'sending' ? 'Sending…' : 'Send a new link'}
          </Button>
          {onBack && (
            <Button variant="link" type="button" onClick={onBack}>Use a different email</Button>
          )}
        </div>
      </form>
    </div>
  )
}
