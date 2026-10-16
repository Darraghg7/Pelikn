import React, { useState } from 'react'
import Logo from '../../components/ui/Logo'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase'
import StepPlan from './StepPlan'
import StepDetails from './StepDetails'
import StepExtraVenues from './StepExtraVenues'
import StepSuccess from './StepSuccess'
import ProgressBar from './ProgressBar'
import { setTrialPlan } from '../../lib/api/billing'
import { suggestVenueSlug, setOwnerPin } from '../../lib/api/signup'
import SetPinForm from './SetPinForm'
import { IconLock } from './SignupIcons'
import useForceLight from '../../hooks/useForceLight'

// steps: 0=plan, 1=details, 2=owner PIN, 3=extraVenues (only if extraVenues>0), then success
export default function SignupFlowPage() {
  // Public page, drawn in light colours only (its page background has no dark
  // style, so dark mode's card and input overrides left dark boxes on cream).
  useForceLight()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [plan, setPlan] = useState(searchParams.get('plan') === 'starter' ? 'starter' : 'pro')
  const [extraVenues, setExtraVenues] = useState(0)
  const [qrAddon, setQrAddon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdVenueId, setCreatedVenueId] = useState('')
  const [createdSlug, setCreatedSlug] = useState('')
  const [createdName, setCreatedName] = useState('')
  const [allVenues, setAllVenues] = useState([])

  const SUCCESS_STEP = extraVenues > 0 ? 4 : 3

  const handleSelectPlan = (p) => {
    setPlan(p)
    if (p !== 'pro') setExtraVenues(0)
  }

  // Step 1 submit: create account + primary venue, defer sign-out if extra venues needed
  const handleSubmit = async ({ venueName, ownerName, email, password, slug: wantedSlug }) => {
    if (!wantedSlug.trim()) { setError('Venue URL is required'); return }

    setLoading(true)
    setError('')

    try {
      // 0. Rate-limit check — blocks bot/spam signups by IP
      const guardRes = await fetch(`${supabaseUrl}/functions/v1/signup-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
        body: JSON.stringify({ email }),
      })
      if (!guardRes.ok) {
        const guardData = await guardRes.json()
        throw new Error(guardData.error ?? 'Too many signup attempts. Please try again later.')
      }

      // Settle the URL before the account exists: if the one they have is taken
      // (or was taken while they typed), use the next free one. Otherwise a taken
      // URL would fail the venue step after the login account was already made.
      // If the lookup fails, migration 155 may not be applied yet. Stop here:
      // without it, creating a venue with no PIN would leave the owner with an
      // empty one.
      const slug = await suggestVenueSlug(wantedSlug)
      if (!slug) throw new Error("We couldn't finish setting up your venue address. Please try again in a moment.")

      // 1. Create Supabase Auth account
      const { error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) throw new Error(authErr.message)

      // 2. Create primary venue with owner
      // The owner chooses their own PIN on the next step (migration 155), so
      // none is sent here.
      const { data: venueId, error: venueErr } = await supabase.rpc('create_venue_with_owner', {
        p_venue_name: venueName,
        p_slug: slug,
        p_owner_name: ownerName,
        p_owner_pin: '',
      })
      if (venueErr) throw new Error(venueErr.message)

      // 3. Set the trial plan, QR add-on and extra venue count. Goes through
      //    an RPC: venues has no client UPDATE policy, so a direct update
      //    silently matched zero rows and every venue stayed on Starter.
      const { error: planErr } = await setTrialPlan(venueId, plan, { qrAddon, additionalVenues: extraVenues })
      if (planErr) console.warn('Could not set plan:', planErr.message)

      setCreatedVenueId(venueId)
      setCreatedSlug(slug)
      setCreatedName(venueName)
      setAllVenues([{ name: venueName, slug }])
      // Stay signed in: the PIN step needs the owner's session.
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 2 submit: the owner's own PIN. Then extra venues, or sign out and finish.
  const handlePin = async (pin) => {
    setLoading(true)
    setError('')
    try {
      const { error: pinErr } = await setOwnerPin(createdVenueId, pin)
      if (pinErr) throw new Error(pinErr.message)
      if (extraVenues > 0) {
        setStep(3)
      } else {
        await supabase.auth.signOut()
        setStep(SUCCESS_STEP)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 3 submit: create each additional venue, then sign out
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
      setStep(SUCCESS_STEP)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isSuccess = step === SUCCESS_STEP

  return (
    <div className="min-h-dvh bg-cream font-sans text-charcoal">
      {/* Header */}
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
        <Link to="/" aria-label="Pelikn home" className="hover:opacity-80 transition-opacity">
          <Logo variant="full" size="md" />
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-body-sm font-medium text-charcoal/75">
          <IconLock />
          <span>Secure signup</span>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-8 pb-20 sm:pt-12 sm:pb-28">
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
        {step === 2 && (
          <SetPinForm onSubmit={handlePin} loading={loading} error={error} submitLabel="Save PIN and continue" />
        )}
        {step === 3 && extraVenues > 0 && (
          <StepExtraVenues
            count={extraVenues}
            onBack={() => setStep(2)}
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
