import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFoodItem } from '../../hooks/useFoodItems'
import { useSession } from '../../contexts/SessionContext'
import { EU_ALLERGENS } from '../../lib/constants'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">{children}</p>
}

const ALLERGEN_COLORS = {
  Gluten: 'bg-amber-50 border-amber-200 text-amber-800',
  Eggs: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  Fish: 'bg-blue-50 border-blue-200 text-blue-800',
  Milk: 'bg-sky-50 border-sky-200 text-sky-800',
  Peanuts: 'bg-orange-50 border-orange-200 text-orange-800',
  Sesame: 'bg-amber-50 border-amber-200 text-amber-800',
  Soya: 'bg-green-50 border-green-200 text-green-800',
  Crustaceans: 'bg-red-50 border-red-200 text-red-800',
  Molluscs: 'bg-purple-50 border-purple-200 text-purple-800',
  Celery: 'bg-lime-50 border-lime-200 text-lime-800',
  Mustard: 'bg-yellow-50 border-yellow-100 text-yellow-700',
  'Tree Nuts': 'bg-orange-50 border-orange-200 text-orange-700',
  'Sulphur Dioxide': 'bg-gray-50 border-gray-200 text-gray-700',
  Lupin: 'bg-violet-50 border-violet-200 text-violet-700',
}

export default function FoodItemDetailPage() {
  const { id }     = useParams()
  const { item, loading } = useFoodItem(id)
  const { isManager }     = useSession()
  const { venueId, venueSlug } = useVenue()
  const toast             = useToast()
  const navigate          = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allergens   = item?.food_allergens?.map((a) => a.allergen) ?? []
  const mayContain  = item?.may_contain_allergens ?? []
  const verbalNote  = item?.verbal_confirmation_note ?? null
  const absent      = EU_ALLERGENS.filter((a) => !allergens.includes(a) && !mayContain.includes(a))

  const handleDelete = async () => {
    const { error } = await supabase
      .from('food_items')
      .update({ is_active: false })
      .eq('id', id)
      .eq('venue_id', venueId)
    if (error) { toast(error.message, 'error'); return }
    toast('Item removed')
    navigate(`/v/${venueSlug}/allergens`)
  }

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  if (!item)   return <div className="pt-10 text-center text-charcoal/40 dark:text-white/35 text-sm">Item not found.</div>

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      <ConfirmDialog
        open={confirmDelete}
        title="Delete item?"
        message={`Delete "${item.name}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); handleDelete() }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/v/${venueSlug}/allergens`} className="text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white transition-colors text-lg">←</Link>
          <h1 className="text-2xl font-bold text-charcoal dark:text-white">{item.name}</h1>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Link
              to={`/v/${venueSlug}/allergens/${id}/edit`}
              className="text-xs text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white border border-charcoal/15 dark:border-white/15 px-3 py-1.5 rounded-lg hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-danger/70 hover:text-danger border border-danger/20 px-3 py-1.5 rounded-lg hover:border-danger/40 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {item.description && (
        <p className="text-charcoal/60 dark:text-white/50 text-sm">{item.description}</p>
      )}

      {/* Contains */}
      <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 p-5">
        <SectionLabel>Contains</SectionLabel>
        {allergens.length === 0 ? (
          <p className="text-sm text-charcoal/35 dark:text-white/30 italic">No allergens declared.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allergens.map((a) => (
              <span
                key={a}
                className={['inline-block px-3 py-1 rounded-full text-xs font-medium border', ALLERGEN_COLORS[a] ?? 'bg-charcoal/8 dark:bg-white/8 border-charcoal/15 dark:border-white/15 text-charcoal dark:text-white'].join(' ')}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* May Contain */}
      {mayContain.length > 0 && (
        <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 p-5">
          <SectionLabel>May Contain — cross-contamination risk</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {mayContain.map((a) => (
              <span key={a} className="inline-block px-3 py-1 rounded-full text-xs font-medium border bg-amber-50 border-amber-200 text-amber-800">
                {a}
              </span>
            ))}
          </div>
          {verbalNote && (
            <p className="mt-3 text-xs text-charcoal/50 dark:text-white/40 italic">{verbalNote}</p>
          )}
        </div>
      )}

      {/* Does not contain */}
      <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 p-5">
        <SectionLabel>Does not contain</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {absent.map((a) => (
            <span key={a} className="inline-block px-3 py-1 rounded-full text-xs text-charcoal/30 dark:text-white/30 bg-charcoal/4 dark:bg-white/5 border border-charcoal/8 dark:border-white/8">
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
