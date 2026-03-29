import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
// tesseract.js is ~7 MB — dynamically imported only when OCR is actually used

function nowDatetimeLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */

function useDeliveryChecks(venueId) {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('delivery_checks')
      .select('*, checker:staff!checked_by(name), supplier:suppliers(name)')
      .eq('venue_id', venueId)
      .order('checked_at', { ascending: false })
      .limit(100)
    setChecks(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { checks, loading, reload: load }
}

function useDeliverySuppliers(venueId) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { suppliers, loading, reload: load }
}

function useSupplierItems(supplierId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    if (!supplierId) { setItems([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('supplier_items')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [supplierId])
  useEffect(() => { load() }, [load])
  return { items, loading, reload: load }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  { value: 'chilled', label: 'Chilled', temp: true,  minTemp: 0, maxTemp: 5 },
  { value: 'frozen',  label: 'Frozen',  temp: true,  minTemp: -25, maxTemp: -18 },
  { value: 'ambient', label: 'Ambient', temp: false, minTemp: null, maxTemp: null },
  { value: 'dry',     label: 'Dry',     temp: false, minTemp: null, maxTemp: null },
]

function categoryConfig(cat) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[2]
}

/* ═══════════════════════════════════════════════════════════════════════════
   OCR HELPER
   ═══════════════════════════════════════════════════════════════════════════ */

async function extractTextFromImage(file) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  const { data: { text } } = await worker.recognize(file)
  await worker.terminate()
  return text
}

