import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { VENUE_PRESETS } from '../../lib/constants'

const VENUE_TYPE_ICONS = {
  cafe:       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  pub:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M3 11h14v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 11V7"/><path d="M11 11V7"/><path d="M5 7h10l-1-4H6z"/></svg>,
  restaurant: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  hotel:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
}

export default function VenueTypeIndicator({ venueId, venueSlug }) {
  const [venueType, setVenueType] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', 'venue_type').maybeSingle()
      .then(({ data }) => { if (data?.value) setVenueType(data.value) })
  }, [venueId])

  const reopenSetup = useCallback(() => {
    localStorage.removeItem('pelikn_setup_dismissed')
    window.dispatchEvent(new Event('pelikn:reopen-setup'))
    navigate(`/v/${venueSlug}/setup`)
  }, [venueSlug, navigate])

  const preset = VENUE_PRESETS.find(p => p.id === venueType)

  return (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand/5 border border-brand/15">
      {preset ? (
        <>
          <span className="text-lg">{VENUE_TYPE_ICONS[preset.icon] ?? ''}</span>
          <span className="text-sm font-medium text-brand">{preset.label}</span>
        </>
      ) : (
        <span className="text-sm text-charcoal/50">No venue type set</span>
      )}
      <button
        onClick={reopenSetup}
        className="text-[11px] text-brand/60 hover:text-brand transition-colors ml-auto underline underline-offset-2"
      >
        Re-run setup wizard
      </button>
    </div>
  )
}
