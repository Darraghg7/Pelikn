import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,6 5,9 10,3"/>
  </svg>
)

const CircleIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="4"/>
  </svg>
)

// Once setup is complete or dismissed the card never shows again, so remember
// that locally and skip all six progress queries on subsequent visits.
const doneKey = (venueId) => `pelikn_setup_card_done_${venueId}`

export default function GettingStartedCard({ venueId, venueSlug }) {
  const [checks, setChecks] = useState(null)
  const [dismissed, setDismissed] = useState(() =>
    venueId && localStorage.getItem(doneKey(venueId)) === 'true' ? true : null
  )
  const { isEnabled } = useVenueFeatures()

  useEffect(() => {
    if (!venueId) return
    if (localStorage.getItem(doneKey(venueId)) === 'true') return

    const today = new Date().toISOString().slice(0, 10)
    const weekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      const diff = d.getDate() - (day === 0 ? 6 : day - 1)
      d.setDate(diff)
      return d.toISOString().slice(0, 10)
    })()

    Promise.all([
      supabase.from('app_settings').select('key, value').eq('venue_id', venueId).in('key', ['setup_dismissed', 'venue_type', 'open_time']),
      supabase.from('staff').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('is_active', true),
      supabase.from('fridges').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
      supabase.from('cleaning_tasks').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
      supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).gte('shift_date', weekStart),
      supabase.from('food_items').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
    ]).then(([settingsRes, staffRes, fridgesRes, cleaningRes, shiftsRes, foodRes]) => {
      const rows = settingsRes.data ?? []
      const dismissed = rows.find(r => r.key === 'setup_dismissed')?.value === 'true'
      const hasVenueType = !!rows.find(r => r.key === 'venue_type')?.value
      const hasHours = !!rows.find(r => r.key === 'open_time')?.value

      const nextChecks = {
        venueType:     hasVenueType,
        hours:         hasHours,
        staff:         (staffRes.count ?? 0) > 0,
        fridge:        (fridgesRes.count ?? 0) > 0,
        cleaning:      (cleaningRes.count ?? 0) > 0,
        rota:          (shiftsRes.count ?? 0) > 0,
        allergens:     (foodRes.count ?? 0) > 0,
      }
      // Dismissed, or every step done regardless of feature gating — the card
      // will never show again, so skip these queries from now on.
      if (dismissed || Object.values(nextChecks).every(Boolean)) {
        localStorage.setItem(doneKey(venueId), 'true')
      }
      setDismissed(dismissed)
      setChecks(nextChecks)
    })
  }, [venueId])

  useEffect(() => {
    const handler = () => {
      supabase.from('app_settings').delete().eq('venue_id', venueId).eq('key', 'setup_dismissed').then(() => {})
      localStorage.removeItem(doneKey(venueId))
      setDismissed(false)
    }
    window.addEventListener('pelikn:reopen-setup', handler)
    return () => window.removeEventListener('pelikn:reopen-setup', handler)
  }, [venueId])

  if (checks === null || dismissed === null || dismissed) return null

  const items = [
    { id: 'venueType', label: 'Choose your venue type',      link: `/v/${venueSlug}/setup`,         done: checks.venueType },
    { id: 'hours',     label: 'Set your operating hours',    link: `/v/${venueSlug}/settings`,      done: checks.hours },
    { id: 'staff',     label: 'Add your first staff member', link: `/v/${venueSlug}/settings`,      done: checks.staff },
    { id: 'fridge',    label: 'Add a fridge',                link: `/v/${venueSlug}/settings`,      done: checks.fridge,    show: isEnabled('fridge') },
    { id: 'cleaning',  label: 'Add cleaning tasks',          link: `/v/${venueSlug}/settings`,      done: checks.cleaning,  show: isEnabled('cleaning') },
    { id: 'rota',      label: "Create this week's rota",     link: `/v/${venueSlug}/rota`,          done: checks.rota,      show: isEnabled('rota') },
    { id: 'allergens', label: 'Add food items & allergens',  link: `/v/${venueSlug}/allergens`,     done: checks.allergens, show: isEnabled('allergens') },
  ].filter(item => item.show !== false)

  const completed = items.filter(i => i.done).length
  if (items.every(i => i.done)) return null

  const dismiss = () => {
    supabase.from('app_settings').upsert({ venue_id: venueId, key: 'setup_dismissed', value: 'true' }, { onConflict: 'venue_id,key' }).then(() => {})
    localStorage.setItem(doneKey(venueId), 'true')
    setDismissed(true)
  }

  return (
    <div className="bg-white rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-charcoal">Getting Started</p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">{completed} of {items.length} complete</p>
        </div>
        <button onClick={dismiss} className="text-charcoal/30 hover:text-charcoal/60 transition-colors text-xl leading-none">&times;</button>
      </div>
      <div className="h-1 bg-charcoal/8 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(completed / items.length) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-1">
        {items.map(item => (
          <Link
            key={item.id}
            to={item.link}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${item.done ? 'bg-success/5' : 'hover:bg-charcoal/3'}`}
          >
            <span className={item.done ? 'text-success' : 'text-charcoal/20'}>
              {item.done ? <CheckIcon /> : <CircleIcon />}
            </span>
            <span className={`text-sm ${item.done ? 'text-charcoal/40 line-through' : 'text-charcoal'}`}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