function parseItemsFromText(text) {
  // Split by newlines, filter out short/empty lines and common header/footer text
  const ignorePatterns = /invoice|order|date|page|total|subtotal|vat|delivery|address|phone|email|ref|account|no\./i
  const lines = text.split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 2 && l.length < 80)
    .filter(l => !ignorePatterns.test(l))
    .filter(l => /[a-zA-Z]/.test(l)) // must contain letters

  // Deduplicate
  const seen = new Set()
  return lines.filter(l => {
    const key = l.toLowerCase().replace(/[^a-z]/g, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 50) // cap at 50 items
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function PassFailChip({ pass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] tracking-wider uppercase font-medium ${
      pass ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
    }`}>
      {pass ? 'PASS' : 'FAIL'}
    </span>
  )
}

/* ── Supplier setup modal ────────────────────────────────────────────────── */
function AddSupplierModal({ open, onClose, onAdded, venueId }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('suppliers').insert({ name: name.trim(), venue_id: venueId }).select().single()
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Supplier added')
    setName('')
    onClose()
    onAdded(data)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Supplier">
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Henderson's, Brakes, Musgrave"
          className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          autoFocus
        />
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="bg-charcoal text-cream py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Add Supplier'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Item setup: categorise a new item ───────────────────────────────────── */
function ItemCategoryPicker({ itemName, onSave, onSkip }) {
  const [category, setCategory] = useState('ambient')
  const cat = categoryConfig(category)

  return (
    <div className="bg-charcoal/4 rounded-xl p-3 flex flex-col gap-2">
      <p className="text-sm font-medium text-charcoal truncate">{itemName}</p>
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              category === c.value
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onSave(category, cat.temp)}
          className="flex-1 bg-charcoal text-cream py-1.5 rounded-lg text-xs font-medium"
        >
          Save
        </button>
        <button
          onClick={onSkip}
          className="px-3 py-1.5 rounded-lg border border-charcoal/15 text-xs text-charcoal/40"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SMART DELIVERY CHECK MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function DeliveryCheckModal({ open, onClose, suppliers, onSupplierAdded, onComplete, venueId }) {
  const toast = useToast()
  const { session } = useSession()

  // Steps: select_supplier → checklist → done
  const [step, setStep] = useState('select_supplier')
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)

  // Catalog items for this supplier
  const { items: catalogItems, loading: itemsLoading, reload: reloadItems } = useSupplierItems(selectedSupplier?.id)

  // Checklist state: { [itemId]: { received, tempReading, tempPass, notes } }
  const [checklist, setChecklist] = useState({})
  const [overallNotes, setOverallNotes] = useState('')
  const [packagingOk, setPackagingOk] = useState(true)
  const [useByOk, setUseByOk] = useState(true)
  const [saving, setSaving] = useState(false)

  // OCR state
  const [scanning, setScanning] = useState(false)
  const [ocrItems, setOcrItems] = useState([]) // items extracted but not yet in catalog
  const [categorisingIdx, setCategorisingIdx] = useState(0)

  // Photo upload
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [checkedAt, setCheckedAt] = useState(nowDatetimeLocal)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('select_supplier')
      setSelectedSupplier(null)
      setChecklist({})
      setOverallNotes('')
      setPackagingOk(true)
      setUseByOk(true)
      setOcrItems([])
      setCategorisingIdx(0)
      setPhotoUrl('')
    }
  }, [open])

  // Build checklist when catalog items load
  useEffect(() => {
    if (catalogItems.length > 0 && step === 'checklist') {
      const initial = {}
      catalogItems.forEach(item => {
        initial[item.id] = {
          itemName: item.name,
          received: true,
          tempReading: '',
          tempPass: true,
          tempRequired: item.temp_required,
          minTemp: item.min_temp,
          maxTemp: item.max_temp,
          category: item.category,
        }
      })
      setChecklist(prev => ({ ...initial, ...prev }))
    }
  }, [catalogItems, step])

  const selectSupplier = (supplier) => {
    setSelectedSupplier(supplier)
    setStep('checklist')
  }

  // ── OCR scan ──
  const handleScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const text = await extractTextFromImage(file)
      const parsed = parseItemsFromText(text)

      // Filter out items already in catalog
      const catalogNames = new Set(catalogItems.map(i => i.name.toLowerCase()))
      const newItems = parsed.filter(name => !catalogNames.has(name.toLowerCase()))

      if (newItems.length === 0) {
        toast('No new items found — all items already in your catalog')
      } else {
        setOcrItems(newItems)
        setCategorisingIdx(0)
        toast(`Found ${newItems.length} new item${newItems.length !== 1 ? 's' : ''} — please categorise them`)
      }
    } catch (err) {
      toast('OCR failed: ' + err.message, 'error')
    }
    setScanning(false)
  }

  // ── Save an OCR item to catalog ──
  const saveOcrItem = async (category, tempRequired) => {
    const itemName = ocrItems[categorisingIdx]
    const cat = categoryConfig(category)

    const { data: newItem, error } = await supabase.from('supplier_items').insert({
      supplier_id: selectedSupplier.id,
      name: itemName,
      category,
      temp_required: tempRequired,
      min_temp: cat.minTemp,
      max_temp: cat.maxTemp,
      venue_id: venueId,
    }).select().single()

    if (error) { toast(error.message, 'error'); return }

    // Add to checklist
    if (newItem) {
      setChecklist(prev => ({
        ...prev,
        [newItem.id]: {
          itemName: newItem.name,
          received: true,
          tempReading: '',
          tempPass: true,
          tempRequired: newItem.temp_required,
          minTemp: newItem.min_temp,
          maxTemp: newItem.max_temp,
          category: newItem.category,
        }
      }))
    }

    // Next item
    if (categorisingIdx < ocrItems.length - 1) {
      setCategorisingIdx(i => i + 1)
    } else {
      setOcrItems([])
      reloadItems()
      toast('All items categorised and added to checklist')
    }
  }

  const skipOcrItem = () => {
    if (categorisingIdx < ocrItems.length - 1) {
      setCategorisingIdx(i => i + 1)
    } else {
      setOcrItems([])
    }
  }

  // ── Update checklist item ──
  const updateItem = (id, field, value) => {
    setChecklist(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }))
  }

  // ── Auto-calculate temp pass ──
  const checkTemp = (id, reading) => {
    const item = checklist[id]
    if (!item) return
    const val = parseFloat(reading)
    const pass = isNaN(val) || (
      (item.minTemp == null || val >= item.minTemp) &&
      (item.maxTemp == null || val <= item.maxTemp)
    )
    setChecklist(prev => ({
      ...prev,
      [id]: { ...prev[id], tempReading: reading, tempPass: pass }
    }))
  }

  // ── Photo upload ──
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${venueId}/delivery-photos/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('training-files').upload(path, file)
    if (error) { toast('Upload failed', 'error'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('training-files').getPublicUrl(path)
    setPhotoUrl(publicUrl)
    setUploading(false)
  }

  // ── Save delivery ──
  const saveDelivery = async () => {
    setSaving(true)
    const itemEntries = Object.entries(checklist)
    const anyTempFail = itemEntries.some(([, v]) => v.tempRequired && !v.tempPass)
    const anyMissing = itemEntries.some(([, v]) => !v.received)
    const overallPass = !anyTempFail && !anyMissing && packagingOk && useByOk

    // Compute average temp for items that have readings
    const tempReadings = itemEntries
      .filter(([, v]) => v.tempRequired && v.tempReading)
      .map(([, v]) => parseFloat(v.tempReading))
      .filter(v => !isNaN(v))
    const avgTemp = tempReadings.length > 0
      ? tempReadings.reduce((a, b) => a + b, 0) / tempReadings.length
      : null

    // Create the delivery check
    const { data: check, error } = await supabase.from('delivery_checks').insert({
      supplier_name: selectedSupplier.name,
      supplier_id: selectedSupplier.id,
      temp_reading: avgTemp,
      temp_pass: !anyTempFail,
      packaging_ok: packagingOk,
      use_by_ok: useByOk,
      overall_pass: overallPass,
      photo_url: photoUrl || null,
      notes: overallNotes.trim() || null,
      items_desc: itemEntries.map(([, v]) => v.itemName).join(', ').slice(0, 200),
      checked_by: session?.staffId,
      checked_at: new Date(checkedAt).toISOString(),
      venue_id: venueId,
    }).select().single()

    if (error) { toast(error.message, 'error'); setSaving(false); return }

    // Save line items
    if (check && itemEntries.length > 0) {
      const lineItems = itemEntries.map(([id, v]) => ({
        delivery_check_id: check.id,
        supplier_item_id: id,
        item_name: v.itemName,
        received: v.received,
        temp_reading: v.tempReading ? parseFloat(v.tempReading) : null,
        temp_pass: v.tempPass,
        venue_id: venueId,
      }))
      await supabase.from('delivery_check_items').insert(lineItems)
    }

    setSaving(false)
    toast(overallPass ? 'Delivery check passed' : 'Delivery check recorded (issues flagged)')
    onComplete()
    onClose()
    setCheckedAt(nowDatetimeLocal())
  }

  const itemEntries = Object.entries(checklist)
  const tempItems = itemEntries.filter(([, v]) => v.tempRequired)
  const nonTempItems = itemEntries.filter(([, v]) => !v.tempRequired)

  return (
    <>
      <Modal open={open && !showAddSupplier} onClose={onClose} title={
        step === 'select_supplier' ? 'Select Supplier' : `${selectedSupplier?.name} — Delivery Check`
      }>
        {step === 'select_supplier' && (
          <div className="flex flex-col gap-3">
            {suppliers.length === 0 ? (
              <p className="text-sm text-charcoal/40 italic py-4">No suppliers yet. Add one to get started.</p>
            ) : (
              suppliers.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSupplier(s)}
                  className="text-left px-4 py-3 rounded-xl border border-charcoal/10 hover:border-charcoal/25 hover:bg-charcoal/3 transition-all"
                >
                  <p className="text-sm font-medium text-charcoal">{s.name}</p>
                </button>
              ))
            )}
            <button
              onClick={() => setShowAddSupplier(true)}
              className="px-4 py-3 rounded-xl border border-dashed border-charcoal/20 text-sm text-charcoal/40 hover:text-charcoal/60 hover:border-charcoal/35 transition-all"
            >
              + Add New Supplier
            </button>
          </div>
        )}

        {step === 'checklist' && (
          <div className="flex flex-col gap-4">
            {/* OCR scan button */}
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <div className={`text-center py-2.5 rounded-xl border border-dashed text-sm font-medium transition-all ${
                  scanning
                    ? 'border-charcoal/30 bg-charcoal/5 text-charcoal/50'
                    : 'border-charcoal/20 text-charcoal/40 hover:border-charcoal/35 hover:text-charcoal/60'
                }`}>
                  {scanning ? 'Scanning...' : 'Scan Delivery Docket'}
                </div>
                <input type="file" accept="image/*,.pdf" onChange={handleScan} className="hidden" disabled={scanning} />
              </label>
            </div>

            {scanning && (
              <div className="flex justify-center py-4">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-charcoal/40">Reading docket...</span>
              </div>
            )}

            {/* OCR categorisation */}
            {ocrItems.length > 0 && categorisingIdx < ocrItems.length && (
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                  Categorise new item ({categorisingIdx + 1}/{ocrItems.length})
                </p>
                <ItemCategoryPicker
                  itemName={ocrItems[categorisingIdx]}
                  onSave={saveOcrItem}
                  onSkip={skipOcrItem}
                />
              </div>
            )}

            {/* Checklist — items needing temp */}
            {tempItems.length > 0 && (
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                  Temperature Items ({tempItems.length})
                </p>
                <div className="flex flex-col gap-2">
                  {tempItems.map(([id, item]) => (
                    <div key={id} className={`rounded-xl border p-3 ${item.received ? (item.tempPass ? 'border-charcoal/10' : 'border-danger/25 bg-danger/3') : 'border-charcoal/10 bg-charcoal/4 opacity-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => updateItem(id, 'received', !item.received)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            item.received ? 'bg-success border-success text-white' : 'border-charcoal/20'
                          }`}
                        >
                          {item.received && <span className="text-xs">✓</span>}
                        </button>
                        <span className="text-sm font-medium text-charcoal flex-1 truncate">{item.itemName}</span>
                        <span className="text-[11px] tracking-wider uppercase text-charcoal/30">{item.category}</span>
                      </div>
                      {item.received && (
                        <div className="flex items-center gap-2 ml-7">
                          <input
                            type="number"
                            step="0.1"
                            value={item.tempReading}
                            onChange={e => checkTemp(id, e.target.value)}
                            placeholder={`${item.minTemp ?? '?'}C to ${item.maxTemp ?? '?'}C`}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                          />
                          <span className="text-xs">°C</span>
                          {item.tempReading && (
                            <PassFailChip pass={item.tempPass} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist — non-temp items */}
            {nonTempItems.length > 0 && (
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                  Other Items ({nonTempItems.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {nonTempItems.map(([id, item]) => (
                    <div key={id} className="flex items-center gap-2 rounded-xl border border-charcoal/10 px-3 py-2.5">
                      <button
                        onClick={() => updateItem(id, 'received', !item.received)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          item.received ? 'bg-success border-success text-white' : 'border-charcoal/20'
                        }`}
                      >
                        {item.received && <span className="text-xs">✓</span>}
                      </button>
                      <span className={`text-sm flex-1 truncate ${item.received ? 'text-charcoal' : 'text-charcoal/40 line-through'}`}>
                        {item.itemName}
                      </span>
                      <span className="text-[11px] tracking-wider uppercase text-charcoal/25">{item.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {itemEntries.length === 0 && !scanning && ocrItems.length === 0 && (
              <div className="text-center py-6 text-charcoal/30">
                <p className="text-sm mb-2">No items in catalog for {selectedSupplier?.name}.</p>
                <p className="text-xs">Scan a delivery docket to add items automatically, or they'll be added as you go.</p>
              </div>
            )}

            {/* Overall checks */}
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Overall Checks</p>
              {[
                { key: 'packaging', label: 'Packaging intact', value: packagingOk, set: setPackagingOk },
                { key: 'useby', label: 'Use-by dates valid', value: useByOk, set: setUseByOk },
              ].map(({ key, label, value, set }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set(!value)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all mb-1.5 ${
                    value
                      ? 'bg-success/5 border-success/20 text-charcoal'
                      : 'bg-danger/5 border-danger/20 text-danger'
                  }`}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-xs font-semibold tracking-wider uppercase ${value ? 'text-success' : 'text-danger'}`}>
                    {value ? 'PASS' : 'FAIL'}
                  </span>
                </button>
              ))}
            </div>

            {/* Photo */}
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Delivery note photo</label>
              <input type="file" accept="image/*" onChange={handlePhoto} className="text-sm" />
              {uploading && <p className="text-xs text-charcoal/40 mt-1">Uploading...</p>}
              {photoUrl && <p className="text-xs text-success mt-1">Photo attached</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes</label>
              <textarea
                value={overallNotes}
                onChange={e => setOverallNotes(e.target.value)}
                rows={2}
                placeholder="Any issues or observations..."
                className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>

            {/* Delivery date/time */}
            <div>
              <label className="text-xs text-charcoal/50 mb-1 block">Delivery Date &amp; Time</label>
              <input
                type="datetime-local"
                value={checkedAt}
                max={nowDatetimeLocal()}
                onChange={e => setCheckedAt(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>

            {/* Submit */}
            <button
              onClick={saveDelivery}
              disabled={saving}
              className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Complete Delivery Check'}
            </button>
          </div>
        )}
      </Modal>

      <AddSupplierModal
        open={showAddSupplier}
        onClose={() => setShowAddSupplier(false)}
        venueId={venueId}
        onAdded={(supplier) => {
          onSupplierAdded()
          selectSupplier(supplier)
        }}
      />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DeliveryChecksPage() {
  const { venueId } = useVenue()
  const { checks, loading, reload } = useDeliveryChecks(venueId)
  const { suppliers, reload: reloadSuppliers } = useDeliverySuppliers(venueId)
  const [showCheck, setShowCheck] = useState(false)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? checks
    : filter === 'pass'
      ? checks.filter(c => c.overall_pass)
      : checks.filter(c => !c.overall_pass)

  const passCount = checks.filter(c => c.overall_pass).length
  const failCount = checks.filter(c => !c.overall_pass).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-brand">Delivery Checks</h1>
        <button
          onClick={() => setShowCheck(true)}
          className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
        >
          + Check Delivery
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Total', value: checks.length, color: 'text-charcoal' },
          { label: 'Passed', value: passCount, color: 'text-success' },
          { label: 'Failed', value: failCount, color: 'text-danger' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-charcoal/10 p-3 sm:p-4 text-center">
            <p className="text-[9px] sm:text-[11px] tracking-widest uppercase text-charcoal/40">{s.label}</p>
            <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'pass', 'fail'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === f
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'
            }`}
          >
            {f === 'all' ? 'All' : f === 'pass' ? 'Passed' : 'Failed'}
          </button>
        ))}
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-charcoal/10 p-10 text-center">
          <p className="text-charcoal/30 text-sm">No delivery checks recorded yet.</p>
          <p className="text-charcoal/20 text-xs mt-1">Tap "+ Check Delivery" to log your first one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(c => (
            <div key={c.id} className={`bg-white rounded-xl border p-4 ${c.overall_pass ? 'border-charcoal/10' : 'border-danger/25 bg-danger/3'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-charcoal">{c.supplier?.name ?? c.supplier_name}</h3>
                    <PassFailChip pass={c.overall_pass} />
                  </div>
                  {c.items_desc && <p className="text-sm text-charcoal/50 mt-1 truncate">{c.items_desc}</p>}
                  {c.notes && <p className="text-xs text-charcoal/40 mt-1 italic">{c.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-charcoal/40">{format(new Date(c.checked_at), 'd MMM HH:mm')}</p>
                  <p className="text-[11px] text-charcoal/30 mt-0.5">{c.checker?.name ?? 'Unknown'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Smart delivery check modal */}
      <DeliveryCheckModal
        open={showCheck}
        onClose={() => setShowCheck(false)}
        suppliers={suppliers}
        onSupplierAdded={reloadSuppliers}
        onComplete={reload}
        venueId={venueId}
      />
    </div>
  )
}
