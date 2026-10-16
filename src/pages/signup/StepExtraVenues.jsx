import React, { useState } from 'react'
import { slugify } from '../../lib/utils'
import Button from '../../components/ui/Button'
import { HEADLINE, LABEL, INPUT } from './styles'

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
    <div className="flex flex-col gap-8 w-full max-w-xl">
      <Button variant="ghost" size="sm" pill onClick={onBack} className="self-start -ml-3 group">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </Button>

      <div>
        <h2 className="text-charcoal" style={HEADLINE}>Name your venues.</h2>
        <p className="text-title-sm sm:text-title text-charcoal/75 mt-6 leading-[1.4]">Set a name and URL for each additional venue.</p>
      </div>

      <div className="flex flex-col gap-5">
        {venues.map((v, i) => (
          <div key={i} className="p-6 sm:p-8 rounded-sheet bg-paper flex flex-col gap-5">
            <p className="font-mono text-micro tracking-[0.12em] uppercase text-charcoal/70">Venue {i + 2}</p>
            <div>
              <label className={LABEL}>Venue name *</label>
              <input
                value={v.name}
                onChange={e => updateVenue(i, 'name', e.target.value)}
                placeholder="e.g. City Centre Branch"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>URL slug *</label>
              <div className="flex items-center h-14 rounded-control border border-charcoal/15 bg-paper overflow-hidden focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition-all">
                <span className="px-5 text-body-sm text-charcoal/70 font-mono h-full flex items-center border-r border-charcoal/10 bg-cream shrink-0">/v/</span>
                <input
                  value={v.slug}
                  onChange={e => updateVenue(i, 'slug', e.target.value)}
                  placeholder="city-centre-branch"
                  aria-label={`Venue ${i + 2} URL slug`}
                  className="flex-1 min-w-0 h-full px-4 text-body-lg text-charcoal font-mono placeholder:text-charcoal/50 outline-none bg-transparent"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4">
          <p className="text-bad text-body-lg">{error}</p>
        </div>
      )}

      <Button
        pill
        size="lg"
        fullWidth
        onClick={() => onSubmit(venues)}
        disabled={!allFilled}
        loading={loading}
      >
        {loading ? 'Creating venues…' : <>Create all venues →</>}
      </Button>
    </div>
  )
}
