import React, { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE, QR_ADDON_PRICE,
  STARTER_PRICE_NUM, PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM, QR_ADDON_PRICE_NUM,
} from '../../lib/pricing'
import { slugify } from '../../lib/utils'

/* ── Icons ────────────────────────────────────────────────────────────────── */
function IconCheck({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function IconQR() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" /><path d="M17 17h4" /><path d="M21 14v3" /><path d="M14 21h7" />
    </svg>
  )
}
function IconSpark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

/* ── Feature lists ────────────────────────────────────────────────────────── */
const STARTER_FEATURES = [
  'Temperature logs (fridge, cooking, hot holding)',
  'Cleaning schedules & records',
  'Allergen registry (Natasha\'s Law)',
  'Delivery checks & probe calibration',
  'Opening & closing checklists',
  'Pest control & corrective actions',
  'EHO audit-ready compliance reports',
]
const PRO_FEATURES = [
  'Everything in Starter',
  'Rota & shift management with AI builder',
  'Timesheets & payroll CSV export',
  'Staff training records & expiry alerts',
  'Clock in / out & time off management',
  'HACCP generator & EHO Mock Inspection',
  'Supplier orders & waste logging',
  'Unlimited staff · multi-venue',
]

/* ── Step 1: Plan Selection ───────────────────────────────────────────────── */
function StepPlan({ selected, onSelect, extraVenues, onExtraVenues, qrAddon, onQrAddon, onNext }) {
  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-4xl text-brand mb-2">Choose your plan</h1>
        <p className="text-sm text-charcoal/50">Start with a 7-day free trial. No card required.</p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Starter */}
        <button
          onClick={() => onSelect('starter')}
          className={`relative rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
            selected === 'starter'
              ? 'border-brand bg-brand/5 shadow-md shadow-brand/10'
              : 'border-charcoal/12 bg-white hover:border-charcoal/25 hover:shadow-sm'
          }`}
        >
          {selected === 'starter' && (
            <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-brand flex items-center justify-center">
              <IconCheck size={12} color="white" />
            </span>
          )}
          <p className="text-[10px] tracking-widest uppercase font-semibold text-brand mb-2">Starter</p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-charcoal">{STARTER_PRICE}</span>
            <span className="text-charcoal/40 text-sm">/month</span>
          </div>
          <p className="text-[11px] text-charcoal/40 mb-4">per venue</p>
          <p className="text-xs text-charcoal/50 mb-4 leading-relaxed">
            Digital compliance essentials — everything you need to pass an EHO inspection.
          </p>
          <ul className="flex flex-col gap-2">
            {STARTER_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-charcoal/55">
                <span className="text-success mt-0.5 shrink-0"><IconCheck size={13} /></span>
                {f}
              </li>
            ))}
          </ul>
        </button>

        {/* Pro */}
        <button
          onClick={() => onSelect('pro')}
          className={`relative rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
            selected === 'pro'
              ? 'border-accent bg-accent/5 shadow-md shadow-accent/15'
              : 'border-accent/30 bg-white hover:border-accent/50 hover:shadow-sm'
          }`}
        >
          {/* Most popular badge */}
          <div className="absolute -top-3 left-0 right-0 flex justify-center">
            <span className="inline-flex items-center gap-1 bg-accent text-cream text-[10px] tracking-widest uppercase font-semibold px-3 py-0.5 rounded-full">
              <IconSpark />
              Most Popular
            </span>
          </div>

          {selected === 'pro' && (
            <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
              <IconCheck size={12} color="white" />
            </span>
          )}

          <p className="text-[10px] tracking-widest uppercase font-semibold text-accent mb-2 mt-2">Pro</p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-accent">{PRO_PRICE}</span>
            <span className="text-charcoal/40 text-sm">/month</span>
          </div>
          <p className="text-[11px] text-charcoal/40 mb-4">first venue · {EXTRA_VENUE_PRICE}/mo each additional</p>
          <p className="text-xs text-charcoal/50 mb-4 leading-relaxed">
            Full compliance plus rota, timesheets, training records & team management — all in one place.
          </p>
          <ul className="flex flex-col gap-2">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className="flex items-start gap-2 text-xs text-charcoal/55">
                <span className="text-accent mt-0.5 shrink-0"><IconCheck size={13} /></span>
                {i === 0 ? <strong className="text-charcoal/65">{f}</strong> : f}
              </li>
            ))}
          </ul>

          {/* Extra venues stepper — only shown when Pro is selected */}
          {selected === 'pro' && (
            <div
              className="mt-4 pt-4 border-t border-accent/15"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-charcoal/70">How many venues?</p>
                  <p className="text-[11px] text-charcoal/40 mt-0.5">
                    {extraVenues === 0 ? 'Just 1 for now — add more later' : `${extraVenues + 1} venues · £${PRO_PRICE_NUM + extraVenues * EXTRA_VENUE_PRICE_NUM}/mo`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onExtraVenues(Math.max(0, extraVenues - 1))}
                    className="w-7 h-7 rounded-lg border border-accent/25 text-accent/60 hover:border-accent/50 hover:text-accent flex items-center justify-center text-sm font-bold transition-colors"
                    aria-label="Remove venue"
                  >−</button>
                  <span className="w-6 text-center text-sm font-semibold text-accent tabular-nums">
                    {extraVenues + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExtraVenues(Math.min(9, extraVenues + 1))}
                    className="w-7 h-7 rounded-lg border border-accent/25 text-accent/60 hover:border-accent/50 hover:text-accent flex items-center justify-center text-sm font-bold transition-colors"
                    aria-label="Add venue"
                  >+</button>
                </div>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* QR Add-on */}
      <div
        onClick={() => onQrAddon(!qrAddon)}
        className={`rounded-xl border-2 p-5 cursor-pointer transition-all duration-200 ${
          qrAddon
            ? 'border-brand bg-brand/5 shadow-sm'
            : 'border-charcoal/10 bg-white hover:border-charcoal/25'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${qrAddon ? 'bg-brand/10 text-brand' : 'bg-charcoal/6 text-charcoal/40'}`}>
              <IconQR />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-charcoal">QR Table Cards</p>
                <span className="text-[10px] tracking-widest uppercase font-semibold text-brand bg-brand/8 px-2 py-0.5 rounded-full">Add-on</span>
              </div>
              <p className="text-xs text-charcoal/50 leading-relaxed">
                Generate printable allergen QR cards for your tables. Customers scan to view your live allergen matrix — with your logo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-semibold text-charcoal">{QR_ADDON_PRICE}<span className="text-charcoal/40 font-normal text-xs">/mo</span></p>
            </div>
            {/* Toggle */}
            <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${qrAddon ? 'bg-brand' : 'bg-charcoal/15'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${qrAddon ? 'left-5' : 'left-1'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 bg-brand text-cream px-8 py-3.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          Continue with {selected === 'pro' ? 'Pro' : 'Starter'}
          <IconArrow />
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-charcoal/35 mt-3">
          <IconLock />
          <span>7-day free trial · No card required · Cancel anytime</span>
        </div>
      </div>
    </div>
  )
}

/* ── Step 2: Details ──────────────────────────────────────────────────────── */
function StepDetails({ plan, extraVenues, qrAddon, onBack, onSubmit, loading, error }) {
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
                placeholder="Venue name (e.g. The Corner Café)"
                value={form.venueName}
                onChange={e => set('venueName', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
              />
              <div>
                <div className="flex items-center rounded-xl border border-charcoal/15 bg-white overflow-hidden focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10 transition-all">
                  <span className="px-3 text-xs text-charcoal/35 font-mono border-r border-charcoal/10 py-3 bg-charcoal/3 shrink-0">safeserv.app/v/</span>
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
              <>Create my account — £{monthly}/mo</>
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

/* ── Step 2b: Additional Venue Names (only when extraVenues > 0) ──────────── */
function StepExtraVenues({ count, onBack, onSubmit, loading, error }) {
  const [venues, setVenues] = useState(() =>
    Array.from({ length: count }, () => ({ name: '', slug: '', slugEdited: false }))
  )

  const updateVenue = (i, field, value) => {
    setVenues(prev => prev.map((v, idx) => {
      if (idx !== i) return v
      if (field === 'name') {
        return { ...v, name: value, slug: v.slugEdited ? v.slug : slugify(value) }
      }
      if (field === 'slug') {
        return { ...v, slug: value.toLowerCase().replace(/[^a-z0-9-]/g, ''), slugEdited: true }
      }
      return v
    }))
  }

  const allFilled = venues.every(v => v.name.trim() && v.slug.trim())

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-charcoal/40 hover:text-charcoal transition-colors group w-fit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>

      <div>
        <h2 className="text-xl font-bold sm:text-3xl text-brand mb-1">Name your venues</h2>
        <p className="text-sm text-charcoal/50">Set a name and URL for each additional venue.</p>
      </div>

      <div className="flex flex-col gap-5">
        {venues.map((v, i) => (
          <div key={i} className="p-4 rounded-2xl bg-white border border-charcoal/10 flex flex-col gap-3">
            <p className="text-xs font-semibold text-charcoal/60 tracking-widest uppercase">Venue {i + 2}</p>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Venue Name *</label>
              <input
                value={v.name}
                onChange={e => updateVenue(i, 'name', e.target.value)}
                placeholder="e.g. Nomad City Centre"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">URL Slug *</label>
              <div className="flex items-center rounded-lg border border-charcoal/15 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand/20">
                <span className="pl-3 text-xs text-charcoal/30 whitespace-nowrap font-mono">/v/</span>
                <input
                  value={v.slug}
                  onChange={e => updateVenue(i, 'slug', e.target.value)}
                  placeholder="nomad-city-centre"
                  className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
          <p className="text-danger text-xs">{error}</p>
        </div>
      )}

      <button
        onClick={() => onSubmit(venues)}
        disabled={loading || !allFilled}
        className="w-full bg-accent text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
            Creating venues…
          </>
        ) : (
          <>Create All Venues →</>
        )}
      </button>
    </div>
  )
}

/* ── Step 3: Success ──────────────────────────────────────────────────────── */
function StepSuccess({ venueName, venueSlug, plan, allVenues = [] }) {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(`/v/${venueSlug}`)
    }, 6000)
    return () => clearTimeout(timer)
  }, [venueSlug, navigate])

  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-6">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-success/8 border-4 border-success/20 flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">You're all set!</h1>
        <p className="text-sm text-charcoal/50 leading-relaxed">
          {allVenues.length > 1
            ? `${allVenues.length} venues are ready on SafeServ.`
            : <><strong className="text-charcoal">{venueName}</strong> is ready on SafeServ.</>
          }
          {' '}Your 7-day free trial has started — no payment needed yet.
        </p>
      </div>

      {/* Plan badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border ${
        plan === 'pro'
          ? 'bg-accent/10 text-accent border-accent/20'
          : 'bg-success/8 text-brand border-success/30'
      }`}>
        <IconSpark />
        {plan === 'pro' ? 'Pro Plan' : 'Starter Plan'} · 7-day free trial
      </div>

      {/* Venue URL(s) */}
      {allVenues.length > 1 ? (
        <div className="w-full bg-charcoal/4 rounded-xl px-4 py-3 flex flex-col gap-2">
          <p className="text-[11px] text-charcoal/40 tracking-widest uppercase mb-1">Your staff login URLs</p>
          {allVenues.map(v => (
            <div key={v.slug} className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-charcoal/70 truncate">{v.name}</p>
              <p className="text-xs font-mono text-charcoal/50 shrink-0">safeserv.app/v/{v.slug}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full bg-charcoal/4 rounded-xl px-4 py-3">
          <p className="text-[11px] text-charcoal/40 tracking-widest uppercase mb-1">Your staff login URL</p>
          <p className="text-xs font-mono text-charcoal/60">safeserv.app/v/{venueSlug}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => navigate(`/v/${venueSlug}`)}
          className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors flex items-center justify-center gap-2"
        >
          Go to your dashboard
          <IconArrow />
        </button>
        <p className="text-[11px] text-charcoal/35">Redirecting automatically in a few seconds…</p>
      </div>
    </div>
  )
}

/* ── Progress indicator ───────────────────────────────────────────────────── */
function ProgressBar({ step, hasExtraVenues }) {
  const steps = hasExtraVenues
    ? ['Choose plan', 'Your details', 'Name venues', 'All done']
    : ['Choose plan', 'Your details', 'All done']
  // Map UI step to progress bar index
  // 0=plan, 1=details, 2=extraVenues (if applicable), 3=success
  // Without extra venues: 0=plan, 1=details, 2=success → map step 2→2
  const barStep = hasExtraVenues ? step : step
  return (
    <div className="flex items-center gap-0 max-w-sm mx-auto mb-10">
      {steps.map((label, i) => {
        const active = i === barStep
        const done = i < barStep
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                done ? 'bg-brand text-cream'
                : active ? 'bg-brand text-cream ring-4 ring-brand/20'
                : 'bg-charcoal/10 text-charcoal/35'
              }`}>
                {done ? <IconCheck size={13} color="white" /> : i + 1}
              </div>
              <span className={`text-[10px] tracking-wide whitespace-nowrap transition-colors ${active ? 'text-brand font-medium' : 'text-charcoal/35'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px flex-1 mx-1 mb-4 transition-colors ${done ? 'bg-brand' : 'bg-charcoal/10'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
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
            SafeServ
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
