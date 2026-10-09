import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/reportError'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { CloseButton } from '../../components/ui/Button'

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
    ]).then((results) => {
      // A failed count would read as "step not done" and re-show finished
      // setup steps (or a dismissed card) — skip the card this time instead.
      const failed = results.find(r => r.error)
      if (failed) { reportError(failed.error, 'GettingStartedCard:progress'); return }
      const [settingsRes, staffRes, fridgesRes, cleaningRes, shiftsRes, foodRes] = results
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
      // Device-local state flips regardless; a failed write only affects other devices.
      supabase.from('app_settings').delete().eq('venue_id', venueId).eq('key', 'setup_dismissed')
        .then(({ error }) => { if (error) reportError(error, 'GettingStartedCard:reopen') })
      localStorage.removeItem(doneKey(venueId))
      setDismissed(false)
    }
    window.addEventListener('pelikn:reopen-setup', handler)
    return () => window.removeEventListener('pelikn:reopen-setup', handler)
  }, [venueId])

  if (checks === null || dismissed === null || dismissed) return null

  const items = [
    { id: 'venueType', label: 'Choose your venue type',      link: `/v/${venueSlug}/setup`,         done: checks.venueType },
    { id: 'hours',     label: 'Set your operating hours',    link: `/v/${venueSlug}/settings/venue`, done: checks.hours },
    { id: 'staff',     label: 'Add your first staff member', link: `/v/${venueSlug}/staff?staff=new`, done: checks.staff },
    { id: 'fridge',    label: 'Add a fridge',                link: `/v/${venueSlug}/fridge`,        done: checks.fridge,    show: isEnabled('fridge') },
    { id: 'cleaning',  label: 'Add cleaning tasks',          link: `/v/${venueSlug}/cleaning`,      done: checks.cleaning,  show: isEnabled('cleaning') },
    { id: 'rota',      label: "Create this week's rota",     link: `/v/${venueSlug}/rota`,          done: checks.rota,      show: isEnabled('rota') },
    { id: 'allergens', label: 'Add food items & allergens',  link: `/v/${venueSlug}/allergens`,     done: checks.allergens, show: isEnabled('allergens') },
  ].filter(item => item.show !== false)

  const completed = items.filter(i => i.done).length
  if (items.every(i => i.done)) return null

  const dismiss = () => {
    // Device-local state flips regardless; a failed write only affects other devices.
    supabase.from('app_settings').upsert({ venue_id: venueId, key: 'setup_dismissed', value: 'true' }, { onConflict: 'venue_id,key' })
      .then(({ error }) => { if (error) reportError(error, 'GettingStartedCard:dismiss') })
    localStorage.setItem(doneKey(venueId), 'true')
    setDismissed(true)
  }

  return (
    <div className="bg-white dark:bg-paperDark rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-charcoal dark:text-white">Getting Started</p>
          <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5">{completed} of {items.length} complete</p>
        </div>
        <CloseButton label="Dismiss" onClick={dismiss} />
      </div>
      <div className="h-1 bg-charcoal/8 dark:bg-white/8 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(completed / items.length) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-1">
        {items.map(item => (
          <Link
            key={item.id}
            to={item.link}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${item.done ? 'bg-success/5' : 'hover:bg-charcoal/3 dark:hover:bg-white/5'}`}
          >
            <span className={item.done ? 'text-success' : 'text-charcoal/20 dark:text-white/20'}>
              {item.done ? <CheckIcon /> : <CircleIcon />}
            </span>
            <span className={`text-sm ${item.done ? 'text-charcoal/40 dark:text-white/35 line-through' : 'text-charcoal dark:text-white'}`}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
