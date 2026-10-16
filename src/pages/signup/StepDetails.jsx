import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE, QR_ADDON_PRICE,
  STARTER_PRICE_NUM, PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM, QR_ADDON_PRICE_NUM,
} from '../../lib/pricing'
import { slugify } from '../../lib/utils'
import { suggestVenueSlug } from '../../lib/api/signup'
import { IconCheck } from './SignupIcons'
import { STARTER_FEATURES, PRO_FEATURES } from '../../lib/plans'
import Button from '../../components/ui/Button'
import { HEADLINE, LABEL, INPUT, HINT } from './styles'

export default function StepDetails({ plan, extraVenues, qrAddon, onBack, onSubmit, loading, error }) {
  const [form, setForm] = useState({
    venueName: '', ownerName: '', email: '', password: '',
  })
  const [slug, setSlug] = useState('')
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugNote, setSlugNote] = useState('')

  // The URL follows the venue name: first free address for it, so two
  // "The Star Inn" signups get the-star-inn and the-star-inn-2. Falls back to
  // the plain slug if the lookup is unavailable.
  useEffect(() => {
    if (editingSlug) return
    const base = slugify(form.venueName)
    if (!base) { setSlug(''); return }
    setSlug(base)
    const t = setTimeout(async () => {
      const free = await suggestVenueSlug(base)
      if (free) setSlug(free)
    }, 350)
    return () => clearTimeout(t)
  }, [form.venueName, editingSlug])

  // After a hand edit, make sure what they typed is free (or swap in the next one).
  const checkTypedSlug = async () => {
    const typed = slug.replace(/^-+|-+$/g, '')
    if (!typed) { setEditingSlug(false); setSlugNote(''); return }
    const free = await suggestVenueSlug(typed)
    if (free && free !== typed) { setSlug(free); setSlugNote(`"${typed}" is taken, so we've used "${free}".`) }
    else { setSlug(typed); setSlugNote('') }
  }

  const set = (key, value) => {
    setForm(prev => {
      return { ...prev, [key]: value }
    })
  }

  const basePrice  = plan === 'pro' ? PRO_PRICE_NUM : STARTER_PRICE_NUM
  const extraTotal = plan === 'pro' ? extraVenues * EXTRA_VENUE_PRICE_NUM : 0
  const monthly    = basePrice + extraTotal + (qrAddon ? QR_ADDON_PRICE_NUM : 0)

  const features = plan === 'pro' ? PRO_FEATURES : STARTER_FEATURES

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-12 lg:gap-16 w-full items-start">

      {/* Form */}
      <div className="min-w-0">
        <Button variant="ghost" size="sm" pill onClick={onBack} className="-ml-3 mb-8 group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Change plan
        </Button>

        <h2 className="text-charcoal mb-12" style={HEADLINE}>Your details.</h2>

        <form
          onSubmit={e => { e.preventDefault(); onSubmit({ ...form, slug: slug.toLowerCase() }) }}
          className="flex flex-col gap-10 max-w-xl"
        >
          {/* Venue */}
          <div>
            <label className={LABEL}>Your venue</label>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                required
                aria-label="Venue name"
                placeholder="Venue name (e.g. The Star Inn)"
                value={form.venueName}
                onChange={e => set('venueName', e.target.value)}
                className={INPUT}
              />
              <div className="px-1">
                {editingSlug ? (
                  <>
                    <div className="flex items-center h-14 rounded-control border border-charcoal/15 bg-paper overflow-hidden focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition-all">
                      <span className="px-5 text-body-sm text-charcoal/70 font-mono h-full flex items-center border-r border-charcoal/10 bg-cream shrink-0">get-pelikn.com/v/</span>
                      <input
                        type="text"
                        required
                        autoFocus
                        aria-label="Venue URL"
                        placeholder="your-venue"
                        value={slug}
                        onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugNote('') }}
                        onBlur={checkTypedSlug}
                        className="flex-1 min-w-0 h-full px-4 text-body-lg text-charcoal font-mono placeholder:text-charcoal/50 outline-none bg-transparent"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-body-sm text-charcoal/70 leading-relaxed">
                    {slug
                      ? <>Your staff will sign in at <span className="font-mono text-charcoal">get-pelikn.com/v/{slug}</span>{' '}</>
                      : 'Your staff sign-in address will appear here. '}
                    {slug && <Button variant="link" size="sm" onClick={() => setEditingSlug(true)}>Edit</Button>}
                  </p>
                )}
                {slugNote && <p className="text-body-sm text-charcoal/70 mt-2">{slugNote}</p>}
              </div>
            </div>
          </div>

          {/* Owner */}
          <div>
            <label className={LABEL}>Your profile</label>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                required
                aria-label="Your full name"
                placeholder="Your full name"
                value={form.ownerName}
                onChange={e => set('ownerName', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Account */}
          <div>
            <label className={LABEL}>Login details</label>
            <div className="flex flex-col gap-3">
              <input
                type="email"
                required
                aria-label="Email address"
                placeholder="Email address"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className={INPUT}
              />
              <div>
                <input
                  type="password"
                  required
                  minLength={6}
                  aria-label="Password"
                  placeholder="Password (min 6 characters)"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className={INPUT}
                />
                <p className={HINT}>Used to manage billing and account settings</p>
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4">
              <p className="text-bad text-body-lg">{error}</p>
            </div>
          )}

          <div>
            <Button
              pill
              size="lg"
              fullWidth
              type="submit"
              loading={loading}
            >
              {loading ? 'Creating your account…' : <>Create my account · £{monthly}/mo</>}
            </Button>

            <p className="text-body-sm text-charcoal/70 leading-relaxed mt-5 px-1">
              By creating an account you agree to our terms of service.
              {' '}Already have an account? <Link to="/login" className="text-brand font-medium underline underline-offset-2">Sign in</Link>
            </p>
          </div>
        </form>
      </div>

      {/* Order summary */}
      <div className="w-full lg:sticky lg:top-8">
        <div className="bg-brand text-cream rounded-sheet p-8 sm:p-10">
          <p className="font-mono text-micro tracking-[0.12em] uppercase text-cream/80 mb-8">Order summary</p>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-body-lg font-medium">{plan === 'pro' ? 'Pro' : 'Starter'} plan</p>
              <p className="text-body text-cream/75">per venue / month</p>
            </div>
            <p className="text-body-lg font-medium">{plan === 'pro' ? PRO_PRICE : STARTER_PRICE}</p>
          </div>

          {plan === 'pro' && extraVenues > 0 && (
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-body-lg font-medium">+{extraVenues} extra venue{extraVenues > 1 ? 's' : ''}</p>
                <p className="text-body text-cream/75">{EXTRA_VENUE_PRICE} × {extraVenues} / month</p>
              </div>
              <p className="text-body-lg font-medium">£{extraTotal}</p>
            </div>
          )}

          {qrAddon && (
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-body-lg font-medium">QR Table Cards</p>
                <p className="text-body text-cream/75">add-on / month</p>
              </div>
              <p className="text-body-lg font-medium">{QR_ADDON_PRICE}</p>
            </div>
          )}

          <div className="border-t border-cream/20 pt-6 mt-6 mb-8">
            <p className="text-body text-cream/75 mb-1">Total after trial</p>
            <p style={{ fontSize: 'clamp(40px, 4vw, 56px)', lineHeight: 0.95, letterSpacing: '-0.05em', fontWeight: 500 }}>£{monthly}<span className="text-title-sm text-cream/75 tracking-normal">/mo</span></p>
          </div>

          <div className="bg-cream/10 rounded-control px-5 py-4 mb-8">
            <p className="text-body-lg font-medium inline-flex items-center gap-2"><IconCheck size={14} /> 7-day free trial</p>
            <p className="text-body text-cream/80 mt-1 leading-[1.5]">No card needed today. Add one in Plan &amp; Billing whenever you're ready. You won't be charged until your trial ends.</p>
          </div>

          <div className="flex flex-col gap-3">
            {features.slice(0, 4).map(f => (
              <div key={f} className="flex items-start gap-3 text-body text-cream/85">
                <span className="mt-0.5 shrink-0 text-goodDark"><IconCheck size={14} /></span>
                {f}
              </div>
            ))}
            {features.length > 4 && (
              <p className="text-body text-cream/75 pl-7">+{features.length - 4} more features</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
