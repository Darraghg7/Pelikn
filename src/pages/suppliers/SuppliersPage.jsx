import React, { useState } from 'react'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSuppliers } from '../../hooks/useSuppliers'
import { insertSupplier, updateSupplier, deactivateSupplier } from '../../lib/api/suppliers'
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

const APPROVAL_STYLES = {
  approved:  'bg-success/8  text-success  border-success/20',
  pending:   'bg-warning/8  text-warning  border-warning/20',
  suspended: 'bg-danger/8   text-danger   border-danger/20',
}
const APPROVAL_LABELS = {
  approved:  'Approved',
  pending:   'Pending',
  suspended: 'Suspended',
}

function CategoryBadge({ category }) {
  const cls = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other
  return (
    <span className={`text-[11px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

function ApprovalBadge({ status }) {
  const s = status ?? 'pending'
  const cls = APPROVAL_STYLES[s] ?? APPROVAL_STYLES.pending
  return (
    <span className={`text-[11px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {APPROVAL_LABELS[s] ?? s}
    </span>
  )
}

function certStatus(expiry) {
  if (!expiry) return null
  const d = parseISO(expiry)
  if (isPast(d)) return 'expired'
  if (differenceInDays(d, new Date()) <= 30) return 'expiring'
  return 'valid'
}


const EMPTY_FORM = {
  name: '', category: 'dry_goods', contact_name: '', phone: '', email: '', notes: '',
  approval_status: 'pending', food_safety_cert_expiry: '',
}

function SupplierModal({ supplier, venueId, onSaved, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState(supplier ? {
    name:                   supplier.name,
    category:               supplier.category,
    contact_name:           supplier.contact_name ?? '',
    phone:                  supplier.phone ?? '',
    email:                  supplier.email ?? '',
    notes:                  supplier.notes ?? '',
    approval_status:        supplier.approval_status ?? 'pending',
    food_safety_cert_expiry: supplier.food_safety_cert_expiry ?? '',
  } : { ...EMPTY_FORM })
  const [certFile, setCertFile]   = useState(null)
  const [existingCert, setExistingCert] = useState(supplier?.food_safety_cert_url ? { url: supplier.food_safety_cert_url, name: supplier.food_safety_cert_name } : null)
  const [saving, setSaving]       = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('Supplier name is required', 'error'); return }
    setSaving(true)

    let certUrl  = existingCert?.url  ?? null
    let certName = existingCert?.name ?? null
    if (certFile) {
      const ext  = certFile.name.split('.').pop()
      const path = `${venueId}/suppliers/${Date.now()}-${certFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadErr } = await supabase.storage.from('venue-documents').upload(path, certFile, { upsert: false })
      if (uploadErr) { toast('File upload failed: ' + uploadErr.message, 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('venue-documents').getPublicUrl(path)
      certUrl  = urlData.publicUrl
      certName = certFile.name
    }

    const payload = {
      venue_id:                venueId,
      name:                    form.name.trim(),
      category:                form.category,
      contact_name:            form.contact_name.trim() || null,
      phone:                   form.phone.trim() || null,
      email:                   form.email.trim() || null,
      notes:                   form.notes.trim() || null,
      approval_status:         form.approval_status,
      food_safety_cert_expiry: form.food_safety_cert_expiry || null,
      food_safety_cert_url:    certUrl,
      food_safety_cert_name:   certName,
    }
    const { error } = supplier
      ? await updateSupplier(supplier.id, payload)
      : await insertSupplier(payload)
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

          {/* Approval status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Approval Status</label>
            <div className="flex gap-2">
              {['pending', 'approved', 'suspended'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('approval_status', s)}
                  className={[
                    'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize',
                    form.approval_status === s
                      ? s === 'approved'  ? 'bg-success/10 text-success border-success/30'
                        : s === 'suspended' ? 'bg-danger/10 text-danger border-danger/30'
                        : 'bg-warning/10 text-warning border-warning/30'
                      : 'bg-white text-charcoal/40 border-charcoal/12 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {s}
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

          {/* Food safety certificate */}
          <div className="flex flex-col gap-2 p-4 bg-charcoal/3 rounded-xl border border-charcoal/8">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Food Safety Certificate</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-charcoal/35 uppercase tracking-wider">Expiry Date</label>
                <input
                  type="date"
                  value={form.food_safety_cert_expiry}
                  onChange={(e) => set('food_safety_cert_expiry', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-charcoal/35 uppercase tracking-wider">Upload Certificate</label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => { setCertFile(e.target.files[0] ?? null); setExistingCert(null) }}
                  className="w-full text-xs text-charcoal/50 file:mr-2 file:py-1.5 file:px-2 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-white file:text-charcoal/50 hover:file:bg-charcoal/5"
                />
              </div>
            </div>
            {existingCert?.url && (
              <a href={existingCert.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline underline-offset-2 hover:opacity-70 transition-opacity truncate">
                {existingCert.name ?? 'View existing certificate'}
              </a>
            )}
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
  const cs = certStatus(supplier.food_safety_cert_expiry)

  return (
    <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-charcoal">{supplier.name}</h3>
          <CategoryBadge category={supplier.category} />
          <ApprovalBadge status={supplier.approval_status} />
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
                className="text-sm text-danger font-medium hover:text-danger/80 transition-colors px-3 py-1.5"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-sm text-charcoal/40 hover:text-charcoal transition-colors px-3 py-1.5"
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

      {/* Food safety cert */}
      {(supplier.food_safety_cert_url || supplier.food_safety_cert_expiry) && (
        <div className={`flex items-center gap-2 flex-wrap rounded-lg px-3 py-2 ${
          cs === 'expired'  ? 'bg-danger/6 border border-danger/15'  :
          cs === 'expiring' ? 'bg-warning/6 border border-warning/15' :
          'bg-charcoal/4 border border-charcoal/8'
        }`}>
          <svg className={`w-3.5 h-3.5 shrink-0 ${cs === 'expired' ? 'text-danger' : cs === 'expiring' ? 'text-warning' : 'text-charcoal/40'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span className={`text-xs ${cs === 'expired' ? 'text-danger' : cs === 'expiring' ? 'text-warning' : 'text-charcoal/50'}`}>
            Food safety cert
            {supplier.food_safety_cert_expiry && ` · expires ${format(parseISO(supplier.food_safety_cert_expiry), 'd MMM yyyy')}`}
            {cs === 'expired' && ' — EXPIRED'}
            {cs === 'expiring' && ' — expiring soon'}
          </span>
          {supplier.food_safety_cert_url && (
            <a href={supplier.food_safety_cert_url} target="_blank" rel="noreferrer"
              className="text-xs text-accent underline underline-offset-2 hover:opacity-70 transition-opacity ml-auto">
              View
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
  const { suppliers, loading, reload } = useSuppliers()
  const [modalSupplier, setModalSupplier] = useState(undefined) // undefined = closed, null = new
  const [filterCat, setFilterCat]         = useState('all')
  const [filterApproval, setFilterApproval] = useState('all')

  const archiveSupplier = async (id) => {
    const { error } = await deactivateSupplier(id)
    if (error) { toast(error.message, 'error'); return }
    toast('Supplier archived')
    reload()
  }

  const pendingCount   = suppliers.filter(s => (s.approval_status ?? 'pending') === 'pending').length
  const suspendedCount = suppliers.filter(s => s.approval_status === 'suspended').length

  const grouped = suppliers
    .filter((s) => filterCat === 'all' || s.category === filterCat)
    .filter((s) => filterApproval === 'all' || (s.approval_status ?? 'pending') === filterApproval)

  const usedCats = [...new Set(suppliers.map((s) => s.category))]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Suppliers</h1>
        <Button variant="primary" onClick={() => setModalSupplier(null)}>
          + Add Supplier
        </Button>
      </div>

      {/* Pending / suspended alert */}
      {(pendingCount > 0 || suspendedCount > 0) && (
        <div className="bg-warning/8 border border-warning/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-warning shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-sm text-warning">
            {[
              pendingCount   > 0 && `${pendingCount} supplier${pendingCount   !== 1 ? 's' : ''} pending approval`,
              suspendedCount > 0 && `${suspendedCount} suspended`,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      {/* Filters */}
      {suppliers.length > 0 && (
        <div className="flex flex-col gap-2">
          {usedCats.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterCat('all')} className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all', filterCat === 'all' ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'].join(' ')}>
                All ({suppliers.length})
              </button>
              {usedCats.map((cat) => (
                <button key={cat} onClick={() => setFilterCat(cat)} className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all', filterCat === cat ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'].join(' ')}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {['all', 'approved', 'pending', 'suspended'].map((s) => (
              <button key={s} onClick={() => setFilterApproval(s)} className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize', filterApproval === s ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'].join(' ')}>
                {s === 'all' ? 'All statuses' : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonList rows={4} className="py-4" />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon="list"
          title={suppliers.length === 0 ? 'No suppliers yet' : 'No suppliers in this category'}
          description={suppliers.length === 0 ? 'Add your first supplier to get started.' : 'Try changing the filters above.'}
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
