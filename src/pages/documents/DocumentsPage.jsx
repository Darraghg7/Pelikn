/**
 * DocumentsPage — venue licences, insurance, safety records and EHO reports.
 *
 * Search + category chips, an expiry banner that filters to what needs
 * attention, and one list sorted so expired and expiring documents come first.
 */
import React, { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { CARD, TONE, PageHeader } from '../../components/temperature/TempPageParts'
import { useDocuments, documentStatus, DOCUMENT_CATEGORIES, EXPIRY_WARNING_DAYS } from '../../hooks/useDocuments'

const CATEGORY_LABEL = Object.fromEntries(DOCUMENT_CATEGORIES.map(c => [c.value, c.label]))
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const FIELD_LABEL = 'block text-[13px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'

// Expired first, then expiring soonest-first, then the rest A–Z, undated last
const STATUS_RANK = { expired: 0, expiring: 1, valid: 2, none: 3 }

function fileExt(doc) {
  const ext = (doc.file_name ?? '').split('.').pop()
  return ext && ext !== doc.file_name ? ext.slice(0, 4).toUpperCase() : 'FILE'
}

function StatusPill({ status, daysLeft }) {
  const pill = {
    expired:  { label: 'Expired', cls: TONE.bad },
    expiring: { label: daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, cls: TONE.explained },
    valid:    { label: 'Valid', cls: TONE.ok },
    none:     { label: 'No expiry', cls: 'bg-line2 text-ink3 dark:bg-white/10 dark:text-white/50' },
  }[status]
  return (
    <span className={`shrink-0 h-8 px-3 min-[420px]:px-3.5 rounded-full inline-flex items-center text-sm font-semibold whitespace-nowrap ${pill.cls}`}>
      {pill.label}
    </span>
  )
}

function FilterChip({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'h-11 px-4 rounded-full border inline-flex items-center gap-2 text-[15px] font-semibold transition-colors',
        active
          ? 'bg-brand border-brand text-white'
          : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
      ].join(' ')}
    >
      {label}
      <span className={`font-mono text-sm ${active ? 'text-white/70' : 'text-ink4 dark:text-white/35'}`}>{count}</span>
    </button>
  )
}

