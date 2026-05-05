import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'

export default function GettingStartedCard({ venueId, venueSlug }) {
  const [checklist, setChecklist] = useState(null)
  const [dismissed, setDismissed] = useState(null) // null = loading
  const { isEnabled } = useVenueFeatures()

  useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings')
      .select('key, value')
      .eq('venue_id', venueId)
      .in('key', ['setup_checklist', 'setup_dismissed'])
      .then(({ data }) => {
        const rows = data ?? []
        const cl = rows.find(r => r.key === 'setup_checklist')
        const dm = rows.find(r => r.key === 'setup_dismissed')
        try { setChecklist(cl?.value ? JSON.parse(cl.value) : {}) }
        catch { setChecklist({}) }
        setDismissed(dm?.value === 'true')
      })
  }, [venueId])

  // Listen for reopen event from settings page
  useEffect(() => {
    const handler = () => {
      supabase.from('app_settings').delete().eq('venue_id', venueId).eq('key', 'setup_dismissed').then(() => {})
      setDismissed(false)
    }
    window.addEventListener('pelikn:reopen-setup', handler)
    return () => window.removeEventListener('pelikn:reopen-setup', handler)
  }, [venueId])

  // Still loading (null = not yet fetched)
  if (checklist === null || dismissed === null || dismissed) return null

  const items = [
    { id: 'venue_type', label: 'Choose your venue type', link: `/v/${venueSlug}/setup`, done: !!checklist.venue_type },
    { id: 'staff',      label: 'Add your first staff member', link: `/v/${venueSlug}/settings`, done: !!checklist.staff },
    { id: 'fridge',     label: 'Record a fridge check', link: `/v/${venueSlug}/fridge/log`, done: !!checklist.fridge, show: isEnabled('fridge') },
    { id: 'rota',       label: 'Create this week\'s rota', link: `/v/${venueSlug}/rota`, done: !!checklist.rota, show: isEnabled('rota') },
    { id: 'cleaning',   label: 'Complete a cleaning check', link: `/v/${venueSlug}/cleaning`, done: !!checklist.cleaning, show: isEnabled('cleaning') },
  ].filter(item => item.show !== false)

  const allDone = items.every(i => i.done)
  if (allDone) return null

  const completed = items.filter(i => i.done).length

  return (
    <div className="bg-white rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-charcoal">Getting Started</p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">{completed} of {items.length} complete</p>
        </div>
        <button onClick={() => { supabase.from('app_settings').upsert({ venue_id: venueId, key: 'setup_dismissed', value: 'true' }).then(() => {}); setDismissed(true) }} className="text-charcoal/30 hover:text-charcoal/60 transition-colors text-xl leading-none">&times;</button>
      </div>
      <div className="h-1 bg-charcoal/8 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(completed / items.length) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <Link
            key={item.id}
            to={item.link}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${item.done ? 'bg-success/5' : 'hover:bg-charcoal/3'}`}
          >
            <span className={`${item.done ? 'text-success' : 'text-charcoal/20'}`}>{item.done ? <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4"/></svg>}</span>
            <span className={`text-sm ${item.done ? 'text-charcoal/40 line-through' : 'text-charcoal'}`}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
