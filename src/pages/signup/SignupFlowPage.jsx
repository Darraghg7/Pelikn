import React, { useEffect, useRef, useState } from 'react'
import Logo from '../../components/ui/Logo'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase'
import StepPlan from './StepPlan'
import StepDetails from './StepDetails'
import StepExtraVenues from './StepExtraVenues'
import StepSuccess from './StepSuccess'
import StepCheckEmail from './StepCheckEmail'
import ProgressBar from './ProgressBar'
import { setTrialPlan } from '../../lib/api/billing'
import { suggestVenueSlug, setOwnerPin } from '../../lib/api/signup'
import SetPinForm from './SetPinForm'
import { IconLock } from './SignupIcons'
import useForceLight from '../../hooks/useForceLight'
import { reportError } from '../../lib/reportError'
import Button from '../../components/ui/Button'
import { HEADLINE } from './styles'

// Where the confirm-email link lands. The native app has no web address to
// come back to, so it uses the live site. Must be in Supabase Auth's
// allowed redirect URLs.
const SIGNUP_RETURN_URL = `${window.location.protocol.startsWith('http') ? window.location.origin : 'https://get-pelikn.com'}/signup`

// Key on the login's user_metadata holding the signup details until the
// email is confirmed and the venue is made.
const PENDING_KEY = 'pelikn_signup'

// Between details (1) and PIN (2): waiting for the email link.
const STEP_VERIFY = 'verify'