/* ── Upload ───────────────────────────────────────────────────────────────── */
function UploadDocumentModal({ open, onClose, onSaved }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()
  const [title, setTitle]       = useState('')
  const [category, setCategory] = useState('licences')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes]       = useState('')
  const [file, setFile]         = useState(null)
  const [saving, setSaving]     = useState(false)

  const canSave = title.trim() && file && !saving

  const reset = () => { setTitle(''); setCategory('licences'); setExpiryDate(''); setNotes(''); setFile(null) }

  const pickFile = (picked) => {
    if (!picked) return
    if (picked.size > MAX_FILE_SIZE) { toast('File must be under 10 MB', 'error'); return }
    setFile(picked)
    // Suggest a title from the file name if none typed yet
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const ext = file.name.split('.').pop()
    const path = `${venueId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const { error: uploadErr } = await supabase.storage.from('venue-documents').upload(path, file, { upsert: false })
    if (uploadErr) { setSaving(false); toast('File upload failed: ' + uploadErr.message, 'error'); return }

    const { data: urlData } = supabase.storage.from('venue-documents').getPublicUrl(path)
    const { error } = await supabase.from('documents').insert({
      venue_id:    venueId,
      title:       title.trim(),
      category,
      file_url:    urlData.publicUrl,
      file_name:   file.name,
      file_size:   file.size,
      expiry_date: expiryDate || null,
      notes:       notes.trim() || null,
      uploaded_by: session?.staffId ?? null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${title.trim()} uploaded`)
    reset()
    onSaved()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Upload document">
      <div className="flex flex-col gap-5">
        <label
          className={[
            'flex flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed px-4 py-6 text-center cursor-pointer transition-colors',
            file ? 'border-brand/40 bg-brand-tint dark:bg-white/10' : 'border-ink4/70 dark:border-white/20 hover:border-ink3',
          ].join(' ')}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
        >
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            className="sr-only"
            onChange={e => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <>
              <span className="text-[15px] font-semibold text-ink dark:text-white break-all">{file.name}</span>
              <span className="text-sm text-ink3 dark:text-white/45">Tap to choose a different file</span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold text-ink dark:text-white">Choose a file</span>
              <span className="text-sm text-ink3 dark:text-white/45">PDF, photo or Word document · up to 10 MB</span>
            </>
          )}
        </label>

        <label>
          <span className={FIELD_LABEL}>Title</span>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Premises licence" className={TEXT_FIELD} />
        </label>

        <div>
          <span className={FIELD_LABEL}>Category</span>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
                className={[
                  'h-10 px-4 rounded-full border text-[15px] transition-colors',
                  category === c.value
                    ? 'bg-brand-tint border-brand/40 text-brand font-semibold dark:bg-white/10 dark:text-white dark:border-white/30'
                    : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
                ].join(' ')}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className={FIELD_LABEL}>Expiry date <span className="normal-case tracking-normal font-normal">(optional)</span></span>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={TEXT_FIELD} />
        </label>

        <label>
          <span className={FIELD_LABEL}>Notes <span className="normal-case tracking-normal font-normal">(optional)</span></span>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra context" className={TEXT_FIELD} />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="w-full h-[52px] rounded-2xl bg-brand text-white text-[17px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed"
        >
          {saving ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function DocumentsPage() {
  const { venueSlug } = useVenue()
  const { isManager } = useSession()
  const { docs, loading, reload } = useDocuments()

  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('all')
  const [attention, setAttention] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const withStatus = useMemo(() => docs.map(doc => ({ doc, ...documentStatus(doc) })), [docs])
  const expired  = withStatus.filter(d => d.status === 'expired').length
  const expiring = withStatus.filter(d => d.status === 'expiring').length

  const counts = useMemo(() => {
    const out = { all: docs.length }
    for (const c of DOCUMENT_CATEGORIES) out[c.value] = docs.filter(d => d.category === c.value).length
    return out
  }, [docs])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return withStatus
      .filter(d => category === 'all' || d.doc.category === category)
      .filter(d => !attention || d.status === 'expired' || d.status === 'expiring')
      .filter(d => !q || [d.doc.title, d.doc.file_name, d.doc.notes, CATEGORY_LABEL[d.doc.category]]
        .some(text => text?.toLowerCase().includes(q)))
      .sort((a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        (a.status === 'expiring' || a.status === 'expired' ? a.daysLeft - b.daysLeft : 0) ||
        a.doc.title.localeCompare(b.doc.title))
  }, [withStatus, category, attention, search])

  if (loading) return <PageSkeleton />

  const bannerText = [
    expired && `${expired} expired`,
    expiring && `${expiring} expiring within ${EXPIRY_WARNING_DAYS} days`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title="Documents"
        backTo={`/v/${venueSlug}/checks`}
        action={isManager && (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="shrink-0 inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand text-white text-[15px] sm:text-[16px] font-semibold hover:bg-brand/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            Upload
          </button>
        )}
      />

      {/* Search */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink3 dark:text-white/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents"
          aria-label="Search documents"
          className="w-full h-14 pl-12 pr-4 rounded-2xl border border-line dark:border-white/10 bg-white dark:bg-paperDark text-[16px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={category === 'all'} label="All" count={counts.all} onClick={() => setCategory('all')} />
        {DOCUMENT_CATEGORIES.map(c => (
          <FilterChip key={c.value} active={category === c.value} label={c.label} count={counts[c.value]} onClick={() => setCategory(c.value)} />
        ))}
      </div>

      {/* Expiry banner */}
      {bannerText && (
        <button
          type="button"
          onClick={() => setAttention(v => !v)}
          className="w-full flex items-center gap-3 rounded-2xl bg-warnBg dark:bg-warn/20 px-4 sm:px-5 py-3.5 text-left"
        >
          <svg className="shrink-0 w-5 h-5 text-warn dark:text-[#e8b06a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="14" r="8" /><polyline points="12 10 12 14 14.5 15.5" /><line x1="10" y1="2" x2="14" y2="2" /></svg>
          <span className="flex-1 min-w-0 text-[15px] min-[420px]:text-[17px] font-semibold text-ink dark:text-white">{bannerText}</span>
          <span className="shrink-0 text-[15px] min-[420px]:text-[17px] font-semibold text-warn dark:text-[#e8b06a]">{attention ? 'Show all' : 'Review'}</span>
        </button>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <div className={`${CARD} px-5 py-10 text-center`}>
          <p className="text-[17px] font-semibold text-ink dark:text-white">
            {docs.length === 0 ? 'No documents yet' : 'No matching documents'}
          </p>
          <p className="text-sm text-ink3 dark:text-white/45 mt-1">
            {docs.length === 0
              ? (isManager ? 'Upload your licences, insurance and safety records so they’re ready for an inspection.' : 'Nothing has been uploaded yet.')
              : 'Try a different search or category.'}
          </p>
        </div>
      ) : (
        <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
          {visible.map(({ doc, status, daysLeft }) => (
            <a
              key={doc.id}
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 min-[420px]:gap-4 px-4 sm:px-5 py-4 hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
            >
              <span className="shrink-0 w-11 h-11 min-[420px]:w-12 min-[420px]:h-12 rounded-xl bg-cream dark:bg-white/10 border border-line dark:border-white/10 flex items-end justify-center pb-1.5 font-mono text-[11px] font-bold text-ink2 dark:text-white/70">
                {fileExt(doc)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] min-[420px]:text-[17px] leading-snug font-semibold text-ink dark:text-white line-clamp-2 break-words">{doc.title}</span>
                <span className="block text-sm text-ink3 dark:text-white/45 mt-0.5">
                  {CATEGORY_LABEL[doc.category] ?? doc.category} · {doc.expiry_date
                    ? `Expires ${format(parseISO(doc.expiry_date), 'd MMM yyyy')}`
                    : `Added ${format(new Date(doc.created_at), 'd MMM yyyy')}`}
                </span>
              </span>
              <StatusPill status={status} daysLeft={daysLeft} />
            </a>
          ))}
        </div>
      )}

      <UploadDocumentModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onSaved={() => { setShowUpload(false); reload() }}
      />
    </div>
  )
}
