import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Logo from '../../components/ui/Logo'
import { useAuth } from '../../contexts/AuthContext'
import { useVenue } from '../../contexts/VenueContext'
import { ownerPinPending, setOwnerPin } from '../../lib/api/signup'
import { reportError } from '../../lib/reportError'
import useForceLight from '../../hooks/useForceLight'
import SetPinForm from './SetPinForm'

// For an owner who created their venue but left before choosing a PIN. They
// can sign in with their email, but the staff screen needs a PIN, so the
// login page sends them here until one is set.
export default function SetPinPage() {
  useForceLight()
  const navigate = useNavigate()
  const { user, authLoading } = useAuth()
  const { venueId, venueSlug } = useVenue()
  const [pending, setPending] = useState(null) // null = checking
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !venueId) return
    let cancelled = false
    ownerPinPending(venueId).then(p => { if (!cancelled) setPending(p) })
    return () => { cancelled = true }
  }, [user, venueId])

  if (authLoading) return null
  if (!user || pending === false) return <Navigate to={`/v/${venueSlug}`} replace />
  if (pending === null) return null

  const save = async pin => {
    setSaving(true); setError('')
    const { error: err } = await setOwnerPin(venueId, pin)
    setSaving(false)
    if (err) { reportError(err, 'SetPinPage:save'); setError(err.message); return }
    navigate(`/v/${venueSlug}`, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-cream font-sans text-charcoal">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 h-[72px] flex items-center">
        <Logo variant="full" size="md" />
      </div>
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-8 pb-20 sm:pt-12">
        <SetPinForm onSubmit={save} loading={saving} error={error} submitLabel="Save PIN and sign in" />
      </div>
    </div>
  )
}
