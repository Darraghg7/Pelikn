import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'

const CATEGORIES = ['meat', 'fish', 'dairy', 'produce', 'dry_goods', 'other']

const CATEGORY_LABELS = {
  meat:      'Meat',
  fish:      'Fish',
  dairy:     'Dairy',
  produce:   'Produce',
  dry_goods: 'Dry Goods',
  other:     'Other',
}

const CATEGORY_STYLES = {
  meat:      'bg-red-50    text-red-700    border-red-200',
  fish:      'bg-blue-50   text-blue-700   border-blue-200',
  dairy:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  produce:   'bg-green-50  text-green-700  border-green-200',
  dry_goods: 'bg-amber-50  text-amber-700  border-amber-200',
  other:     'bg-charcoal/5 text-charcoal/60 border-charcoal/15',
}

function CategoryBadge({ category }) {
  const cls = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other
  return (
    <span className={`text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

function useSuppliers(venueId) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, category, contact_name, phone, email, notes')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { suppliers, loading, reload: load }
}

const EMPTY_FORM = {
  name: '', category: 'dry_goods', contact_name: '', phone: '', email: '', notes: '',
}

function SupplierModal({ supplier, venueId, onSaved, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState(supplier ? {
    name: supplier.name,
    category: supplier.category,
    contact_name: supplier.contact_name ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    notes: supplier.notes ?? '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('Supplier name is required', 'error'); return }
    setSaving(true)
    const payload = {
      venue_id:     venueId,
      name:         form.name.trim(),
      category:     form.category,
      contact_name: form.contact_name.trim() || null,
      phone:        form.phone.trim() || null,
      email:        form.email.trim() || null,
      notes:        form.notes.trim() || null,
    }
    const { error } = supplier
      ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      : await supabase.from('suppliers').insert(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(supplier ? 'Supplier updated ✓' : 'Supplier added ✓')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl" style={{ maxHeight: '90dvh', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="px-6 py-5 border-b border-charcoal/8 flex items-center justify-between">
          <h2 className="font-semibold text-charcoal">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal transition-colors text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-6 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Name <span className="text-danger">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Fresh Fields Ltd"
              className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set('category', cat)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    form.category === cat
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Contact Name</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
              placeholder="e.g. James Brown"
              className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="07700 900000"
                className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="orders@supplier.co.uk"
                className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Delivery days, minimum order, etc."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div className="flex gap-2 pt-1 border-t border-charcoal/8">
            <Button type="submit" variant="primary" disabled={saving} className="flex-1">
              {saving ? 'Saving…' : supplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SupplierCard({ supplier, onEdit, onArchive }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-charcoal">{supplier.name}</h3>
          <CategoryBadge category={supplier.category} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onEdit(supplier)}
            className="text-xs text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            Edit
          </button>
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-charcoal/40">Archive?</span>
              <button
                onClick={() => { onArchive(supplier.id); setConfirming(false) }}
                className="text-xs text-danger font-medium hover:text-danger/80 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-charcoal/40 hover:text-charcoal transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-charcoal/30 hover:text-danger transition-colors"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {(supplier.contact_name || supplier.phone || supplier.email) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {supplier.contact_name && (
            <p className="text-xs text-charcoal/60">{supplier.contact_name}</p>
          )}
          {supplier.phone && (
            <a href={`tel:${supplier.phone}`} className="text-xs text-charcoal/60 hover:text-accent transition-colors">
              {supplier.phone}
            </a>
          )}
          {supplier.email && (
            <a href={`mailto:${supplier.email}`} className="text-xs text-charcoal/60 hover:text-accent transition-colors truncate">
              {supplier.email}
            </a>
          )}
        </div>
      )}

      {supplier.notes && (
        <p className="text-xs text-charcoal/45 leading-relaxed">{supplier.notes}</p>
      )}
    </div>
  )
}

export default function SuppliersPage() {
  const { venueId } = useVenue()
  const toast = useToast()
  const { suppliers, loading, reload } = useSuppliers(venueId)
  const [modalSupplier, setModalSupplier] = useState(undefined) // undefined = closed, null = new
  const [filterCat, setFilterCat] = useState('all')

  const archiveSupplier = async (id) => {
    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Supplier archived')
    reload()
  }

  const grouped = filterCat === 'all'
    ? suppliers
    : suppliers.filter((s) => s.category === filterCat)

  const usedCats = [...new Set(suppliers.map((s) => s.category))]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Suppliers</h1>
        <Button variant="primary" onClick={() => setModalSupplier(null)}>
          + Add Supplier
        </Button>
      </div>

      {/* Category filter */}
      {usedCats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat('all')}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              filterCat === 'all'
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
            ].join(' ')}
          >
            All ({suppliers.length})
          </button>
          {usedCats.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                filterCat === cat
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
              ].join(' ')}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonList rows={4} className="py-4" />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon="list"
          title={suppliers.length === 0 ? 'No suppliers yet' : 'No suppliers in this category'}
          description={suppliers.length === 0 ? 'Add your first approved supplier to get started.' : 'Try selecting a different category above.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onEdit={(sup) => setModalSupplier(sup)}
              onArchive={archiveSupplier}
            />
          ))}
        </div>
      )}

      {modalSupplier !== undefined && (
        <SupplierModal
          supplier={modalSupplier}
          venueId={venueId}
          onSaved={() => { setModalSupplier(undefined); reload() }}
          onClose={() => setModalSupplier(undefined)}
        />
      )}
    </div>
  )
}
