import React, { useState, useEffect, useCallback } from 'react'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'licences',      label: 'Licences' },
  { value: 'insurance',     label: 'Insurance' },
  { value: 'health_safety', label: 'Health & Safety' },
  { value: 'eho_reports',   label: 'EHO Reports' },
  { value: 'other',         label: 'Other' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── Helpers ──────────────────────────────────────────────────────────────────

function docStatus(record) {
  if (!record.expiry_date) return 'valid'
  const expiry = parseISO(record.expiry_date)
  if (isPast(expiry)) return 'expired'
  if (differenceInDays(expiry, new Date()) <= 30) return 'expiring'
  return 'valid'
}

function StatusBadge({ status }) {
  const styles = { expired: 'bg-danger/8 text-danger', expiring: 'bg-warning/8 text-warning', valid: 'bg-success/8 text-success' }
  const labels = { expired: 'Expired', expiring: 'Expiring Soon', valid: 'Valid' }
  return (
    <span className={`text-[11px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useDocuments(venueId) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:uploaded_by(id, name)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { docs, loading, reload: load }
}

// ── Upload Modal ─────────────────────────────────────────────────────────────

function UploadDocumentModal({ venueId, uploaderId, onSaved, onClose }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) { toast('Title is required', 'error'); return }
    if (!file) { toast('Please select a file', 'error'); return }
    if (file.size > MAX_FILE_SIZE) { toast('File must be under 10 MB', 'error'); return }

    setSaving(true)
    const ext = file.name.split('.').pop()
    const path = `${venueId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('venue-documents')
      .upload(path, file, { upsert: false })

    if (uploadErr) {
      toast('File upload failed: ' + uploadErr.message, 'error')
      setSaving(false)
      return
    }

    const { data: urlData } = supabase.storage.from('venue-documents').getPublicUrl(path)

    const { error } = await supabase.from('documents').insert({
      venue_id: venueId,
      title: title.trim(),
      category,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      expiry_date: expiryDate || null,
      notes: notes.trim() || null,
      uploaded_by: uploaderId,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Document uploaded')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-charcoal/8">
          <h2 className="text-lg font-bold text-charcoal">Upload Document</h2>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Title</label>
            <input
              type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="e.g. Premises Licence"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-charcoal/50 mb-1 block">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal/50 mb-1 block">Expiry date (optional)</label>
              <input
                type="date" value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Notes (optional)</label>
            <input
              type="text" value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Any additional context"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">File</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-charcoal/60 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-brand/8 file:text-brand hover:file:bg-brand/15 cursor-pointer"
            />
            <p className="text-[11px] text-charcoal/35 mt-1">PDF, images, or Word documents. Max 10 MB.</p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-charcoal/15 text-charcoal/60 py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand text-cream py-2.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({ doc }) {
  const status = docStatus(doc)

  return (
    <div className="bg-white rounded-2xl border border-charcoal/8 px-4 py-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-brand/8 text-brand flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-charcoal truncate">{doc.title}</p>
          {doc.expiry_date && <StatusBadge status={status} />}
        </div>
        <p className="text-[11px] text-charcoal/40">
          {CATEGORY_MAP[doc.category] || doc.category}
          {doc.expiry_date && <> &middot; Expires {format(parseISO(doc.expiry_date), 'd MMM yyyy')}</>}
          {doc.file_size ? <> &middot; {formatFileSize(doc.file_size)}</> : null}
        </p>
      </div>
      <a
        href={doc.file_url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-brand hover:text-brand/70 transition-colors"
        title="Download"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const { docs, loading, reload } = useDocuments(venueId)
  const [showUpload, setShowUpload] = useState(false)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? docs : docs.filter(d => d.category === filter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Documents</h1>
          <p className="text-sm text-charcoal/40 mt-1">Venue licences, insurance, safety records and more</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-accent text-cream px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            + Upload
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-brand text-cream' : 'bg-charcoal/5 text-charcoal/50 hover:bg-charcoal/10'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === c.value ? 'bg-brand text-cream' : 'bg-charcoal/5 text-charcoal/50 hover:bg-charcoal/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No documents yet' : `No ${CATEGORY_MAP[filter]?.toLowerCase() || ''} documents`}
          description={isManager ? 'Upload your first document to get started.' : 'No documents have been uploaded yet.'}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(d => <DocumentCard key={d.id} doc={d} />)}
        </div>
      )}

      {showUpload && (
        <UploadDocumentModal
          venueId={venueId}
          uploaderId={session?.staffId}
          onSaved={() => { setShowUpload(false); reload() }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
