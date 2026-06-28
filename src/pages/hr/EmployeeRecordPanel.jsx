/**
 * EmployeeRecordPanel.jsx
 * Shared employee-record renderer used by both HRHubPage (workspace right pane)
 * and EmployeeRecordPage (full-page / direct URL access).
 *
 * Props:
 *   staffId    – the staff row UUID to display
 *   venueId    – for Supabase queries
 *   venueSlug  – for navigate() links inside tabs
 *   onBack     – if provided, renders a back chevron button; null in workspace mode
 *   tab        – controlled active tab name
 *   setTab     – setter for tab
 *   onUpload   – optional: called when header "Upload doc" button clicked (defaults to switching tab)
 */
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, differenceInDays } from 'date-fns'
import { calculateEntitlementDays, countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Constants ────────────────────────────────────────────────────────────────
export const TABS = ['Profile', 'Documents', 'Disciplinary', 'Leave', 'Training', 'Security']

const TAB_LABELS = {
  Profile: 'Profile', Documents: 'Docs', Disciplinary: 'Conduct',
  Leave: 'Leave', Training: 'Training', Security: 'Security',
}

const FORMAL_LABELS = {
  verbal_warning:        'Verbal Warning',
  written_warning:       'Written Warning',
  final_written_warning: 'Final Written Warning',
  dismissal:             'Dismissal',
  other:                 'Other',
}
const FORMAL_TONE = {
  verbal_warning:        'warn',
  written_warning:       'bad',
  final_written_warning: 'dark-red',
  dismissal:             'inverse',
  other:                 'muted',
}
const DOC_CAT_LABELS = { contract: 'Contract', food_hygiene: 'Food Hygiene', other: 'Other' }
const DOC_CAT_TONE   = {
  contract:     'brand',
  food_hygiene: 'good',
  other:        'muted',
}
const EMPLOYMENT_LABELS = {
  full_time: 'Full-time', part_time: 'Part-time',
  zero_hours: 'Zero hours', fixed_term: 'Fixed term',
}
const DAYS_MAP = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }

// ── Helpers ──────────────────────────────────────────────────────────────────
export function tenure(isoDate) {
  if (!isoDate) return null
  const months = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  const y = Math.floor(months / 12)
  const m = Math.round(months % 12)
  if (y === 0) return `${m} mo`
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`
}

export function nameInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function expiryStatus(dateStr) {
  if (!dateStr) return null
  const d = differenceInDays(parseISO(dateStr), new Date())
  if (d < 0)   return { label: 'Expired',    tone: 'bad'  }
  if (d <= 30) return { label: `${d}d left`, tone: 'warn' }
  return { label: format(parseISO(dateStr), 'd MMM yyyy'), tone: 'good' }
}

// ── Shared atoms ─────────────────────────────────────────────────────────────
export function Avatar({ name, size = 40, color }) {
  const initials = nameInitials(name)
  return (
    <div
      className="rounded-full flex items-center justify-center font-mono font-semibold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, background: color || '#2D4F45' }}
    >
      {initials}
    </div>
  )
}

function badgeClasses(tone) {
  switch (tone) {
    case 'brand':    return 'text-brand bg-brand/8'
    case 'good':     return 'text-success bg-success/10'
    case 'warn':     return 'text-warning bg-warning/10'
    case 'bad':      return 'text-danger bg-danger/10'
    case 'dark-red': return 'text-[#7a1212] bg-danger/10'
    case 'inverse':  return 'text-white bg-charcoal'
    case 'muted':    return 'text-charcoal/50 bg-charcoal/6'
    default:         return 'text-charcoal/50 bg-charcoal/6'
  }
}

export function Badge({ tone, children, dot }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase rounded-full px-[9px] py-[3px] whitespace-nowrap ${badgeClasses(tone)}`}>
      {dot && <span className="w-[5px] h-[5px] rounded-full bg-current" />}
      {children}
    </span>
  )
}

function SectionCard({ children, className }) {
  return (
    <div className={`bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] overflow-hidden shadow-sm ${className ?? ''}`}>
      {children}
    </div>
  )
}

function CardHead({ children }) {
  return (
    <div className="px-[18px] py-3 border-b border-charcoal/6 font-mono text-[11px] uppercase tracking-[0.09em] text-charcoal/50 font-semibold">
      {children}
    </div>
  )
}

function DataRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-3.5 px-[18px] py-[11px] border-b border-charcoal/6">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-charcoal/30 min-w-[120px] pt-px">
        {label}
      </span>
      <span className="text-[13.5px] text-charcoal flex-1">{value}</span>
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center px-5 py-10 text-charcoal/30">
      <div className="mb-2.5 opacity-50 flex justify-center">{icon}</div>
      <p className="text-[13px]">{text}</p>
    </div>
  )
}

function MiniStat({ k, v, tone }) {
  return (
    <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[13px] px-[11px] py-[10px] lg:px-3.5 lg:py-[11px] shadow-sm flex-1 min-w-0">
      <div className="font-mono text-[9px] lg:text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">
        {k}
      </div>
      <div className="mt-[4px] flex items-center">
        {tone
          ? <Badge tone={tone}>{v}</Badge>
          : <span className="text-[14.5px] lg:text-[16px] font-semibold text-charcoal tracking-[-0.01em]">{v}</span>}
      </div>
    </div>
  )
}

