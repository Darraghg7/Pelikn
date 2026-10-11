import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useFoodItem, useFoodItemActions } from '../../hooks/useFoodItems'
import { EU_ALLERGENS } from '../../lib/constants'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import Button from '../../components/ui/Button'

function SectionLabel({ children }) {
  return <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">{children}</p>
}

export default function FoodItemFormPage() {
  const { id }   = useParams()
  const isEdit   = Boolean(id)
  const navigate = useNavigate()
  const toast    = useToast()
  const { venueSlug } = useVenue()
  const { session } = useSession()

  const { item, loading } = useFoodItem(id)
  const foodItems = useFoodItemActions()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [allergens, setAllergens]     = useState([])
  const [mayContain, setMayContain]   = useState([])
  const [verbalNote, setVerbalNote]   = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setDescription(item.description ?? '')
      setAllergens(item.food_allergens?.map((a) => a.allergen) ?? [])
      setMayContain(item.may_contain_allergens ?? [])
      setVerbalNote(item.verbal_confirmation_note ?? '')
    }
  }, [item])

  const toggleAllergen = (a) =>
    setAllergens((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    )

  const toggleMayContain = (a) =>
    setMayContain((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    if (isEdit) {
      // Allergen information: a "may contain" list that silently didn't save
      // is a food-safety problem, so never say "updated" unless it did.
      try {
        const { mayContainFailed } = await foodItems.update(id, {
          sessionToken: session?.token, name, description, allergens, mayContain, verbalNote,
        })
        if (mayContainFailed) {
          toast('Allergens saved, but "may contain" and the verbal note did not — please try again', 'error')
          setSubmitting(false)
          return
        }
      } catch (err) { toast(err.message, 'error'); setSubmitting(false); return }
      toast('Item updated')
      navigate(`/v/${venueSlug}/allergens/${id}`)
    } else {
      try {
        const { allergensFailed } = await foodItems.create({ name, description, allergens, mayContain, verbalNote })
        if (allergensFailed) { toast('Item saved but allergens could not be recorded — please edit the item to add them', 'error'); setSubmitting(false); return }
      } catch (err) { toast(err.message, 'error'); setSubmitting(false); return }
      toast('Item added')
      navigate(`/v/${venueSlug}/allergens`)
    }
    setSubmitting(false)
  }

  if (isEdit && loading) return <PageSkeleton />

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      <div className="flex items-center gap-4">
        <Link
          to={isEdit ? `/v/${venueSlug}/allergens/${id}` : `/v/${venueSlug}/allergens`}
          className="text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white transition-colors text-lg"
        >
          ←
        </Link>
        <h1 className="text-2xl font-bold text-charcoal dark:text-white">
          {isEdit ? 'Edit Dish' : 'Add New Dish'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-white dark:bg-paperDark rounded-card border-charcoal/10 dark:border-white/10 p-5 flex flex-col gap-4">
          <SectionLabel>Dish Details</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Caesar Salad"
              required
              className="w-full px-4 py-2.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-charcoal dark:text-white placeholder-charcoal/25 dark:placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-charcoal dark:text-white placeholder-charcoal/25 dark:placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 resize-none"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-paperDark rounded-card border-charcoal/10 dark:border-white/10 p-5">
          <SectionLabel>Contains (select all that apply)</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {EU_ALLERGENS.map((a) => (
              <label
                key={a}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 rounded-control border cursor-pointer transition-all text-sm',
                  allergens.includes(a)
                    ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                    : 'bg-white dark:bg-paperDark text-charcoal dark:text-white border-charcoal/12 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30',
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

        <div className="bg-white dark:bg-paperDark rounded-card border-charcoal/10 dark:border-white/10 p-5 flex flex-col gap-4">
          <div>
            <SectionLabel>May Contain — cross-contamination risk</SectionLabel>
            <p className="text-xs text-charcoal/40 dark:text-white/35 mb-3 -mt-1">
              Allergens that may be present due to shared equipment or preparation areas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EU_ALLERGENS.map((a) => (
                <label
                  key={a}
                  className={[
                    'flex items-center gap-3 px-4 py-2.5 rounded-control border cursor-pointer transition-all text-sm',
                    mayContain.includes(a)
                      ? 'bg-warning/10 text-warning border-warning/40'
                      : 'bg-white dark:bg-paperDark text-charcoal dark:text-white border-charcoal/12 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={mayContain.includes(a)}
                    onChange={() => toggleMayContain(a)}
                  />
                  <span className="font-medium">{a}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35">
              Verbal Guidance Note (optional)
            </label>
            <input
              value={verbalNote}
              onChange={(e) => setVerbalNote(e.target.value)}
              placeholder="e.g. Please inform staff before ordering if you have a nut allergy"
              className="w-full px-4 py-2.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-charcoal dark:text-white placeholder-charcoal/25 dark:placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
        </div>

        <Button
          fullWidth
          loading={submitting}
          type="submit"
          disabled={submitting || !name.trim()}
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes →' : 'Add Dish →'}
        </Button>
      </form>
    </div>
  )
}
