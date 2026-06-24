import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { EU_ALLERGENS } from '../../lib/constants'

const EMPTY_INGREDIENT = { name: '', allergen: null }

export default function PPDSItemFormPage() {
  const { id }              = useParams()
  const isEdit              = !!id
  const navigate            = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const toast               = useToast()

  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [ingredients, setIngredients] = useState([{ ...EMPTY_INGREDIENT }])
  const [mayContain, setMayContain] = useState([])
  const [loading, setLoading]     = useState(isEdit)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (!isEdit || !venueId) return
    supabase
      .from('ppds_items')
      .select('*')
      .eq('id', id)
      .eq('venue_id', venueId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { toast('Item not found', 'error'); navigate(`/v/${venueSlug}/allergens/ppds`); return }
        setName(data.name)
        setDesc(data.description ?? '')
        setIngredients(data.ingredients?.length ? data.ingredients : [{ ...EMPTY_INGREDIENT }])
        setMayContain(data.may_contain_allergens ?? [])
        setLoading(false)
      })
  }, [id, venueId, isEdit]) // eslint-disable-line

  // ── Ingredient list helpers ──────────────────────────────────────────────────

  const setIngr = (idx, field, val) =>
    setIngredients(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))

  const addIngredient = () => setIngredients(prev => [...prev, { ...EMPTY_INGREDIENT }])

  const removeIngredient = (idx) =>
    setIngredients(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))

  const moveUp = (idx) => {
    if (idx === 0) return
    setIngredients(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx) => {
    setIngredients(prev => {
      if (idx === prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const toggleMayContain = (a) =>
    setMayContain(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  // ── Save ─────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!name.trim()) { toast('Product name is required', 'error'); return }
    const clean = ingredients.filter(r => r.name.trim())
    if (clean.length === 0) { toast('Add at least one ingredient', 'error'); return }
    setSaving(true)

    const payload = {
      venue_id:              venueId,
      name:                  name.trim(),
      description:           description.trim() || null,
      ingredients:           clean,
      may_contain_allergens: mayContain,
      updated_at:            new Date().toISOString(),
      is_active:             true,
    }

    const { error } = isEdit
      ? await supabase.from('ppds_items').update(payload).eq('id', id).eq('venue_id', venueId)
      : await supabase.from('ppds_items').insert(payload)

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? 'PPDS item updated' : 'PPDS item created')
    navigate(`/v/${venueSlug}/allergens/ppds`)
  }

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/v/${venueSlug}/allergens/ppds`} className="text-charcoal/40 hover:text-charcoal transition-colors text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-charcoal">{isEdit ? 'Edit PPDS Item' : 'New PPDS Item'}</h1>
          <p className="text-xs text-charcoal/40 mt-0.5">Pre-packed for direct sale — Natasha's Law</p>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Product name <span className="text-danger">*</span></label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Chicken Caesar Wrap"
            className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Description (optional)</label>
          <input
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder="e.g. Available daily — freshly prepared on premises"
            className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
      </div>

      {/* Ingredient builder */}
      <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Ingredients</p>
            <p className="text-xs text-charcoal/35 mt-0.5">In descending order by weight. Tick the allergen if one applies.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {ingredients.map((row, idx) => (
            <div key={idx} className="flex items-start gap-2">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="w-5 h-5 flex items-center justify-center text-charcoal/25 hover:text-charcoal disabled:opacity-20 transition-colors"
                  title="Move up"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2,8 6,4 10,8"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === ingredients.length - 1}
                  className="w-5 h-5 flex items-center justify-center text-charcoal/25 hover:text-charcoal disabled:opacity-20 transition-colors"
                  title="Move down"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2,4 6,8 10,4"/></svg>
                </button>
              </div>

              {/* Ingredient name */}
              <input
                value={row.name}
                onChange={e => setIngr(idx, 'name', e.target.value)}
                placeholder={`Ingredient ${idx + 1}`}
                className="flex-1 px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />

              {/* Allergen selector */}
              <select
                value={row.allergen ?? ''}
                onChange={e => setIngr(idx, 'allergen', e.target.value || null)}
                className={`px-2 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-charcoal/20 ${
                  row.allergen
                    ? 'border-amber-300 bg-amber-50 text-amber-800 font-medium'
                    : 'border-charcoal/15 bg-white text-charcoal/40'
                }`}
                style={{ minWidth: '100px' }}
              >
                <option value="">No allergen</option>
                {EU_ALLERGENS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeIngredient(idx)}
                disabled={ingredients.length === 1}
                className="mt-1 w-7 h-7 flex items-center justify-center text-charcoal/25 hover:text-danger transition-colors disabled:opacity-20 shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addIngredient}
          className="self-start text-xs text-accent hover:text-accent/70 transition-colors font-medium"
        >
          + Add ingredient
        </button>

        {/* Live preview */}
        {ingredients.some(r => r.name.trim()) && (
          <div className="bg-charcoal/3 rounded-lg px-4 py-3 border border-charcoal/8">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-1">Label preview</p>
            <p className="text-xs text-charcoal/70 leading-relaxed font-sans">
              <span className="font-bold">INGREDIENTS: </span>
              {ingredients
                .filter(r => r.name.trim())
                .map((r, i, arr) => (
                  <React.Fragment key={i}>
                    {r.allergen
                      ? <strong className="font-bold underline">{r.name.trim()}</strong>
                      : <span>{r.name.trim()}</span>
                    }
                    {i < arr.length - 1 ? ', ' : '.'}
                  </React.Fragment>
                ))
              }
            </p>
          </div>
        )}
      </div>

      {/* May Contain */}
      <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-3">
        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">May Contain</p>
          <p className="text-xs text-charcoal/35 mt-0.5">Cross-contamination risks — select any that apply to your kitchen environment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EU_ALLERGENS.map(a => {
            const sel = mayContain.includes(a)
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleMayContain(a)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  sel
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-charcoal/15 text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal'
                }`}
              >
                {a}
              </button>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3">
        <Link
          to={`/v/${venueSlug}/allergens/ppds`}
          className="px-5 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create PPDS Item'}
        </button>
      </div>
    </div>
  )
}
