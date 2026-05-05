import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import StepPlan from './StepPlan'
import StepDetails from './StepDetails'
import StepExtraVenues from './StepExtraVenues'
import StepSuccess from './StepSuccess'
import ProgressBar from './ProgressBar'
import { IconLock } from './SignupIcons'

// steps: 0=plan, 1=details, 2=extraVenues (only if extraVenues>0), 3=success
export default function SignupFlowPage() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [plan, setPlan] = useState(searchParams.get('plan') === 'starter' ? 'starter' : 'pro')
  const [extraVenues, setExtraVenues] = useState(0)
  const [qrAddon, setQrAddon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdSlug, setCreatedSlug] = useState('')
  const [createdName, setCreatedName] = useState('')
  const [allVenues, setAllVenues] = useState([])

  const SUCCESS_STEP = extraVenues > 0 ? 3 : 2

  const handleSelectPlan = (p) => {
    setPlan(p)
    if (p !== 'pro') setExtraVenues(0)
  }

  // Step 1 submit: create account + primary venue, defer sign-out if extra venues needed
  const handleSubmit = async ({ venueName, ownerName, email, password, pin, slug }) => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (!slug.trim()) { setError('Venue URL is required'); return }

    setLoading(true)
    setError('')

    try {
      // 1. Create Supabase Auth account
      const { error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) throw new Error(authErr.message)

      // 2. Create primary venue with owner
      const { data: venueId, error: venueErr } = await supabase.rpc('create_venue_with_owner', {
        p_venue_name: venueName,
        p_slug: slug,
        p_owner_name: ownerName,
        p_owner_pin: pin,
      })
      if (venueErr) throw new Error(venueErr.message)

      // 3. Set plan, QR add-on, extra venue count
      const { error: planErr } = await supabase
        .from('venues')
        .update({ plan, qr_addon: qrAddon, additional_venues: extraVenues })
        .eq('id', venueId)
      if (planErr) console.warn('Could not set plan:', planErr.message)

      setCreatedSlug(slug)
      setCreatedName(venueName)
      setAllVenues([{ name: venueName, slug }])

      if (extraVenues > 0) {
        // Advance to extra-venues naming step (stay authenticated)
        setStep(2)
      } else {
        // No extra venues — sign out and go to success
        await supabase.auth.signOut()
        setStep(SUCCESS_STEP)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 2 submit: create each additional venue, then sign out
  const handleExtraVenues = async (venueList) => {
    setLoading(true)
    setError('')

    try {
      const created = [{ name: createdName, slug: createdSlug }]
      for (const v of venueList) {
        const { error: err } = await supabase.rpc('create_additional_venue', {
          p_name: v.name.trim(),
          p_slug: v.slug.trim(),
        })
        if (err) throw new Error(`"${v.name}": ${err.message}`)
        created.push({ name: v.name, slug: v.slug })
      }

      await supabase.auth.signOut()
      setAllVenues(created)
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isSuccess = step === SUCCESS_STEP || step === 3

  return (
    <div className="min-h-dvh bg-surface font-sans">
      {/* Header */}
      <div className="border-b border-charcoal/8 bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-brand text-lg tracking-tight hover:opacity-80 transition-opacity">
            Pelikn
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-charcoal/35">
            <IconLock />
            <span>Secure signup</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
        {!isSuccess && <ProgressBar step={step} hasExtraVenues={extraVenues > 0} />}

        {step === 0 && (
          <StepPlan
            selected={plan}
            onSelect={handleSelectPlan}
            extraVenues={extraVenues}
            onExtraVenues={setExtraVenues}
            qrAddon={qrAddon}
            onQrAddon={setQrAddon}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepDetails
            plan={plan}
            extraVenues={extraVenues}
            qrAddon={qrAddon}
            onBack={() => setStep(0)}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
          />
        )}
        {step === 2 && extraVenues > 0 && (
          <StepExtraVenues
            count={extraVenues}
            onBack={() => setStep(1)}
            onSubmit={handleExtraVenues}
            loading={loading}
            error={error}
          />
        )}
        {isSuccess && (
          <StepSuccess
            venueName={createdName}
            venueSlug={createdSlug}
            plan={plan}
            allVenues={allVenues}
          />
        )}
      </div>
    </div>
  )
}
