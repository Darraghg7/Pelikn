import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFoodItems } from '../../hooks/useFoodItems'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] tracking-widest uppercase text-charcoal/40">{children}</p>
      {action}
    </div>
  )
}

export default function AllergenRegistryPage() {
  const [search, setSearch] = useState('')
  const { items, loading, reload } = useFoodItems(search)
  const { venueId, venueSlug } = useVenue()
  const { isManager } = useSession()
  const toast         = useToast()
  const navigate      = useNavigate()
  const [deleting, setDeleting]   = useState(null)
  const [showQR, setShowQR]       = useState(false)

  const publicUrl = `${window.location.origin}/allergens/${venueSlug}`

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl text-brand">Allergen Checklists</h1>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 w-full sm:w-48"
        />
      </div>

      {/* QR code panel — manager only */}
      {isManager && venueSlug && (
        <div className="bg-white rounded-xl border border-charcoal/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Customer Allergen QR Code</p>
              <p className="text-xs text-charcoal/45 mt-0.5">Customers can scan this to see your live allergen matrix — no login required.</p>
            </div>
            <button
              onClick={() => setShowQR(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/55 hover:text-charcoal hover:border-charcoal/30 transition-colors shrink-0 ml-4"
            >
              {showQR ? 'Hide QR' : 'Show QR'}
            </button>
          </div>
          {showQR && (
            <div className="mt-4 flex flex-col sm:flex-row items-start gap-5">
              <div className="p-3 bg-white rounded-xl border border-charcoal/10 shadow-sm">
                <QRCodeSVG value={publicUrl} size={140} />
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/35">Public URL</p>
                <p className="text-xs font-mono text-charcoal/60 break-all bg-charcoal/4 px-3 py-2 rounded-lg">{publicUrl}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(publicUrl); toast('URL copied') }}
                  className="self-start text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/55 hover:text-charcoal hover:border-charcoal/30 transition-colors"
                >
                  Copy URL
                </button>
                <p className="text-[11px] text-charcoal/35 mt-1">Print or display the QR code at your counter or on menus. It updates automatically when you edit allergen information.</p>
              </div>
            </div>
          )}
        </div>
      )}

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
