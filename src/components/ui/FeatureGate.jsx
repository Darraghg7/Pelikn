import React, { useEffect } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { extraForPath } from '../../lib/features'
import { useToast } from './Toast'

/**
 * Sends a switched-off optional extra (lib/features.ts) back to the dashboard
 * with a short note, so an old bookmark or link doesn't open a hidden page.
 * Pro extras on Starter are left to PlanGate's upgrade screen instead.
 */
export default function FeatureGate({ children }) {
  const { venueSlug } = useParams()
  const { pathname } = useLocation()
  const extra = extraForPath(pathname.replace(`/v/${venueSlug}`, '') || '/')
  const { isSwitchedOn, isPlanLocked, ready } = useVenueFeatures()

  if (!extra || isPlanLocked(extra.id)) return children
  if (!ready) return null
  if (!isSwitchedOn(extra.id)) return <FeatureOffRedirect label={extra.label} venueSlug={venueSlug} />
  return children
}

// One note per redirect, even when React runs the effect twice (dev mode).
let lastNote = { label: '', at: 0 }

function FeatureOffRedirect({ label, venueSlug }) {
  const toast = useToast()
  const { isManager } = useSession()
  useEffect(() => {
    if (lastNote.label === label && Date.now() - lastNote.at < 1000) return
    lastNote = { label, at: Date.now() }
    toast(
      isManager
        ? `${label} is turned off. Turn it on in Settings → Features.`
        : `${label} is turned off for this venue. Ask your manager if you need it.`,
      'warning',
    )
  }, [toast, label, isManager])
  return <Navigate to={`/v/${venueSlug}/dashboard`} replace />
}
