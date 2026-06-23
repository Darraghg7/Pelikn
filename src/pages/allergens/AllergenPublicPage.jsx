import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ALL_ALLERGENS = [
  'Celery', 'Gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin',
  'Milk', 'Molluscs', 'Mustard', 'Tree Nuts', 'Peanuts', 'Sesame',
  'Soya', 'Sulphur Dioxide',
]

export default function AllergenPublicPage() {
  const { venueSlug }  = useParams()
  const [venue, setVenue]   = useState(null)
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!venueSlug) return
    let channel = null
    let cancelled = false

    const load = async () => {
      // Look up venue by slug
      const { data: venueData, error: venueErr } = await supabase
        .from('venues')
        .select('id, name')
        .eq('slug', venueSlug)
        .single()

      if (venueErr || !venueData) {
        setError('Venue not found.')
        setLoading(false)
        return
      }
      // Fetch logo and food items in parallel
      const [{ data: settingsData }, { data: foodItems }] = await Promise.all([
        supabase
          .from('app_settings')
          .select('value')
          .eq('venue_id', venueData.id)
          .eq('key', 'logo_url')
          .maybeSingle(),
        supabase
          .from('food_items')
          .select('id, name, description, may_contain_allergens, verbal_confirmation_note, food_allergens(allergen)')
          .eq('venue_id', venueData.id)
          .eq('is_active', true)
          .order('name'),
      ])

      if (!cancelled) {
        setVenue({ ...venueData, logo_url: settingsData?.value ?? null })
        setItems(foodItems ?? [])
        setLoading(false)
      }

      if (!channel) {
        channel = supabase
          .channel(`public-allergens:${venueData.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'food_items',
            filter: `venue_id=eq.${venueData.id}`,
          }, () => load())
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'food_allergens',
            filter: `venue_id=eq.${venueData.id}`,
          }, () => load())
          .subscribe()
      }
    }
    load()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [venueSlug])

  if (loading) return (
    <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center">
      <p className="text-sm text-charcoal/40">Loading allergen information…</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center">
      <p className="text-sm text-charcoal/40">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f4f1]">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          {venue?.logo_url && (
            <img
              src={venue.logo_url}
              alt={venue.name}
              className="h-14 w-auto object-contain mb-5"
              loading="lazy"
            />
          )}
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Allergen Information</p>
          <h1 className="text-3xl font-bold text-[#1a3c2e]">{venue?.name}</h1>
          <p className="text-sm text-charcoal/50 mt-2">
            The 14 major allergens are listed below. <span className="font-semibold text-amber-700">If you have a severe allergy, please speak with a member of staff before ordering.</span>
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border-charcoal/10 px-6 py-8 text-center">
            <p className="text-sm text-charcoal/40">No allergen information available yet.</p>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="flex flex-col gap-4 lg:hidden">
              {items.map(item => {
                const allergenSet  = new Set((item.food_allergens ?? []).map(a => a.allergen))
                const mayContainSet = new Set((item.may_contain_allergens ?? []))
                return (
                  <div key={item.id} className="bg-white rounded-2xl border-charcoal/10 px-5 py-4">
                    <p className="font-semibold text-charcoal mb-1">{item.name}</p>
                    {item.description && <p className="text-xs text-charcoal/45 mb-3">{item.description}</p>}
                    {allergenSet.size === 0 && mayContainSet.size === 0 ? (
                      <p className="text-xs text-charcoal/35 italic">No allergens declared</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {allergenSet.size > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {[...allergenSet].sort().map(a => (
                              <span key={a} className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{a}</span>
                            ))}
                          </div>
                        )}
                        {mayContainSet.size > 0 && (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] tracking-widest uppercase text-charcoal/35 font-medium">May contain:</span>
                            {[...mayContainSet].sort().map(a => (
                              <span key={a} className="text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {item.verbal_confirmation_note && (
                      <p className="text-xs text-charcoal/45 italic mt-2 border-t border-charcoal/6 pt-2">{item.verbal_confirmation_note}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop: matrix table */}
            <div className="hidden lg:block bg-white rounded-2xl border-charcoal/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1a3c2e] text-white">
                      <th className="text-left px-4 py-3 font-semibold min-w-[160px]">Item</th>
                      {ALL_ALLERGENS.map(a => (
                        <th key={a} className="px-2 py-3 font-semibold whitespace-nowrap" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: 90 }}>
                          {a}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const allergenSet   = new Set((item.food_allergens ?? []).map(a => a.allergen))
                      const mayContainSet = new Set((item.may_contain_allergens ?? []))
                      return (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f5f4f1]'}>
                          <td className="px-4 py-2.5 font-medium text-charcoal">{item.name}</td>
                          {ALL_ALLERGENS.map(a => (
                            <td key={a} className="px-2 py-2.5 text-center">
                              {allergenSet.has(a) ? (
                                <span title="Contains" className="inline-flex w-4 h-4 rounded-sm bg-amber-400 text-white items-center justify-center"><svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>
                              ) : mayContainSet.has(a) ? (
                                <span title="May contain" className="inline-flex w-4 h-4 rounded-sm bg-amber-100 border border-amber-300 text-amber-600 items-center justify-center text-[9px] font-bold">M</span>
                              ) : (
                                <span className="text-charcoal/15">–</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Legend */}
              <div className="px-4 py-3 border-t border-charcoal/6 flex items-center gap-5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex w-4 h-4 rounded-sm bg-amber-400 text-white items-center justify-center"><svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>
                  <span className="text-[11px] text-charcoal/50">Contains</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex w-4 h-4 rounded-sm bg-amber-100 border border-amber-300 text-amber-600 items-center justify-center text-[9px] font-bold">M</span>
                  <span className="text-[11px] text-charcoal/50">May contain (cross-contamination risk)</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center flex flex-col gap-1">
          <p className="text-xs text-charcoal/50 font-medium">
            If you have a severe or life-threatening allergy, please speak directly with a member of staff before ordering.
          </p>
          <p className="text-[11px] text-charcoal/30">
            Allergen information is updated regularly but may change. Always check with staff when visiting.
          </p>
          <p className="text-[11px] text-charcoal/20 mt-1">Powered by Pelikn</p>
        </div>
      </div>
    </div>
  )
}
