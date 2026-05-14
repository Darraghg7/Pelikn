import React from 'react'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE, QR_ADDON_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
} from '../../lib/pricing'
import { IconCheck, IconQR, IconSpark, IconArrow, IconLock } from './SignupIcons'

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

export { STARTER_FEATURES, PRO_FEATURES }

export default function StepPlan({ selected, onSelect, extraVenues, onExtraVenues, qrAddon, onQrAddon, onNext }) {
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
                    {extraVenues === 0 ? 'Just 1 for now, add more later' : `${extraVenues + 1} venues · £${PRO_PRICE_NUM + extraVenues * EXTRA_VENUE_PRICE_NUM}/mo`}
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
