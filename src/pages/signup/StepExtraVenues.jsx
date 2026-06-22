import React, { useState } from 'react'
import { slugify } from '../../lib/utils'

export default function StepExtraVenues({ count, onBack, onSubmit, loading, error }) {
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
                placeholder="e.g. City Centre Branch"
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
                  placeholder="city-centre-branch"
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
