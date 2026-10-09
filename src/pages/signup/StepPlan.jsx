import React from 'react'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE, QR_ADDON_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
} from '../../lib/pricing'
import { IconCheck, IconQR, IconArrow, IconLock } from './SignupIcons'
import { STARTER_FEATURES, PRO_FEATURES, PLAN_DETAILS } from '../../lib/plans'
import Button from '../../components/ui/Button'

export default function StepPlan({ selected, onSelect, extraVenues, onExtraVenues, qrAddon, onQrAddon, onNext }) {
  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-4xl text-brand mb-2">Choose your plan</h1>
        <p className="text-sm text-charcoal/50 dark:text-white/40">Start with a 7-day free trial. No card required.</p>
      </div>

      {/* Plan cards — Starter then Pro, matching PLAN_ORDER (plans.test.ts checks) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Starter */}
        <button
          onClick={() => onSelect('starter')}
          className={`relative rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
            selected === 'starter'
              ? 'border-brand bg-brand/5 shadow-md shadow-brand/10'
              : 'border-charcoal/12 dark:border-white/15 bg-white dark:bg-paperDark hover:border-charcoal/25 dark:hover:border-white/25 hover:shadow-sm'
          }`}
        >
          {selected === 'starter' && (
            <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-brand flex items-center justify-center">
              <IconCheck size={12} color="white" />
            </span>
          )}
          <p className="text-micro tracking-widest uppercase font-semibold text-brand mb-2">{PLAN_DETAILS.starter.name}</p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-charcoal dark:text-white">{STARTER_PRICE}</span>
            <span className="text-charcoal/40 dark:text-white/35 text-sm">/month</span>
          </div>
          <p className="text-caption text-charcoal/40 dark:text-white/35 mb-4">{PLAN_DETAILS.starter.venueNote}</p>
          <p className="text-xs text-charcoal/50 dark:text-white/40 mb-4 leading-relaxed">
            Digital compliance essentials — everything you need to pass an EHO inspection.
          </p>
          <ul className="flex flex-col gap-2">
            {STARTER_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-charcoal/55 dark:text-white/45">
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
              : 'border-accent/30 bg-white dark:bg-paperDark hover:border-accent/50 hover:shadow-sm'
          }`}
        >
          {selected === 'pro' && (
            <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
              <IconCheck size={12} color="white" />
            </span>
          )}

          <p className="text-micro tracking-widest uppercase font-semibold text-accent mb-2">{PLAN_DETAILS.pro.name}</p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-accent">{PRO_PRICE}</span>
            <span className="text-charcoal/40 dark:text-white/35 text-sm">/month</span>
          </div>
          <p className="text-caption text-charcoal/40 dark:text-white/35 mb-4">{PLAN_DETAILS.pro.venueNote} · {EXTRA_VENUE_PRICE}/mo each additional</p>
          <p className="text-xs text-charcoal/50 dark:text-white/40 mb-4 leading-relaxed">
            Full compliance plus rota, timesheets, training records & team management — all in one place.
          </p>
          <ul className="flex flex-col gap-2">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className="flex items-start gap-2 text-xs text-charcoal/55 dark:text-white/45">
                <span className="text-accent mt-0.5 shrink-0"><IconCheck size={13} /></span>
                {i === 0 ? <strong className="text-charcoal/65 dark:text-white/55">{f}</strong> : f}
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
                  <p className="text-xs font-medium text-charcoal/70 dark:text-white/60">How many venues?</p>
                  <p className="text-caption text-charcoal/40 dark:text-white/35 mt-0.5">
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
            : 'border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark hover:border-charcoal/25 dark:hover:border-white/25'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${qrAddon ? 'bg-brand/10 text-brand' : 'bg-charcoal/6 dark:bg-white/8 text-charcoal/40 dark:text-white/35'}`}>
              <IconQR />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-charcoal dark:text-white">QR Table Cards</p>
                <span className="text-micro tracking-widest uppercase font-semibold text-brand bg-brand/8 px-2 py-0.5 rounded-full">Add-on</span>
              </div>
              <p className="text-xs text-charcoal/50 dark:text-white/40 leading-relaxed">
                Generate printable allergen QR cards for your tables. Customers scan to view your live allergen matrix — with your logo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-semibold text-charcoal dark:text-white">{QR_ADDON_PRICE}<span className="text-charcoal/40 dark:text-white/35 font-normal text-xs">/mo</span></p>
            </div>
            {/* Toggle */}
            <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${qrAddon ? 'bg-brand' : 'bg-charcoal/15 dark:bg-white/15'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white dark:bg-paperDark shadow transition-all duration-200 ${qrAddon ? 'left-5' : 'left-1'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Button
          size="lg"
          onClick={onNext}
        >
          Continue with {selected === 'pro' ? 'Pro' : 'Starter'}
          <IconArrow />
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-micro text-charcoal/35 dark:text-white/30 mt-3">
          <IconLock />
          <span>7-day free trial · No card required · Cancel any time</span>
        </div>
      </div>
    </div>
  )
}
