import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE, QR_ADDON_PRICE,
  STARTER_PRICE_NUM, PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM, QR_ADDON_PRICE_NUM,
} from '../../lib/pricing'
import { slugify } from '../../lib/utils'
import { IconCheck } from './SignupIcons'
import { STARTER_FEATURES, PRO_FEATURES } from './StepPlan'

export default function StepDetails({ plan, extraVenues, qrAddon, onBack, onSubmit, loading, error }) {
  const [form, setForm] = useState({
    venueName: '', ownerName: '', email: '', password: '', pin: '',
  })
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  const set = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'venueName' && !slugEdited) {
        setSlug(slugify(value))
      }
      return next
    })
  }

  const basePrice  = plan === 'pro' ? PRO_PRICE_NUM : STARTER_PRICE_NUM
  const extraTotal = plan === 'pro' ? extraVenues * EXTRA_VENUE_PRICE_NUM : 0
  const monthly    = basePrice + extraTotal + (qrAddon ? QR_ADDON_PRICE_NUM : 0)

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-4xl mx-auto items-start">

      {/* Form */}
      <div className="flex-1 min-w-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-charcoal/40 hover:text-charcoal mb-6 transition-colors group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Change plan
        </button>

        <h2 className="text-xl font-bold sm:text-3xl text-brand mb-6">Your details</h2>

        <form
          onSubmit={e => { e.preventDefault(); onSubmit({ ...form, slug: slug.toLowerCase() }) }}
          className="flex flex-col gap-5"
        >
          {/* Venue */}
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Your Venue</label>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                required
                placeholder="Venue name (e.g. The Star Inn)"
                value={form.venueName}
                onChange={e => set('venueName', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
              />
              <div>
                <div className="flex items-center rounded-xl border border-charcoal/15 bg-white overflow-hidden focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10 transition-all">
                  <span className="px-3 text-xs text-charcoal/35 font-mono border-r border-charcoal/10 py-3 bg-charcoal/3 shrink-0">pelikn.app/v/</span>
                  <input
                    type="text"
                    required
                    placeholder="your-venue"
                    value={slug}
                    onChange={e => { setSlug(e.target.value.replace(/[^a-z0-9-]/g, '')); setSlugEdited(true) }}
                    className="flex-1 px-3 py-3 text-sm text-charcoal font-mono placeholder:text-charcoal/30 outline-none bg-white"
                  />
                </div>
                <p className="text-[11px] text-charcoal/30 mt-1 px-1">Your staff will use this URL to log in</p>
              </div>
            </div>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Your Profile</label>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                required
                placeholder="Your full name"
                value={form.ownerName}
                onChange={e => set('ownerName', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
              />
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  minLength={4}
                  maxLength={6}
                  placeholder="Staff PIN (4-6 digits)"
                  value={form.pin}
                  onChange={e => set('pin', e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/30 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                />
                <p className="text-[11px] text-charcoal/30 mt-1 px-1">Used by you and your staff to log into the app</p>
              </div>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Login Details</label>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                required
                placeholder="Email address"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password (min 6 characters)"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
              />
              <p className="text-[11px] text-charcoal/30 px-1">Used to manage billing and account settings</p>
            </div>
          </div>

          {error && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
              <p className="text-danger text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                Creating your account…
              </>
            ) : (
              <>Create my account · £{monthly}/mo</>
            )}
          </button>

          <p className="text-center text-[11px] text-charcoal/35 leading-relaxed">
            By creating an account you agree to our terms of service.<br />
            Already have an account? <Link to="/login" className="text-brand hover:underline">Sign in</Link>
          </p>
        </form>
      </div>

      {/* Order summary — desktop sidebar */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="bg-white rounded-2xl border border-charcoal/10 p-5 sticky top-6">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-4">Order Summary</p>

          {/* Plan */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-charcoal">{plan === 'pro' ? 'Pro' : 'Starter'} Plan</p>
              <p className="text-[11px] text-charcoal/40">per venue / month</p>
            </div>
            <p className="text-sm font-semibold text-charcoal">{plan === 'pro' ? PRO_PRICE : STARTER_PRICE}</p>
          </div>

          {/* Extra venues */}
          {plan === 'pro' && extraVenues > 0 && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-charcoal">+{extraVenues} extra venue{extraVenues > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-charcoal/40">{EXTRA_VENUE_PRICE} × {extraVenues} / month</p>
              </div>
              <p className="text-sm font-semibold text-charcoal">£{extraTotal}</p>
            </div>
          )}

          {/* QR Add-on */}
          {qrAddon && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-charcoal">QR Table Cards</p>
                <p className="text-[11px] text-charcoal/40">add-on / month</p>
              </div>
              <p className="text-sm font-semibold text-charcoal">{QR_ADDON_PRICE}</p>
            </div>
          )}

          <div className="border-t border-charcoal/8 pt-3 mt-1 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-charcoal">Total after trial</p>
              <p className="text-sm font-semibold text-charcoal">£{monthly}/mo</p>
            </div>
          </div>

          {/* Trial badge */}
          <div className="bg-success/8 border border-success/20 rounded-xl px-4 py-3 mb-3">
            <p className="text-xs text-brand font-medium inline-flex items-center gap-1"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> 7-day free trial</p>
            <p className="text-[11px] text-brand/60 mt-0.5">No card required today. You'll only be charged after your trial ends.</p>
          </div>

          {/* Feature highlights */}
          <div className="flex flex-col gap-1.5 mt-3">
            {(plan === 'pro' ? PRO_FEATURES : STARTER_FEATURES).slice(0, 4).map(f => (
              <div key={f} className="flex items-start gap-2 text-[11px] text-charcoal/50">
                <span className={`mt-0.5 shrink-0 ${plan === 'pro' ? 'text-accent' : 'text-success'}`}>
                  <IconCheck size={12} />
                </span>
                {f}
              </div>
            ))}
            {(plan === 'pro' ? PRO_FEATURES : STARTER_FEATURES).length > 4 && (
              <p className="text-[11px] text-charcoal/35 pl-4">
                +{(plan === 'pro' ? PRO_FEATURES : STARTER_FEATURES).length - 4} more features
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