function BtnPrimary({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-[7px] px-3.5 py-[9px] rounded-[10px] cursor-pointer text-[12.5px] font-semibold border-0 whitespace-nowrap bg-brand text-white disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function BtnDanger({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-[7px] px-3.5 py-[9px] rounded-[10px] cursor-pointer text-[12.5px] font-semibold whitespace-nowrap bg-danger/10 text-danger border border-danger/10 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function BtnDefault({ onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-[7px] px-3.5 py-[9px] rounded-[10px] cursor-pointer text-[12.5px] font-semibold whitespace-nowrap bg-white dark:bg-paperDark text-charcoal/75 border border-charcoal/10 ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

// SVG icons used in multiple places
const Ico = {
  back:   <svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1L1.5 5.5 6 10"/></svg>,
  plus:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>,
  doc:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  shield: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  cal:    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  grad:   <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  lock:   <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  file:   <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  docSm:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  trash:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
}

// ── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ staff, docsCount, strikesCount, venueSlug }) {
  if (!staff) return <div className="flex justify-center p-10"><LoadingSpinner /></div>

  const strikeTone =
    strikesCount >= 3 ? 'bad'  :
    strikesCount >  0 ? 'warn' :
                        'good'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-[8px]">
        <MiniStat k="Tenure"  v={tenure(staff.start_date) ?? '—'} />
        <MiniStat k="Holiday" v={staff.holiday_balance != null ? `${staff.holiday_balance}d` : '—'} />
        <MiniStat k="Docs"    v={`${docsCount ?? 0}`} />
        <MiniStat k="Strikes" v={`${strikesCount ?? 0}/3`} tone={strikeTone} />
      </div>

      <SectionCard>
        <CardHead>Employment</CardHead>
        <DataRow label="Full name"    value={staff.name} />
        <DataRow label="Job role"     value={staff.job_role} />
        <DataRow label="Contract"     value={EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type} />
        <DataRow label="Start date"   value={staff.start_date ? format(parseISO(staff.start_date), 'd MMMM yyyy') : null} />
        <DataRow label="Hourly rate"  value={staff.hourly_rate != null ? `£${Number(staff.hourly_rate).toFixed(2)} / hr` : null} />
        <DataRow label="Contracted"   value={
          staff.contracted_hours != null
            ? staff.contracted_hours > 0 ? `${staff.contracted_hours} h / week` : 'Variable (zero hours)'
            : null
        } />
        <DataRow label="Working days" value={
          staff.working_days?.length
            ? staff.working_days.map(d => DAYS_MAP[d]).join(', ')
            : null
        } />
        {staff.is_under_18 && <DataRow label="Under 18" value="Yes — restricted hours apply" />}
        <div className="h-1.5" />
      </SectionCard>

      <SectionCard>
        <CardHead>Emergency contact</CardHead>
        {(staff.emergency_contact_name || staff.emergency_contact_phone) ? (
          <>
            <DataRow label="Name"  value={staff.emergency_contact_name} />
            <DataRow label="Phone" value={staff.emergency_contact_phone} />
          </>
        ) : (
          <p className="px-[18px] py-3.5 text-[13px] text-charcoal/30 italic">
            No emergency contact on file
          </p>
        )}
        <div className="h-1.5" />
      </SectionCard>
    </div>
  )
}

// ── Documents Tab ────────────────────────────────────────────────────────────
function DocumentsTab({ staffId, venueId, onDocsCountChange }) {
  const toast = useToast()
  const { session } = useSession()
  const [docs,      setDocs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState({ title: '', category: 'contract', expiry_date: '', notes: '' })
  const [file,      setFile]      = useState(null)
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('staff_hr_documents')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    const rows = data ?? []
    setDocs(rows)
    setLoading(false)
    onDocsCountChange?.(rows.length)
  }, [staffId, onDocsCountChange])

  useEffect(() => { load() }, [load])

  const resetModal = () => {
    setShowModal(false)
    setFile(null)
    setForm({ title: '', category: 'contract', expiry_date: '', notes: '' })
  }

  const upload = async () => {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    if (!file) { toast('Please select a file', 'error'); return }
    if (file.size > 15 * 1024 * 1024) { toast('File must be under 15 MB', 'error'); return }
    setSaving(true)
    const path = `${venueId}/${staffId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
    const { error: upErr } = await supabase.storage.from('hr-documents').upload(path, file, { upsert: false })
    if (upErr) { toast('Upload failed: ' + upErr.message, 'error'); setSaving(false); return }
    const { data: urlData } = supabase.storage.from('hr-documents').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('staff_hr_documents').insert({
      venue_id:    venueId,
      staff_id:    staffId,
      title:       form.title.trim(),
      category:    form.category,
      file_url:    urlData.publicUrl,
      file_name:   file.name,
      file_size:   file.size,
      expiry_date: form.expiry_date || null,
      notes:       form.notes.trim() || null,
      uploaded_by: session?.staffId ?? null,
    })
    setSaving(false)
    if (dbErr) { toast('Failed to save: ' + dbErr.message, 'error'); return }
    toast('Document uploaded')
    resetModal()
    load()
  }

  const deleteDoc = async (doc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    await supabase.from('staff_hr_documents').delete().eq('id', doc.id)
    toast('Document deleted')
    load()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">
          {loading ? '—' : docs.length} documents
        </span>
        <BtnPrimary onClick={() => setShowModal(true)}>
          {Ico.plus} Upload
        </BtnPrimary>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><LoadingSpinner /></div>
      ) : docs.length === 0 ? (
        <EmptyState icon={Ico.file} text="No documents uploaded yet" />
      ) : (
        <SectionCard>
          {docs.map((doc, i) => {
            const catTone = DOC_CAT_TONE[doc.category] ?? DOC_CAT_TONE.other
            const exp     = expiryStatus(doc.expiry_date)
            const daysLeft = doc.expiry_date ? differenceInDays(parseISO(doc.expiry_date), new Date()) : null
            return (
              <div key={doc.id} className={`flex items-center gap-3.5 px-[18px] py-3.5 ${i < docs.length - 1 ? 'border-b border-charcoal/6' : ''}`}>
                <span className="w-[38px] h-[38px] rounded-[10px] bg-charcoal/6 text-charcoal/50 flex items-center justify-center shrink-0">
                  {Ico.docSm}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-charcoal">{doc.title}</div>
                  <div className="flex gap-2 items-center mt-[5px] flex-wrap">
                    <Badge tone={catTone}>{DOC_CAT_LABELS[doc.category] ?? doc.category}</Badge>
                    {exp && daysLeft != null && daysLeft <= 30 && <Badge tone={exp.tone}>{exp.label}</Badge>}
                    <span className="font-mono text-[11px] text-charcoal/30">
                      {format(parseISO(doc.created_at), 'd MMM yyyy')} · {(doc.file_size / 1024).toFixed(0)} KB
                      {doc.expiry_date && daysLeft != null && daysLeft > 30
                        ? ` · expires ${format(parseISO(doc.expiry_date), 'd MMM yyyy')}`
                        : ''}
                    </span>
                  </div>
                </div>
                <div className="flex gap-[7px] shrink-0">
                  <a
                    href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-[7px] px-3 py-1.5 rounded-[10px] text-[11px] font-semibold whitespace-nowrap bg-white dark:bg-paperDark text-charcoal/75 border border-charcoal/10 no-underline"
                  >
                    View
                  </a>
                  <button
                    onClick={() => deleteDoc(doc)}
                    className="inline-flex items-center gap-[7px] px-3 py-1.5 rounded-[10px] text-[11px] font-semibold whitespace-nowrap bg-danger/10 text-danger border border-danger/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </SectionCard>
      )}

      <Modal open={showModal} onClose={resetModal} title="Upload Document">
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Employment Contract 2024"
              className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-[13px] outline-none box-border"
            />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Category</label>
            <div className="flex gap-2">
              {Object.entries(DOC_CAT_LABELS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, category: k }))}
                  className={`flex-1 py-2 rounded-[9px] cursor-pointer font-mono text-[11px] font-bold tracking-[0.04em] border transition-colors ${
                    form.category === k
                      ? 'bg-brand text-white border-brand'
                      : 'bg-transparent text-charcoal/50 border-charcoal/10'
                  }`}
                >{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">File</label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-[13px]" />
            {file && <p className="font-mono text-[11px] text-charcoal/30 mt-1">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Expiry date (optional)</label>
            <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-[13px] outline-none box-border" />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-[13px] outline-none resize-none box-border" />
          </div>
          <button onClick={upload} disabled={saving}
            className="bg-brand text-white border-0 rounded-xl py-[13px] cursor-pointer font-mono text-[13px] font-bold tracking-[0.02em] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Attendance summary stat card ─────────────────────────────────────────────
function AttendanceStat({ label, total, active, dates, tone }) {
  const isWarn = tone === 'warn' && active > 0
  const bg     = isWarn ? '#fff8f0' : '#f5f6f4'
  const numClr = isWarn ? '#a85d12' : '#3d4a44'
  const lblClr = isWarn ? '#a85d12' : '#76817b'

  return (
    <div style={{ background: bg, borderRadius: 12, padding: '14px 16px' }}>
      <p className="font-mono text-[11px] uppercase tracking-[0.07em] font-semibold mb-1" style={{ color: lblClr }}>
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-bold leading-none" style={{ color: numClr }}>
          {active}
        </span>
        <span className="font-mono text-[11px]" style={{ color: lblClr }}>
          active
        </span>
        {total > active && (
          <span className="font-mono text-[11px] text-charcoal/30 ml-auto">
            {total} total
          </span>
        )}
      </div>
      {dates.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-2">
          {dates.slice(0, 3).map((d, i) => (
            <span key={i} className="font-mono text-[11px]" style={{ color: lblClr }}>
              {format(parseISO(d), 'd MMM, HH:mm')}
            </span>
          ))}
          {dates.length > 3 && (
            <span className="font-mono text-[11px] text-charcoal/30">
              +{dates.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Disciplinary Tab ─────────────────────────────────────────────────────────
function DisciplinaryTab({ staffId, venueId, onStrikesCountChange }) {
  const toast = useToast()
  const { session } = useSession()
  const [strikes,     setStrikes]    = useState([])
  const [formals,     setFormals]    = useState([])
  const [lateHistory, setLateHistory] = useState([]) // derived from clock_events + shifts
  const [loading,    setLoading]   = useState(true)
  const [showModal,  setShowModal] = useState(false)
  const [form,       setForm]      = useState({ action_type: 'verbal_warning', occurred_at: new Date().toISOString().slice(0, 10), notes: '' })
  const [file,       setFile]      = useState(null)
  const [saving,     setSaving]    = useState(false)
  const [dismissing, setDismissing] = useState(null) // strike id or 'all'

  const load = useCallback(async () => {
    setLoading(true)
    const [strikeRes, formalRes, clockRes, shiftRes] = await Promise.all([
      supabase.from('staff_disciplinary_log')
        .select('*, dismissed_by_staff:dismissed_by(name)')
        .eq('staff_id', staffId)
        .order('occurred_at', { ascending: false }),
      supabase.from('hr_formal_actions').select('*, added_by_staff:added_by(name)').eq('staff_id', staffId).order('occurred_at', { ascending: false }),
      supabase.from('clock_events')
        .select('id, occurred_at')
        .eq('staff_id', staffId)
        .eq('venue_id', venueId)
        .eq('event_type', 'clock_in')
        .order('occurred_at', { ascending: false }),
      supabase.from('shifts')
        .select('shift_date, start_time')
        .eq('staff_id', staffId)
        .eq('venue_id', venueId),
    ])

    // Derive late clock-ins from raw clock data — the source of truth
    const clockIns = clockRes.data ?? []
    const shifts   = shiftRes.data ?? []
    const shiftMap = {}
    shifts.forEach(s => { shiftMap[s.shift_date] = s.start_time })

    const late = clockIns.flatMap(ev => {
      const date      = ev.occurred_at.slice(0, 10)
      const startTime = shiftMap[date]
      if (!startTime) return []
      const shiftStart  = new Date(`${date}T${startTime}`)
      const clockedIn   = new Date(ev.occurred_at)
      const msLate      = Math.floor(clockedIn.getTime() / 60000) * 60000
                        - Math.floor(shiftStart.getTime() / 60000) * 60000
      if (msLate < 60000) return [] // < 1 whole minute — not late
      return [{ id: ev.id, occurred_at: ev.occurred_at, minsLate: Math.floor(msLate / 60000), scheduledTime: startTime }]
    })
    setLateHistory(late)

    const rows = strikeRes.data ?? []
    setStrikes(rows)
    setFormals(formalRes.data ?? [])
    setLoading(false)
    onStrikesCountChange?.(late.length)
  }, [staffId, onStrikesCountChange])

  useEffect(() => { load() }, [load])

  const activeStrikes = strikes.filter(s => !s.dismissed_at)

  const timeline = [...strikes.map(s => ({ ...s, _type: 'strike', _date: s.occurred_at })),
                    ...formals.map(f => ({ ...f, _type: 'formal', _date: f.occurred_at }))]
    .sort((a, b) => new Date(b._date) - new Date(a._date))

  const addFormal = async () => {
    if (!form.occurred_at) { toast('Date is required', 'error'); return }
    setSaving(true)
    let fileUrl = null, fileName = null
    if (file) {
      if (file.size > 15 * 1024 * 1024) { toast('File must be under 15 MB', 'error'); setSaving(false); return }
      const path = `${venueId}/${staffId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
      const { error: upErr } = await supabase.storage.from('hr-documents').upload(path, file, { upsert: false })
      if (upErr) { toast('File upload failed: ' + upErr.message, 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('hr-documents').getPublicUrl(path)
      fileUrl  = urlData.publicUrl
      fileName = file.name
    }
    const { error } = await supabase.from('hr_formal_actions').insert({
      venue_id:    venueId,
      staff_id:    staffId,
      action_type: form.action_type,
      occurred_at: form.occurred_at,
      notes:       form.notes.trim() || null,
      file_url:    fileUrl,
      file_name:   fileName,
      added_by:    session?.staffId ?? null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Formal action recorded')
    setShowModal(false)
    setForm({ action_type: 'verbal_warning', occurred_at: new Date().toISOString().slice(0, 10), notes: '' })
    setFile(null)
    load()
  }

  const deleteFormal = async (id) => {
    if (!confirm('Delete this disciplinary record? This cannot be undone.')) return
    await supabase.from('hr_formal_actions').delete().eq('id', id)
    toast('Record deleted')
    load()
  }

  const dismissStrike = async (strikeId) => {
    setDismissing(strikeId)
    const { error } = await supabase.from('staff_disciplinary_log')
      .update({ dismissed_at: new Date().toISOString(), dismissed_by: session?.staffId ?? null })
      .eq('id', strikeId)
    setDismissing(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Strike dismissed')
    load()
  }

  const dismissAllStrikes = async () => {
    if (!confirm('Clear all active strikes for this staff member?')) return
    setDismissing('all')
    const { error } = await supabase.from('staff_disciplinary_log')
      .update({ dismissed_at: new Date().toISOString(), dismissed_by: session?.staffId ?? null })
      .eq('staff_id', staffId)
      .is('dismissed_at', null)
    setDismissing(null)
    if (error) { toast(error.message, 'error'); return }
    toast('All strikes cleared')
    load()
  }

  const OFFENCE_LABELS = { late_clock_in: 'Late clock-in', break_overrun: 'Break overrun' }

  const breakAll    = strikes.filter(s => s.offence_type === 'break_overrun')
  const breakActive = breakAll.filter(s => !s.dismissed_at)

  return (
    <div className="flex flex-col gap-3.5">

      {/* ── Attendance summary ─────────────────────────────────────────────── */}
      {!loading && (lateHistory.length > 0 || breakAll.length > 0) && (
        <div className="grid grid-cols-2 gap-2.5">
          <AttendanceStat
            label="Late clock-ins"
            total={lateHistory.length}
            active={lateHistory.length}
            dates={lateHistory.map(s => s.occurred_at)}
            tone={lateHistory.length > 0 ? 'warn' : 'neutral'}
          />
          <AttendanceStat
            label="Break overruns"
            total={breakAll.length}
            active={breakActive.length}
            dates={breakActive.map(s => s.occurred_at)}
            tone="neutral"
          />
        </div>
      )}

      {/* ── Late clock-in history (ground truth from clock_events + shifts) ── */}
      {!loading && lateHistory.length > 0 && (
        <>
          <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">
            Late clock-ins ({lateHistory.length})
          </span>
          <SectionCard>
            {lateHistory.map((item, i) => (
              <div key={item.id} className={`flex items-center gap-3 px-[18px] py-[13px] ${i < lateHistory.length - 1 ? 'border-b border-charcoal/6' : ''}`}>
                <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center font-mono text-[11px] font-bold text-warning shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-charcoal/75">
                    {item.minsLate} min{item.minsLate !== 1 ? 's' : ''} late
                    <span className="font-mono text-[11px] font-normal text-charcoal/30 ml-2">
                      scheduled {item.scheduledTime.slice(0, 5)}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-charcoal/30 mt-[3px]">
                    {format(parseISO(item.occurred_at), 'd MMM yyyy, HH:mm')}
                  </div>
                </div>
              </div>
            ))}
          </SectionCard>
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">
          Timeline
        </span>
        <div className="flex gap-2">
          {activeStrikes.length > 0 && (
            <button
              onClick={dismissAllStrikes}
              disabled={dismissing === 'all'}
              className="inline-flex items-center gap-[7px] px-3.5 py-[9px] rounded-[10px] cursor-pointer text-[12.5px] font-semibold whitespace-nowrap bg-warning/10 text-warning border border-warning/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {dismissing === 'all' ? 'Clearing…' : 'Reset all strikes'}
            </button>
          )}
          <BtnDanger onClick={() => setShowModal(true)}>
            {Ico.plus} Add formal action
          </BtnDanger>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><LoadingSpinner /></div>
      ) : timeline.length === 0 ? (
        <EmptyState icon={Ico.shield} text="No disciplinary history on file" />
      ) : (
        <SectionCard>
          {timeline.map((item, i) => {
            const isLast = i === timeline.length - 1
            if (item._type === 'formal') {
              const tone = FORMAL_TONE[item.action_type] ?? FORMAL_TONE.other
              return (
                <div key={`f-${item.id}`} className={`px-[18px] py-[15px] ${isLast ? '' : 'border-b border-charcoal/6'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[9px] flex-wrap">
                        <Badge tone={tone}>{FORMAL_LABELS[item.action_type] ?? item.action_type}</Badge>
                        <span className="font-mono text-[11px] text-charcoal/30">
                          {format(parseISO(item.occurred_at), 'd MMM yyyy')}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-[13px] text-charcoal/75 mt-2 leading-[1.5]">{item.notes}</p>
                      )}
                      <div className="flex gap-3 mt-2 items-center flex-wrap">
                        {item.added_by_staff?.name && (
                          <span className="font-mono text-[11px] text-charcoal/30">Added by {item.added_by_staff.name}</span>
                        )}
                        {item.file_url && (
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-[11px] text-brand font-bold no-underline">
                            📎 {item.file_name ?? 'Attachment'}
                          </a>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteFormal(item.id)} title="Delete"
                      className="bg-transparent border-0 cursor-pointer p-1 text-charcoal/30 shrink-0">
                      {Ico.trash}
                    </button>
                  </div>
                </div>
              )
            }
            if (item.dismissed_at) {
              return (
                <div key={`s-${item.id}`} className={`flex items-start gap-3 px-[18px] py-[13px] opacity-40 ${isLast ? '' : 'border-b border-charcoal/6'}`}>
                  <div className="w-7 h-7 rounded-lg bg-charcoal/6 text-charcoal/40 flex items-center justify-center font-mono text-[11px] font-bold shrink-0 line-through">
                    {item.strike_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-charcoal/50 line-through">
                      Strike {item.strike_number} — {OFFENCE_LABELS[item.offence_type] ?? item.offence_type}
                      {item.mins_over != null && (
                        <span className="font-mono text-[11px] font-normal ml-1.5">{item.mins_over} min over</span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-charcoal/30 mt-[3px]">
                      {format(parseISO(item.occurred_at), 'd MMM yyyy, HH:mm')}
                      {item.dismissed_by_staff?.name && (
                        <> · Dismissed by {item.dismissed_by_staff.name} on {format(parseISO(item.dismissed_at), 'd MMM')}</>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-charcoal/30 uppercase tracking-[0.05em] shrink-0 mt-[3px]">Dismissed</span>
                </div>
              )
            }
            return (
              <div key={`s-${item.id}`} className={`flex items-start gap-3 px-[18px] py-[13px] ${isLast ? '' : 'border-b border-charcoal/6'}`}>
                <div className="w-7 h-7 rounded-lg bg-charcoal/6 text-charcoal/50 flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                  {item.strike_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-charcoal/75">
                    Strike {item.strike_number} — {OFFENCE_LABELS[item.offence_type] ?? item.offence_type}
                    {item.mins_over != null && (
                      <span className="font-mono text-[11px] text-charcoal/30 font-normal ml-1.5">
                        {item.mins_over} min over
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-charcoal/30 mt-[3px]">
                    {format(parseISO(item.occurred_at), 'd MMM yyyy, HH:mm')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-[3px]">
                  <span className="font-mono text-[11px] text-charcoal/30 uppercase tracking-[0.05em]">Auto</span>
                  <button
                    onClick={() => dismissStrike(item.id)}
                    disabled={!!dismissing}
                    className="px-2.5 py-1 rounded-[8px] border border-charcoal/10 bg-transparent text-charcoal/40 cursor-pointer font-mono text-[11px] font-semibold tracking-[0.03em] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dismissing === item.id ? '…' : 'Dismiss'}
                  </button>
                </div>
              </div>
            )
          })}
        </SectionCard>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setFile(null) }} title="Add Formal Action">
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Action type</label>
            <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-[13px] outline-none bg-white dark:bg-paperDark box-border">
              {Object.entries(FORMAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Date</label>
            <input type="date" value={form.occurred_at} onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-[13px] outline-none box-border" />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              placeholder="Details, outcome, follow-up actions…"
              className="w-full px-3 py-2.5 rounded-[10px] border border-charcoal/10 text-[13px] outline-none resize-none box-border" />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 mb-1.5">Attachment (optional)</label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-[13px]" />
          </div>
          <button onClick={addFormal} disabled={saving}
            className="bg-danger text-white border-0 rounded-xl py-[13px] cursor-pointer font-mono text-[13px] font-bold tracking-[0.02em] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Record Action'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Leave Tab ────────────────────────────────────────────────────────────────
function LeaveTab({ staffId, venueSlug, staff }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    supabase.from('time_off_requests').select('*').eq('staff_id', staffId).order('start_date', { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setLoading(false) })
  }, [staffId])

  const STATUS_TONE = {
    approved: 'good',
    pending:  'warn',
    rejected: 'bad',
  }
  const LEAVE_LABELS = { annual: 'Annual', unpaid: 'Unpaid', other: 'Other' }

  const eligible   = staff?.holiday_pay_eligible !== false
  const isZeroHrs  = staff?.employment_type === 'zero_hours'
  const allowance  = eligible ? calculateEntitlementDays(staff?.employment_type, staff?.working_days) : null
  const taken      = requests
    .filter(r => r.status === 'approved' && r.leave_type === 'annual' && r.start_date?.startsWith(String(currentYear)))
    .reduce((sum, r) => sum + countWorkingDaysInRequest(r.start_date, r.end_date, staff?.working_days), 0)
  const remaining  = allowance != null ? Math.max(0, allowance - taken) : null

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-3 gap-[13px]">
        {[
          { k: 'Allowance', v: isZeroHrs ? 'Accrual' : allowance != null ? `${allowance} days` : '—' },
          { k: 'Taken',     v: `${taken} days` },
          { k: 'Remaining', v: remaining != null ? `${remaining} days` : '—' },
        ].map(x => (
          <div key={x.k} className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] px-4 py-[13px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">{x.k}</div>
            <div className="text-xl font-semibold text-charcoal mt-[3px] font-mono tracking-[-0.02em]">{x.v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><LoadingSpinner /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Ico.cal} text="No leave requests on record" />
      ) : (
        <SectionCard>
          {requests.map((r, i) => {
            const tone = STATUS_TONE[r.status] ?? STATUS_TONE.pending
            return (
              <div key={r.id} className={`flex items-center gap-3 px-[18px] py-[13px] ${i < requests.length - 1 ? 'border-b border-charcoal/6' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-charcoal">
                    {format(parseISO(r.start_date), 'd MMM')} – {format(parseISO(r.end_date), 'd MMM yyyy')}
                  </div>
                  <div className="flex gap-2 mt-1 items-center">
                    <Badge tone="muted">{LEAVE_LABELS[r.leave_type] ?? r.leave_type}</Badge>
                    {r.reason && <span className="font-mono text-[11px] text-charcoal/30">{r.reason}</span>}
                  </div>
                </div>
                <Badge tone={tone} dot>{r.status}</Badge>
              </div>
            )
          })}
        </SectionCard>
      )}

      <button onClick={() => navigate(`/v/${venueSlug}/time-off`)}
        className="bg-transparent border border-charcoal/10 rounded-xl px-4 py-[11px] cursor-pointer font-mono text-[11px] font-semibold tracking-[0.05em] text-charcoal/50 text-center flex items-center justify-center gap-1.5"
      >
        Manage in Time Off
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l3 3.5L1 8"/></svg>
      </button>
    </div>
  )
}

// ── Training Tab ─────────────────────────────────────────────────────────────
function TrainingTab({ staffId, venueSlug }) {
  const navigate = useNavigate()
  const [certs,      setCerts]      = useState([])
  const [inductions, setInductions] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('staff_training').select('*').eq('staff_id', staffId).order('expiry_date', { ascending: true }),
      supabase.from('training_sign_offs').select('*').eq('staff_id', staffId).order('training_date', { ascending: false }),
    ]).then(([certRes, indRes]) => {
      setCerts(certRes.data ?? [])
      setInductions(indRes.data ?? [])
      setLoading(false)
    })
  }, [staffId])

  const certStatus = (expiry) => {
    if (!expiry) return { label: 'No expiry', tone: 'muted' }
    const d = differenceInDays(parseISO(expiry), new Date())
    if (d < 0)   return { label: 'Expired',  tone: 'bad'  }
    if (d <= 30) return { label: `${d}d`,    tone: 'warn' }
    return { label: format(parseISO(expiry), 'd MMM yy'), tone: 'good' }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {loading ? (
        <div className="flex justify-center p-8"><LoadingSpinner /></div>
      ) : (
        <>
          <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">
            Certificates · {certs.length}
          </span>
          {certs.length === 0
            ? <EmptyState icon={Ico.grad} text="No certificates on file" />
            : (
              <SectionCard>
                {certs.map((c, i) => {
                  const st = certStatus(c.expiry_date)
                  return (
                    <div key={c.id} className={`flex items-center gap-3 px-[18px] py-[13px] ${i < certs.length - 1 ? 'border-b border-charcoal/6' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-charcoal">{c.title}</div>
                        {c.category && <div className="font-mono text-[11px] text-charcoal/30 mt-0.5 uppercase tracking-[0.03em]">{c.category}</div>}
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  )
                })}
              </SectionCard>
            )
          }

          <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold mt-1">
            Induction records · {inductions.length}
          </span>
          {inductions.length === 0
            ? <EmptyState icon={Ico.grad} text="No induction records on file" />
            : (
              <SectionCard>
                {inductions.map((ind, i) => (
                  <div key={ind.id} className={`flex items-center justify-between gap-2.5 px-[18px] py-[13px] ${i < inductions.length - 1 ? 'border-b border-charcoal/6' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-charcoal">
                        Induction — {ind.trainer_name ?? 'Unknown trainer'}
                      </div>
                      <div className="font-mono text-[11px] text-charcoal/30 mt-[3px]">
                        {format(parseISO(ind.training_date), 'd MMM yyyy')}
                      </div>
                    </div>
                    <Badge tone={ind.staff_acknowledged ? 'good' : 'warn'} dot>
                      {ind.staff_acknowledged ? 'Signed' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </SectionCard>
            )
          }
        </>
      )}

      <button onClick={() => navigate(`/v/${venueSlug}/training`)}
        className="bg-transparent border border-charcoal/10 rounded-xl px-4 py-[11px] cursor-pointer font-mono text-[11px] font-semibold tracking-[0.05em] text-charcoal/50 text-center flex items-center justify-center gap-1.5"
      >
        Manage in Training
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l3 3.5L1 8"/></svg>
      </button>
    </div>
  )
}

// ── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab({ staffId }) {
  const toast = useToast()
  const { session } = useSession()
  const token = session?.token
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [revoking, setRevoking] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_staff_sessions', {
      p_session_token: token,
      p_staff_id:      staffId,
    })
    if (error) toast(error.message, 'error')
    setSessions(data ?? [])
    setLoading(false)
  }, [staffId, token, toast])

  useEffect(() => { load() }, [load])

  const handleRevoke = async (targetToken) => {
    setRevoking(targetToken)
    const { error } = await supabase.rpc('revoke_staff_session', {
      p_session_token: token,
      p_target_token:  targetToken,
    })
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Session revoked', 'success')
      setSessions(s => s.filter(x => x.token !== targetToken))
    }
    setRevoking(null)
  }

  return (
    <div className="flex flex-col gap-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-charcoal/50 font-semibold">
        Active sessions · {loading ? '—' : sessions.length}
      </span>
      {loading ? (
        <div className="flex justify-center p-8"><LoadingSpinner /></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Ico.lock} text="No active sessions" />
      ) : (
        <SectionCard>
          {sessions.map((s, i) => (
            <div key={s.token} className={`flex items-center gap-3 px-[18px] py-[13px] ${i < sessions.length - 1 ? 'border-b border-charcoal/6' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-charcoal">{s.device_label ?? 'Unknown device'}</div>
                <div className="font-mono text-[11px] text-charcoal/30 mt-[3px]">
                  Started {format(parseISO(s.created_at), 'd MMM yyyy, HH:mm')} · Expires {format(parseISO(s.expires_at), 'd MMM yyyy')}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(s.token)}
                disabled={revoking === s.token}
                className="px-3 py-1.5 rounded-lg border border-danger bg-transparent text-danger cursor-pointer font-mono text-[11px] font-bold tracking-[0.04em] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {revoking === s.token ? '…' : 'Revoke'}
              </button>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  )
}

// ── EmployeeRecordPanel (default export) ──────────────────────────────────────
export default function EmployeeRecordPanel({ staffId, venueId, venueSlug, onBack, tab, setTab }) {
  const navigate = useNavigate()
  const [staff,         setStaff]         = useState(null)
  const [docsCount,     setDocsCount]     = useState(0)
  const [strikesCount,  setStrikesCount]  = useState(0)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!staffId) return
    setStaff(null)
    setLoading(true)
    Promise.all([
      supabase.from('staff')
        .select('id, name, job_role, employment_type, start_date, hourly_rate, contracted_hours, working_days, is_under_18, emergency_contact_name, emergency_contact_phone, holiday_pay_eligible')
        .eq('id', staffId)
        .maybeSingle(),
      supabase.from('staff_hr_documents')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', staffId),
      supabase.from('staff_disciplinary_log')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', staffId)
        .is('dismissed_at', null),
    ]).then(([staffRes, docsRes, strikesRes]) => {
      setStaff(staffRes.data)
      setDocsCount(docsRes.count ?? 0)
      setStrikesCount(strikesRes.count ?? 0)
      setLoading(false)
    })
  }, [staffId])

  if (!staffId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-charcoal/30 gap-3 p-10">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <p className="text-[13px]">Select a staff member to view their record</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[14px] lg:block">
      {onBack && (
        <button onClick={onBack} className="bg-transparent border-0 cursor-pointer lg:pb-3.5 flex items-center gap-[7px] font-mono text-[11px] font-semibold text-charcoal/50 tracking-[0.04em] self-start">
          {Ico.back} HR Records
        </button>
      )}

      {/* Identity row */}
      <div className="flex items-center gap-[13px] lg:gap-[15px] lg:mb-[18px]">
        {loading
          ? <div className="w-[52px] h-[52px] lg:w-14 lg:h-14 rounded-[15px] bg-charcoal/6 shrink-0" />
          : <Avatar name={staff?.name ?? ''} size={52} />
        }
        <div className="flex-1 min-w-0">
          <div className="text-[18px] lg:text-[23px] font-semibold lg:font-bold tracking-[-0.015em] lg:tracking-[-0.02em] text-charcoal leading-tight">
            {loading ? <span className="text-charcoal/30">Loading…</span> : (staff?.name ?? '—')}
          </div>
          {!loading && staff && (
            <>
              {/* Mobile: compact single-line */}
              <div className="lg:hidden text-[12.5px] text-charcoal/50 mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap">
                {staff.job_role}{staff.employment_type ? ` · ${EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type}` : ''}{staff.start_date ? ` · ${tenure(staff.start_date)}` : ''}
              </div>
              {/* Desktop: multi-line */}
              <div className="hidden lg:flex items-center gap-[11px] mt-[5px] flex-wrap">
                <span className="text-[13.5px] text-charcoal/50">{staff.job_role}</span>
                {staff.employment_type && (
                  <>
                    <span className="w-px h-3 bg-charcoal/10" />
                    <span className="font-mono text-[11px] text-charcoal/50">
                      {EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type}
                      {staff.start_date && ` · ${tenure(staff.start_date)}`}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {/* Desktop: inline buttons */}
        <div className="hidden lg:flex gap-2 shrink-0">
          <BtnDefault onClick={() => navigate(`/v/${venueSlug}/settings`)}>
            {Ico.edit} Edit
          </BtnDefault>
          <BtnPrimary onClick={() => setTab('Documents')}>
            {Ico.doc} Upload doc
          </BtnPrimary>
        </div>
      </div>

      {/* Mobile: full-width action buttons */}
      <div className="flex lg:hidden gap-2">
        <BtnDefault onClick={() => navigate(`/v/${venueSlug}/settings`)} className="flex-1 justify-center">
          {Ico.edit} Edit
        </BtnDefault>
        <button
          onClick={() => setTab('Documents')}
          className="flex-1 inline-flex items-center justify-center gap-[7px] px-3.5 py-[9px] rounded-[10px] cursor-pointer text-[12.5px] font-semibold border-0 whitespace-nowrap bg-brand text-white"
        >
          {Ico.doc} Upload doc
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 lg:mb-5 bg-charcoal/6 rounded-[11px] p-[3px]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-[7px] lg:py-2 px-0 border-0 cursor-pointer rounded-[8px] font-mono text-[10px] lg:text-[11px] tracking-[0] transition-all duration-150 ${
              tab === t
                ? 'bg-white dark:bg-paperDark text-charcoal font-bold shadow-[0_1px_3px_rgba(13,26,20,0.10)]'
                : 'bg-transparent text-charcoal/50 font-semibold'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'Profile'      && <ProfileTab      staff={staff} docsCount={docsCount} strikesCount={strikesCount} venueSlug={venueSlug} />}
      {tab === 'Documents'    && <DocumentsTab    staffId={staffId} venueId={venueId} onDocsCountChange={setDocsCount} />}
      {tab === 'Disciplinary' && <DisciplinaryTab staffId={staffId} venueId={venueId} onStrikesCountChange={setStrikesCount} />}
      {tab === 'Leave'        && <LeaveTab        staffId={staffId} venueSlug={venueSlug} staff={staff} />}
      {tab === 'Training'     && <TrainingTab     staffId={staffId} venueSlug={venueSlug} />}
      {tab === 'Security'     && <SecurityTab     staffId={staffId} />}
    </div>
  )
}