// steps: 0=plan, 1=details, 'verify'=check email, 2=owner PIN, 3=extraVenues (only if extraVenues>0), then success
export default function SignupFlowPage() {
  // Public page, drawn in light colours only (its page background has no dark
  // style, so dark mode's card and input overrides left dark boxes on cream).
  useForceLight()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(/** @type {number | 'verify'} */ (0))
  const [plan, setPlan] = useState(searchParams.get('plan') === 'starter' ? 'starter' : 'pro')
  const [extraVenues, setExtraVenues] = useState(0)
  const [qrAddon, setQrAddon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdVenueId, setCreatedVenueId] = useState('')
  const [createdSlug, setCreatedSlug] = useState('')
  const [createdName, setCreatedName] = useState('')
  const [allVenues, setAllVenues] = useState([])
  const [pendingEmail, setPendingEmail] = useState('')
  const [linkExpired, setLinkExpired] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [resumeAttempt, setResumeAttempt] = useState(0)

  const SUCCESS_STEP = extraVenues > 0 ? 4 : 3

  const handleSelectPlan = (p) => {
    setPlan(p)
    if (p !== 'pro') setExtraVenues(0)
  }

  // Step 1 submit: create the login only. The venue waits until the email is
  // confirmed (finishSignup), so nobody can spin up venues for addresses they
  // don't own. Everything typed here rides along in the login's metadata,
  // so the link works on any device.
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

      // If the lookup fails, migration 155 may not be applied yet. Stop here:
      // without it, creating a venue with no PIN would leave the owner with an
      // empty one. The URL is settled again when the venue is made.
      const slug = await suggestVenueSlug(wantedSlug)
      if (!slug) throw new Error("We couldn't finish setting up your venue address. Please try again in a moment.")

      const pending = { venueName, ownerName, slug, plan, extraVenues, qrAddon }

      // 1. Create Supabase Auth account. With "Confirm email" on there is no
      //    session yet; Supabase emails a link back to this page.
      const { data, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: SIGNUP_RETURN_URL, data: { [PENDING_KEY]: pending } },
      })
      if (authErr) throw new Error(authErr.message)
      // Supabase hides whether an address is taken: it answers as if it
      // worked but sends nothing. An empty identities list gives it away.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error('An account with this email already exists. Sign in instead, or reset your password from the sign-in page.')
      }

      if (data.session) {
        // "Confirm email" is still off in Supabase: carry straight on.
        await finishSignup(pending)
      } else {
        setPendingEmail(email)
        setStep(STEP_VERIFY)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // After the email is confirmed: create the primary venue, set the plan,
  // then on to the PIN. Runs once per signup (finishing guards against a
  // second run, and the pending details are cleared once the venue exists).
  const finishSignup = async (pending) => {
    // Settle the URL again: it may have been taken while the email sat unread.
    const slug = await suggestVenueSlug(pending.slug)
    if (!slug) throw new Error("We couldn't finish setting up your venue address. Please try again in a moment.")

    // The owner chooses their own PIN on the next step (migration 155), so
    // none is sent here.
    const { data: venueId, error: venueErr } = await supabase.rpc('create_venue_with_owner', {
      p_venue_name: pending.venueName,
      p_slug: slug,
      p_owner_name: pending.ownerName,
      p_owner_pin: '',
    })
    if (venueErr) throw new Error(venueErr.message)

    // Clear straight away so a reload can't make a second venue. If this
    // fails the venue still exists; a reload would then make another, so
    // report it rather than swallow it.
    const { error: clearErr } = await supabase.auth.updateUser({ data: { [PENDING_KEY]: null } })
    if (clearErr) reportError(clearErr, 'SignupFlowPage:clearPending')

    // Set the trial plan, QR add-on and extra venue count. Goes through
    // an RPC: venues has no client UPDATE policy, so a direct update
    // silently matched zero rows and every venue stayed on Starter.
    const { error: planErr } = await setTrialPlan(venueId, pending.plan, {
      qrAddon: pending.qrAddon,
      additionalVenues: pending.extraVenues,
    })
    if (planErr) console.warn('Could not set plan:', planErr.message)

    setPlan(pending.plan)
    setExtraVenues(pending.extraVenues)
    setQrAddon(pending.qrAddon)
    setCreatedVenueId(venueId)
    setCreatedSlug(slug)
    setCreatedName(pending.venueName)
    setAllVenues([{ name: pending.venueName, slug }])
    // Stay signed in: the PIN step needs the owner's session.
    setStep(2)
  }

  // Back from the email link (or signed in from /login with signup unfinished):
  // the session is in the URL, and the details are on the login.
  const finishing = useRef(false)
  useEffect(() => {
    // A dead link comes back with the error in the hash (or the query).
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    if (hash.get('error') || query.get('error')) {
      window.history.replaceState(null, '', window.location.pathname)
      setLinkExpired(true)
      setStep(STEP_VERIFY)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const pending = session?.user?.user_metadata?.[PENDING_KEY]
      if (cancelled || !pending || finishing.current) return
      finishing.current = true
      setResuming(true)
      try {
        await finishSignup(pending)
      } catch (err) {
        finishing.current = false
        setResumeError(err.message)
      } finally {
        setResuming(false)
      }
    })
    return () => { cancelled = true }
  }, [resumeAttempt])

  const handleResend = async (address) => {
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: address,
      options: { emailRedirectTo: SIGNUP_RETURN_URL },
    })
    return err ? err.message : null
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
        {!isSuccess && <ProgressBar step={step === STEP_VERIFY ? 1 : step} hasExtraVenues={extraVenues > 0} />}

        {(resuming || resumeError) ? (
          <div className="flex flex-col gap-8 w-full max-w-xl">
            <h1 className="text-charcoal" style={HEADLINE}>
              {resumeError ? "We couldn't set up your venue." : 'Email confirmed.'}
            </h1>
            {resumeError ? (
              <>
                <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4">
                  <p className="text-bad text-body-lg">{resumeError}</p>
                </div>
                <Button pill size="lg" className="self-start px-8" onClick={() => { setResumeError(''); setResumeAttempt(n => n + 1) }}>
                  Try again
                </Button>
              </>
            ) : (
              <p className="text-title-sm sm:text-title text-charcoal/75 leading-[1.4]">Setting up your venue…</p>
            )}
          </div>
        ) : <>
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
        {step === STEP_VERIFY && (
          <StepCheckEmail
            email={linkExpired ? '' : pendingEmail}
            expired={linkExpired}
            onResend={handleResend}
            onBack={linkExpired ? null : () => { setPendingEmail(''); setStep(1) }}
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
        </>}
      </div>
    </div>
  )
}
