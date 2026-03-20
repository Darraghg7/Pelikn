import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFoodItems } from '../../hooks/useFoodItems'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10px] tracking-widest uppercase text-charcoal/40">{children}</p>
      {action}
    </div>
  )
}

export default function AllergenRegistryPage() {
  const [search, setSearch] = useState('')
  const { items, loading, reload } = useFoodItems(search)
  const { venueId }   = useVenue()
  const { isManager } = useSession()
  const toast         = useToast()
  const navigate     = useNavigate()
  const [deleting, setDeleting] = useState(null)

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return
    setDeleting(id)
    const { error } = await supabase.from('food_items').update({ is_active: false }).eq('id', id).eq('venue_id', venueId)
    setDeleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Item removed')
    reload()
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Allergen Checklists</h1>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 w-36 sm:w-48"
        />
      </div>

      <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
        <div className="px-5 pt-5">
          <SectionLabel
            action={
              isManager && (
                <Link
                  to="/allergens/new"
                  className="bg-charcoal text-cream px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-charcoal/90 transition-colors"
                >
                  + Add Dish
                </Link>
              )
            }
          >
            Menu Items
          </SectionLabel>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-charcoal/35 italic py-10 pb-8">
            {search ? 'No items match your search.' : 'No menu items yet. Add your first dish.'}
          </p>
        ) : (
          <div className="flex flex-col">
            {items.map((item) => {
              const allergens = item.food_allergens?.map((a) => a.allergen) ?? []
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-3.5 border-t border-charcoal/6 hover:bg-cream/30 transition-colors"
                >
                  {/* Icon placeholder */}
                  <div className="w-7 h-7 rounded-md bg-charcoal/8 flex items-center justify-center text-sm shrink-0">
                    🍽
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-charcoal text-sm">{item.name}</p>
                    <p className="text-xs text-charcoal/40 truncate mt-0.5">
                      {allergens.length === 0
                        ? 'No allergens'
                        : allergens.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/allergens/${item.id}`}
                      className="text-xs text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-2.5 py-1 rounded-md hover:border-charcoal/30 transition-colors"
                    >
                      View
                    </Link>
                    {isManager && (
                      <>
                        <Link
                          to={`/allergens/${item.id}/edit`}
                          className="text-xs text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-2.5 py-1 rounded-md hover:border-charcoal/30 transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="text-xs text-charcoal/35 hover:text-danger border border-charcoal/12 px-2 py-1 rounded-md hover:border-danger/30 transition-colors"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
