import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function usePPDSItems(venueId) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('ppds_items')
      .select('id, name, description, ingredients, may_contain_allergens, is_active')
      .eq('venue_id', venueId)
      .order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { items, loading, reload: load }
}

function AllergenSummary({ ingredients, mayContain }) {
  const inIngredients = ingredients?.filter(r => r.allergen).map(r => r.allergen) ?? []
  const unique        = [...new Set(inIngredients)]
  const mc            = mayContain ?? []

  if (unique.length === 0 && mc.length === 0) {
    return <span className="text-charcoal/30 italic">No allergens declared</span>
  }
  return (
    <span>
      {unique.length > 0 && <span className="text-charcoal/60">Contains: <strong className="font-medium text-charcoal/80">{unique.join(', ')}</strong></span>}
      {unique.length > 0 && mc.length > 0 && <span className="text-charcoal/30"> · </span>}
      {mc.length > 0 && <span className="text-amber-700">May contain: {mc.join(', ')}</span>}
    </span>
  )
}

export default function PPDSItemsPage() {
  const { venueId, venueSlug } = useVenue()
  const toast = useToast()
  const { items, loading, reload } = usePPDSItems(venueId)
  const [deleting, setDeleting] = useState(null)

  const toggleActive = async (item) => {
    const { error } = await supabase
      .from('ppds_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .eq('venue_id', venueId)
    if (error) { toast(error.message, 'error'); return }
    toast(item.is_active ? 'Item deactivated' : 'Item activated')
    reload()
  }

  const deleteItem = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return
    setDeleting(item.id)
    const { error } = await supabase
      .from('ppds_items')
      .delete()
      .eq('id', item.id)
      .eq('venue_id', venueId)
    setDeleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Item deleted')
    reload()
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-charcoal">PPDS Items</h1>
            <p className="text-sm text-charcoal/40 mt-0.5">Pre-packed for direct sale — Natasha's Law labels</p>
          </div>
          <Link
            to={`/v/${venueSlug}/allergens/ppds/new`}
            className="shrink-0 bg-charcoal text-cream px-4 py-2 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors"
          >
            + Add Item
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-charcoal/4 border border-charcoal/10 rounded-xl px-4 py-3">
        <p className="text-xs text-charcoal/60 leading-relaxed">
          <strong className="text-charcoal/80">Natasha's Law</strong> (in force since October 2021) requires all pre-packed for direct sale food — such as sandwiches, wraps, and pastries made and packaged on your premises — to carry a label with the product name, a full ingredient list, and all 14 allergens highlighted in bold.
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner size="md" /></div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-charcoal/35 font-medium">No PPDS items yet</p>
            <p className="text-xs text-charcoal/25 mt-1">Add any pre-packaged items — sandwiches, wraps, pastries, salads — that are made and packaged on your premises.</p>
            <Link
              to={`/v/${venueSlug}/allergens/ppds/new`}
              className="inline-block mt-4 bg-charcoal text-cream px-4 py-2 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors"
            >
              + Add First Item
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? 'border-t border-charcoal/6' : ''}`}
              >
                {/* Icon */}
                <div className="w-7 h-7 rounded-md bg-charcoal/8 flex items-center justify-center shrink-0 text-charcoal/40">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${item.is_active ? 'text-charcoal' : 'text-charcoal/35'}`}>
                    {item.name}
                  </p>
                  <p className="text-xs text-charcoal/40 truncate mt-0.5">
                    {item.ingredients?.filter(r => r.name?.trim()).length ?? 0} ingredient{(item.ingredients?.filter(r => r.name?.trim()).length ?? 0) !== 1 ? 's' : ''}
                    {' · '}
                    <AllergenSummary ingredients={item.ingredients} mayContain={item.may_contain_allergens} />
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <Link
                    to={`/v/${venueSlug}/allergens/ppds/${item.id}/label`}
                    className="text-xs text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-3 py-1.5 rounded-md hover:border-charcoal/30 transition-colors"
                  >
                    Label
                  </Link>
                  <Link
                    to={`/v/${venueSlug}/allergens/ppds/${item.id}/edit`}
                    className="text-xs text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-3 py-1.5 rounded-md hover:border-charcoal/30 transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deleteItem(item)}
                    disabled={deleting === item.id}
                    className="text-xs text-charcoal/30 hover:text-danger border border-charcoal/12 px-2.5 py-1.5 rounded-md hover:border-danger/30 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
