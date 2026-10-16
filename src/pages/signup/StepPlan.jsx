import React from 'react'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE, QR_ADDON_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
} from '../../lib/pricing'
import { IconCheck, IconQR, IconArrow, IconLock } from './SignupIcons'
import { STARTER_FEATURES, PRO_FEATURES, PLAN_DETAILS } from '../../lib/plans'
import Button from '../../components/ui/Button'
import { HEADLINE } from './styles'

const PRICE = { fontSize: 'clamp(56px, 6vw, 88px)', lineHeight: 0.9, letterSpacing: '-0.055em', fontWeight: 500 }

// A card that behaves as one radio option. A div, not a <button>, because the
// Pro card holds its own buttons (the venue stepper) and buttons can't nest.
function PlanCard({ id, selected, onSelect, dark = false, children }) {
  const on = selected === id
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(id) } }}
      className={`relative rounded-sheet p-8 sm:p-10 text-left cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-cream ${
        dark ? 'bg-brand text-cream' : 'bg-paper text-charcoal'
      } ${on ? 'ring-2 ring-charcoal ring-offset-4 ring-offset-cream' : 'opacity-90 hover:opacity-100'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          on ? (dark ? 'bg-cream text-brand' : 'bg-charcoal text-cream') : (dark ? 'border border-cream/40' : 'border border-charcoal/25')
        }`}
      >
        {on && <IconCheck size={14} />}
      </span>
      {children}
    </div>
  )
}

export default function StepPlan({ selected, onSelect, extraVenues, onExtraVenues, qrAddon, onQrAddon, onNext }) {
  return (
    <div className="flex flex-col gap-10 w-full">
      <div>
        <h1 className="text-charcoal" style={HEADLINE}>Choose your plan.</h1>
        <p className="text-title-sm sm:text-title text-charcoal/75 mt-6 max-w-md leading-[1.4]">Start with a 7-day free trial. No card required.</p>
      </div>

      {/* Plan cards — Starter then Pro, matching PLAN_ORDER (plans.test.ts checks) */}
      <div role="radiogroup" aria-label="Plan" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Starter */}
        <PlanCard id="starter" selected={selected} onSelect={onSelect}>
          <p className="font-mono text-micro tracking-[0.12em] uppercase text-charcoal/70 mb-8">{PLAN_DETAILS.starter.name}</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span style={PRICE}>{STARTER_PRICE}</span>
            <span className="text-charcoal/70 text-title-sm">/month</span>
          </div>
          <p className="text-body-lg text-charcoal/75">{PLAN_DETAILS.starter.venueNote}</p>
          <p className="text-body-lg text-charcoal/75 leading-[1.5] border-y border-charcoal/12 py-5 my-8">
            Digital compliance essentials. Everything you need to pass an EHO inspection.
          </p>
          <ul className="flex flex-col gap-3">
            {STARTER_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-3 text-body-lg text-charcoal/80">
                <span className="text-good mt-1 shrink-0"><IconCheck size={15} /></span>
                {f}
              </li>
            ))}
          </ul>
        </PlanCard>

        {/* Pro */}
        <PlanCard id="pro" selected={selected} onSelect={onSelect} dark>
          <p className="font-mono text-micro tracking-[0.12em] uppercase text-cream/80 mb-8">{PLAN_DETAILS.pro.name}</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span style={PRICE}>{PRO_PRICE}</span>
            <span className="text-cream/75 text-title-sm">/month</span>
          </div>
          <p className="text-body-lg text-cream/80">{PLAN_DETAILS.pro.venueNote} · {EXTRA_VENUE_PRICE}/mo each additional</p>
          <p className="text-body-lg text-cream/80 leading-[1.5] border-y border-cream/20 py-5 my-8">
            Full compliance plus rota, timesheets, training records and team management, all in one place.
          </p>
          <ul className="flex flex-col gap-3">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className="flex items-start gap-3 text-body-lg text-cream/85">
                <span className="text-goodDark mt-1 shrink-0"><IconCheck size={15} /></span>
                {i === 0 ? <strong className="font-semibold text-cream">{f}</strong> : f}
              </li>
            ))}
          </ul>

          {/* Extra venues stepper — only shown when Pro is selected */}
          {selected === 'pro' && (
            <div className="mt-8 pt-6 border-t border-cream/20" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-body-lg font-medium">How many venues?</p>
                  <p className="text-body text-cream/75 mt-0.5">
                    {extraVenues === 0 ? 'Just 1 for now, add more later' : `${extraVenues + 1} venues · £${PRO_PRICE_NUM + extraVenues * EXTRA_VENUE_PRICE_NUM}/mo`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onExtraVenues(Math.max(0, extraVenues - 1))}
                    className="w-11 h-11 rounded-full border border-cream/40 text-cream hover:bg-cream/10 flex items-center justify-center text-title-sm font-medium transition-colors"
                    aria-label="Remove venue"
                  >−</button>
                  <span className="w-6 text-center text-title-sm font-medium tabular-nums">{extraVenues + 1}</span>
                  <button
                    type="button"
                    onClick={() => onExtraVenues(Math.min(9, extraVenues + 1))}
                    className="w-11 h-11 rounded-full border border-cream/40 text-cream hover:bg-cream/10 flex items-center justify-center text-title-sm font-medium transition-colors"
                    aria-label="Add venue"
                  >+</button>
                </div>
              </div>
            </div>
          )}
        </PlanCard>
      </div>

      {/* QR Add-on */}
      <div
        role="switch"
        aria-checked={qrAddon}
        aria-label="QR Table Cards add-on"
        tabIndex={0}
        onClick={() => onQrAddon(!qrAddon)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onQrAddon(!qrAddon) } }}
        className={`rounded-sheet bg-paper p-6 sm:p-8 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-cream ${qrAddon ? 'ring-2 ring-charcoal ring-offset-4 ring-offset-cream' : ''}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors ${qrAddon ? 'bg-brand text-cream' : 'bg-cream text-charcoal/70'}`}>
              <IconQR />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <p className="text-title font-medium tracking-[-0.025em]">QR Table Cards</p>
                <span className="font-mono text-micro tracking-[0.12em] uppercase font-semibold text-brand bg-brand/8 px-3 py-1 rounded-full">Add-on</span>
              </div>
              <p className="text-body-lg text-charcoal/75 leading-[1.5] max-w-xl">
                Generate printable allergen QR cards for your tables. Customers scan to view your live allergen matrix, with your logo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <p className="text-body-lg font-medium whitespace-nowrap">{QR_ADDON_PRICE}<span className="text-charcoal/70 font-normal">/mo</span></p>
            <div aria-hidden="true" className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${qrAddon ? 'bg-brand' : 'bg-charcoal/20'}`}>
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-paper shadow transition-all duration-200 ${qrAddon ? 'left-6' : 'left-1'}`} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Button pill size="lg" onClick={onNext} className="px-8">
          Continue with {selected === 'pro' ? 'Pro' : 'Starter'}
          <IconArrow />
        </Button>
        <div className="flex items-center gap-2 text-body-sm text-charcoal/70 mt-5">
          <IconLock />
          <span>7-day free trial · No card required · Cancel any time</span>
        </div>
      </div>
    </div>
  )
}
