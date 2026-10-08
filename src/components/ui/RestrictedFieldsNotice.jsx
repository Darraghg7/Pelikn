import React, { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import {
  subscribeRestrictedFieldsFailures,
  getRestrictedFieldsFailures,
} from '../../lib/api/staffRestricted'

const WHAT = {
  pay:     'Pay rates',
  private: 'Contract details',
}

const CONSEQUENCE = {
  pay:     'so labour costs here are missing or show as £0',
  private: 'so contracted hours and contact details here may be blank',
}

/**
 * Says so when pay rates or contract details failed to load.
 *
 * Every screen that shows them merges them into rows it loaded separately, so a
 * failure otherwise looks like real data — £0 of labour, no contracted hours.
 * Renders nothing while the last load of each requested field set succeeded.
 *
 * @param {{ fields?: Array<'pay' | 'private'>, className?: string }} props
 */
export default function RestrictedFieldsNotice({ fields = ['pay'], className = '' }) {
  const failures = useSyncExternalStore(subscribeRestrictedFieldsFailures, getRestrictedFieldsFailures)
  const { session, signOut } = useSession() ?? {}
  const navigate = useNavigate()

  const failed = fields.filter(f => failures.has(f))
  if (failed.length === 0) return null

  const subject = failed.map(f => WHAT[f]).join(' and ')
  const consequence = failed.map(f => CONSEQUENCE[f]).join(', and ')
  const sessionProblem = failed.some(f => failures.get(f) === 'session')

  const signInAgain = () => {
    const slug = session?.venueSlug
    signOut?.()
    if (slug) navigate(`/v/${slug}`, { replace: true })
  }

  return (
    <div role="alert" className={`rounded-xl bg-warning/10 text-warning px-4 py-3 text-xs font-medium ${className}`}>
      {sessionProblem ? (
        <>
          <span>
            {subject} couldn't be loaded because this device's sign-in has run out, {consequence}.{' '}
          </span>
          <button type="button" onClick={signInAgain} className="underline font-semibold">
            Sign in again
          </button>
        </>
      ) : (
        <span>
          {subject} couldn't be loaded, {consequence}. Refresh the page to try again.
        </span>
      )}
    </div>
  )
}
