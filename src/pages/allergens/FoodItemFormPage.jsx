import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useFoodItem } from '../../hooks/useFoodItems'
import { EU_ALLERGENS } from '../../lib/constants'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

export default function FoodItemFormPage() {
  const { id }   = useParams()
  const isEdit   = Boolean(id)
  const navigate = useNavigate()
  const toast    = useToast()

  const { item, loading } = useFoodItem(id)

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [allergens, setAllergens]     = useState([])
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setDescription(item.description ?? '')
      setAllergens(item.food_allergens?.map((a) => a.allergen) ?? [])
    }
  }, [item])

  const toggleAllergen = (a) =>
    setAllergens((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    if (isEdit) {
      const { error: itemErr } = await supabase
        .from('food_items')
        .update({ name, description: description || null, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (itemErr) { toast(itemErr.message, 'error'); setSubmitting(false); return }
      await supabase.from('food_allergens').delete().eq('food_item_id', id)
      if (allergens.length > 0) {
        await supabase.from('food_allergens').insert(
          allergens.map((a) => ({ food_item_id: id, allergen: a }))
        )
      }
      toast('Item updated')
      navigate(`/allergens/${id}`)
    } else {
      const { data: newItem, error: itemErr } = await supabase
        .from('food_items')
        .insert({ name, description: description || null })
        .select()
        .single()
      if (itemErr) { toast(itemErr.message, 'error'); setSubmitting(false); return }
      if (allergens.length > 0) {
        await supabase.from('food_allergens').insert(
          allergens.map((a) => ({ food_item_id: newItem.id, allergen: a }))
        )
      }
      toast('Item added')
      navigate('/allergens')
    }
    setSubmitting(false)
  }

  if (isEdit && loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      <div className="flex items-center gap-4">
        <Link
          to={isEdit ? `/allergens/${id}` : '/allergens'}
          className="text-charcoal/40 hover:text-charcoal transition-colors text-lg"
        >
          ←
        </Link>
        <h1 className="font-serif text-3xl text-charcoal">
          {isEdit ? 'Edit Dish' : 'Add New Dish'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
          <SectionLabel>Dish Details</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Caesar Salad"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-charcoal placeholder-charcoal/25 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-charcoal placeholder-charcoal/25 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Allergens (select all that apply)</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {EU_ALLERGENS.map((a) => (
              <label
                key={a}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm',
                  allergens.includes(a)
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-cream/30 text-charcoal border-charcoal/12 hover:border-charcoal/30',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={allergens.includes(a)}
                  onChange={() => toggleAllergen(a)}
                />
                <span className="font-medium">{a}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes →' : 'Add Dish →'}
        </button>
      </form>
    </div>
  )
}
