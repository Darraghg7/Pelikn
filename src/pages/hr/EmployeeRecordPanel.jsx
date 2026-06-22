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
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Design tokens ────────────────────────────────────────────────────────────
export const MC = {
  ink: '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line: '#e4e6e2', line2: '#eef0ec',
  bg: '#f3f3ef', paper: '#ffffff',
  brand: '#13362a', brandSoft: '#e2ece7', brandTint: '#eef4f0',
  good: '#1a7a4c', goodBg: '#e3f0e7',
  warn: '#a85d12', warnBg: '#fbeedc',
  bad:  '#b3331c', badBg:  '#fbeae6',
}
export const MM = '"Geist Mono", ui-monospace, "SF Mono", monospace'
export const MF = '"Geist", -apple-system, "SF Pro Text", system-ui, sans-serif'

// ── Constants ────────────────────────────────────────────────────────────────
export const TABS = ['Profile', 'Documents', 'Disciplinary', 'Leave', 'Training', 'Security']

const FORMAL_LABELS = {
  verbal_warning:        'Verbal Warning',
  written_warning:       'Written Warning',
  final_written_warning: 'Final Written Warning',
  dismissal:             'Dismissal',
  other:                 'Other',
}
const FORMAL_TONE = {
  verbal_warning:        { fg: MC.warn,   bg: MC.warnBg },
  written_warning:       { fg: MC.bad,    bg: MC.badBg  },
  final_written_warning: { fg: '#7a1212', bg: '#fbeae6' },
  dismissal:             { fg: '#ffffff', bg: '#0d1a14' },
  other:                 { fg: MC.ink3,   bg: MC.line2  },
}
const DOC_CAT_LABELS = { contract: 'Contract', food_hygiene: 'Food Hygiene', other: 'Other' }
const DOC_CAT_TONE   = {
  contract:     { fg: MC.brand, bg: MC.brandTint },
  food_hygiene: { fg: MC.good,  bg: MC.goodBg    },
  other:        { fg: MC.ink3,  bg: MC.line2     },
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
  if (d < 0)   return { label: 'Expired',    tone: { fg: MC.bad,  bg: MC.badBg  } }
  if (d <= 30) return { label: `${d}d left`, tone: { fg: MC.warn, bg: MC.warnBg } }
  return { label: format(parseISO(dateStr), 'd MMM yyyy'), tone: { fg: MC.good, bg: MC.goodBg } }
}

// ── Shared atoms ─────────────────────────────────────────────────────────────
export function Avatar({ name, size = 40, radius = 11 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: MC.brandTint, color: MC.brand,
      display: 'grid', placeItems: 'center',
      fontFamily: MM, fontSize: Math.round(size * 0.34), fontWeight: 700, letterSpacing: '0.01em',
    }}>
      {nameInitials(name)}
    </span>
  )
}

export function Badge({ tone, children, dot }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: MM, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', borderRadius: 999, padding: '3px 9px',
      color: tone.fg, background: tone.bg, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  )
}

function SectionCard({ children, style }) {
  return (
    <div style={{
      background: MC.paper, border: `1px solid ${MC.line}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(13,26,20,0.03)', ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ children }) {
  return (
    <div style={{
      padding: '12px 18px', borderBottom: `1px solid ${MC.line2}`,
      fontFamily: MM, fontSize: 10, textTransform: 'uppercase',
      letterSpacing: '0.09em', color: MC.ink3, fontWeight: 600,
    }}>
      {children}
    </div>
  )
}

function DataRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', gap: 14, padding: '11px 18px', borderBottom: `1px solid ${MC.line2}` }}>
      <span style={{
        fontFamily: MM, fontSize: 10, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: MC.ink4, minWidth: 120, paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13.5, color: MC.ink, flex: 1 }}>{value}</span>
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: MC.ink4, fontFamily: MF }}>
      <div style={{ marginBottom: 10, opacity: 0.5, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <p style={{ fontSize: 13 }}>{text}</p>
    </div>
  )
}

function MiniStat({ k, v, tone }) {
  return (
    <div style={{
      background: MC.paper, border: `1px solid ${MC.line}`,
      borderRadius: 13, padding: '11px 14px',
      boxShadow: '0 1px 2px rgba(13,26,20,0.03)',
    }}>
      <div style={{
        fontFamily: MM, fontSize: 9, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600,
      }}>
        {k}
      </div>
      <div style={{ marginTop: 5, display: 'flex', alignItems: 'center' }}>
        {tone
          ? <Badge tone={tone}>{v}</Badge>
          : <span style={{ fontSize: 16, fontWeight: 600, color: MC.ink, letterSpacing: '-0.01em' }}>{v}</span>}
      </div>
    </div>
  )
}

function btn(variant) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px',
    borderRadius: 10, cursor: 'pointer', fontFamily: MF, fontSize: 12.5,
    fontWeight: 600, border: 'none', whiteSpace: 'nowrap',
  }
  if (variant === 'primary') return { ...base, background: MC.brand, color: '#fff' }
  if (variant === 'danger')  return { ...base, background: MC.badBg, color: MC.bad, border: `1px solid ${MC.badBg}` }
  return { ...base, background: MC.paper, color: MC.ink2, border: `1px solid ${MC.line}` }
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
  if (!staff) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>

  const strikeTone =
    strikesCount >= 3 ? { fg: MC.bad,  bg: MC.badBg  } :
    strikesCount >  0 ? { fg: MC.warn, bg: MC.warnBg } :
                        { fg: MC.good, bg: MC.goodBg  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mini-stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 11 }}>
        <MiniStat k="Tenure"       v={tenure(staff.start_date) ?? '—'} />
        <MiniStat k="Holiday left" v={staff.holiday_balance != null ? `${staff.holiday_balance} days` : '—'} />
        <MiniStat k="Documents"    v={`${docsCount ?? 0} on file`} />
        <MiniStat k="Strikes"      v={`${strikesCount ?? 0} / 3`} tone={strikeTone} />
      </div>

      {/* Employment */}
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
        <div style={{ height: 6 }} />
      </SectionCard>

      {/* Emergency contact */}
      <SectionCard>
        <CardHead>Emergency contact</CardHead>
        {(staff.emergency_contact_name || staff.emergency_contact_phone) ? (
          <>
            <DataRow label="Name"  value={staff.emergency_contact_name} />
            <DataRow label="Phone" value={staff.emergency_contact_phone} />
          </>
        ) : (
          <p style={{ padding: '14px 18px', fontSize: 13, color: MC.ink4, fontStyle: 'italic' }}>
            No emergency contact on file
          </p>
        )}
        <div style={{ height: 6 }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: MM, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600 }}>
          {loading ? '—' : docs.length} documents
        </span>
        <button style={{ ...btn('primary'), marginLeft: 'auto' }} onClick={() => setShowModal(true)}>
          {Ico.plus} Upload
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : docs.length === 0 ? (
        <EmptyState icon={Ico.file} text="No documents uploaded yet" />
      ) : (
        <SectionCard>
          {docs.map((doc, i) => {
            const catTone = DOC_CAT_TONE[doc.category] ?? DOC_CAT_TONE.other
            const exp     = expiryStatus(doc.expiry_date)
            const daysLeft = doc.expiry_date ? differenceInDays(parseISO(doc.expiry_date), new Date()) : null
            return (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                borderBottom: i < docs.length - 1 ? `1px solid ${MC.line2}` : 'none',
              }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 10, background: MC.line2,
                  color: MC.ink3, display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  {Ico.docSm}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: MC.ink }}>{doc.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                    <Badge tone={catTone}>{DOC_CAT_LABELS[doc.category] ?? doc.category}</Badge>
                    {exp && daysLeft != null && daysLeft <= 30 && <Badge tone={exp.tone}>{exp.label}</Badge>}
                    <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>
                      {format(parseISO(doc.created_at), 'd MMM yyyy')} · {(doc.file_size / 1024).toFixed(0)} KB
                      {doc.expiry_date && daysLeft != null && daysLeft > 30
                        ? ` · expires ${format(parseISO(doc.expiry_date), 'd MMM yyyy')}`
                        : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <a
                    href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ ...btn('default'), padding: '6px 12px', fontSize: 11, textDecoration: 'none' }}
                  >
                    View
                  </a>
                  <button
                    onClick={() => deleteDoc(doc)}
                    style={{ ...btn('danger'), padding: '6px 12px', fontSize: 11 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Title</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Employment Contract 2024"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Category</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(DOC_CAT_LABELS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, category: k }))} style={{
                  flex: 1, padding: '8px 0', borderRadius: 9, cursor: 'pointer',
                  border: `1px solid ${form.category === k ? MC.brand : MC.line}`,
                  background: form.category === k ? MC.brand : 'transparent',
                  color: form.category === k ? '#fff' : MC.ink3,
                  fontFamily: MM, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>File</label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ width: '100%', fontSize: 13, fontFamily: MF }} />
            {file && <p style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 4 }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Expiry date (optional)</label>
            <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={upload} disabled={saving} style={{
            background: MC.brand, color: '#fff', border: 'none', borderRadius: 12,
            padding: '13px 0', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: MM, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
          }}>
            {saving ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Disciplinary Tab ─────────────────────────────────────────────────────────
function DisciplinaryTab({ staffId, venueId }) {
  const toast = useToast()
  const { session } = useSession()
  const [strikes,   setStrikes]   = useState([])
  const [formals,   setFormals]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState({ action_type: 'verbal_warning', occurred_at: new Date().toISOString().slice(0, 10), notes: '' })
  const [file,      setFile]      = useState(null)
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [strikeRes, formalRes] = await Promise.all([
      supabase.from('staff_disciplinary_log').select('*').eq('staff_id', staffId).order('occurred_at', { ascending: false }),
      supabase.from('hr_formal_actions').select('*, added_by_staff:added_by(name)').eq('staff_id', staffId).order('occurred_at', { ascending: false }),
    ])
    setStrikes(strikeRes.data ?? [])
    setFormals(formalRes.data ?? [])
    setLoading(false)
  }, [staffId])

  useEffect(() => { load() }, [load])

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

  const OFFENCE_LABELS = { late_clock_in: 'Late clock-in', break_overrun: 'Break overrun' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: MM, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600 }}>
          Timeline
        </span>
        <button style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={() => setShowModal(true)}>
          {Ico.plus} Add formal action
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : timeline.length === 0 ? (
        <EmptyState icon={Ico.shield} text="No disciplinary history on file" />
      ) : (
        <SectionCard>
          {timeline.map((item, i) => {
            const isLast = i === timeline.length - 1
            if (item._type === 'formal') {
              const tone = FORMAL_TONE[item.action_type] ?? FORMAL_TONE.other
              return (
                <div key={`f-${item.id}`} style={{ padding: '15px 18px', borderBottom: isLast ? 'none' : `1px solid ${MC.line2}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <Badge tone={tone}>{FORMAL_LABELS[item.action_type] ?? item.action_type}</Badge>
                        <span style={{ fontFamily: MM, fontSize: 10.5, color: MC.ink4 }}>
                          {format(parseISO(item.occurred_at), 'd MMM yyyy')}
                        </span>
                      </div>
                      {item.notes && (
                        <p style={{ fontSize: 13, color: MC.ink2, margin: '8px 0 0', lineHeight: 1.5 }}>{item.notes}</p>
                      )}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {item.added_by_staff?.name && (
                          <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>Added by {item.added_by_staff.name}</span>
                        )}
                        {item.file_url && (
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: MM, fontSize: 10, color: MC.brand, fontWeight: 700, textDecoration: 'none' }}>
                            📎 {item.file_name ?? 'Attachment'}
                          </a>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteFormal(item.id)} title="Delete"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: MC.ink4, flexShrink: 0 }}>
                      {Ico.trash}
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <div key={`s-${item.id}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '13px 18px', borderBottom: isLast ? 'none' : `1px solid ${MC.line2}`, opacity: 0.85,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: MC.line2, color: MC.ink3,
                  display: 'grid', placeItems: 'center', fontFamily: MM, fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {item.strike_number}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink2 }}>
                    Strike {item.strike_number} — {OFFENCE_LABELS[item.offence_type] ?? item.offence_type}
                    {item.mins_over != null && (
                      <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, fontWeight: 400, marginLeft: 6 }}>
                        {item.mins_over} min over
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 3 }}>
                    {format(parseISO(item.occurred_at), 'd MMM yyyy, HH:mm')}
                  </div>
                </div>
                <span style={{ fontFamily: MM, fontSize: 9, color: MC.ink4, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: 3 }}>Auto</span>
              </div>
            )
          })}
        </SectionCard>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setFile(null) }} title="Add Formal Action">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Action type</label>
            <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', background: MC.paper, boxSizing: 'border-box' }}>
              {Object.entries(FORMAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Date</label>
            <input type="date" value={form.occurred_at} onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              placeholder="Details, outcome, follow-up actions…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Attachment (optional)</label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ width: '100%', fontSize: 13, fontFamily: MF }} />
          </div>
          <button onClick={addFormal} disabled={saving} style={{
            background: MC.bad, color: '#fff', border: 'none', borderRadius: 12,
            padding: '13px 0', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: MM, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
          }}>
            {saving ? 'Saving…' : 'Record Action'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Leave Tab ────────────────────────────────────────────────────────────────
function LeaveTab({ staffId, venueSlug }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.from('time_off_requests').select('*').eq('staff_id', staffId).order('start_date', { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setLoading(false) })
  }, [staffId])

  const STATUS_TONE = {
    approved: { fg: MC.good, bg: MC.goodBg },
    pending:  { fg: MC.warn, bg: MC.warnBg },
    rejected: { fg: MC.bad,  bg: MC.badBg  },
  }
  const LEAVE_LABELS = { annual: 'Annual', unpaid: 'Unpaid', other: 'Other' }

  const taken     = requests.filter(r => r.status === 'approved').length
  const allowance = 20
  const remaining = allowance - taken

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Leave balance strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 13 }}>
        {[{ k: 'Allowance', v: `${allowance} days` }, { k: 'Taken', v: `${taken} days` }, { k: 'Remaining', v: `${remaining} days` }].map(x => (
          <div key={x.k} style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '13px 16px' }}>
            <div style={{ fontFamily: MM, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600 }}>{x.k}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: MC.ink, marginTop: 3, fontFamily: MM, letterSpacing: '-0.02em' }}>{x.v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Ico.cal} text="No leave requests on record" />
      ) : (
        <SectionCard>
          {requests.map((r, i) => {
            const tone = STATUS_TONE[r.status] ?? STATUS_TONE.pending
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                borderBottom: i < requests.length - 1 ? `1px solid ${MC.line2}` : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: MC.ink }}>
                    {format(parseISO(r.start_date), 'd MMM')} – {format(parseISO(r.end_date), 'd MMM yyyy')}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    <Badge tone={{ fg: MC.ink3, bg: MC.line2 }}>{LEAVE_LABELS[r.leave_type] ?? r.leave_type}</Badge>
                    {r.reason && <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>{r.reason}</span>}
                  </div>
                </div>
                <Badge tone={tone} dot>{r.status}</Badge>
              </div>
            )
          })}
        </SectionCard>
      )}

      <button onClick={() => navigate(`/v/${venueSlug}/time-off`)} style={{
        background: 'transparent', border: `1px solid ${MC.line}`, borderRadius: 12,
        padding: '11px 16px', cursor: 'pointer', fontFamily: MM, fontSize: 11,
        fontWeight: 600, letterSpacing: '0.05em', color: MC.ink3, textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
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
    if (!expiry) return { label: 'No expiry', tone: { fg: MC.ink4, bg: MC.line2 } }
    const d = differenceInDays(parseISO(expiry), new Date())
    if (d < 0)   return { label: 'Expired',  tone: { fg: MC.bad,  bg: MC.badBg  } }
    if (d <= 30) return { label: `${d}d`,    tone: { fg: MC.warn, bg: MC.warnBg } }
    return { label: format(parseISO(expiry), 'd MMM yy'), tone: { fg: MC.good, bg: MC.goodBg } }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : (
        <>
          <span style={{ fontFamily: MM, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600 }}>
            Certificates · {certs.length}
          </span>
          {certs.length === 0
            ? <EmptyState icon={Ico.grad} text="No certificates on file" />
            : (
              <SectionCard>
                {certs.map((c, i) => {
                  const st = certStatus(c.expiry_date)
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                      borderBottom: i < certs.length - 1 ? `1px solid ${MC.line2}` : 'none',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: MC.ink }}>{c.title}</div>
                        {c.category && <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{c.category}</div>}
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  )
                })}
              </SectionCard>
            )
          }

          <span style={{ fontFamily: MM, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600, marginTop: 4 }}>
            Induction records · {inductions.length}
          </span>
          {inductions.length === 0
            ? <EmptyState icon={Ico.grad} text="No induction records on file" />
            : (
              <SectionCard>
                {inductions.map((ind, i) => (
                  <div key={ind.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '13px 18px', borderBottom: i < inductions.length - 1 ? `1px solid ${MC.line2}` : 'none',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: MC.ink }}>
                        Induction — {ind.trainer_name ?? 'Unknown trainer'}
                      </div>
                      <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 3 }}>
                        {format(parseISO(ind.training_date), 'd MMM yyyy')}
                      </div>
                    </div>
                    <Badge tone={ind.staff_acknowledged ? { fg: MC.good, bg: MC.goodBg } : { fg: MC.warn, bg: MC.warnBg }} dot>
                      {ind.staff_acknowledged ? 'Signed' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </SectionCard>
            )
          }
        </>
      )}

      <button onClick={() => navigate(`/v/${venueSlug}/training`)} style={{
        background: 'transparent', border: `1px solid ${MC.line}`, borderRadius: 12,
        padding: '11px 16px', cursor: 'pointer', fontFamily: MM, fontSize: 11,
        fontWeight: 600, letterSpacing: '0.05em', color: MC.ink3, textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontFamily: MM, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, fontWeight: 600 }}>
        Active sessions · {loading ? '—' : sessions.length}
      </span>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Ico.lock} text="No active sessions" />
      ) : (
        <SectionCard>
          {sessions.map((s, i) => (
            <div key={s.token} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
              borderBottom: i < sessions.length - 1 ? `1px solid ${MC.line2}` : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: MC.ink }}>{s.device_label ?? 'Unknown device'}</div>
                <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 3 }}>
                  Started {format(parseISO(s.created_at), 'd MMM yyyy, HH:mm')} · Expires {format(parseISO(s.expires_at), 'd MMM yyyy')}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(s.token)}
                disabled={revoking === s.token}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${MC.bad}`, background: 'transparent',
                  color: MC.bad, cursor: revoking === s.token ? 'not-allowed' : 'pointer',
                  fontFamily: MM, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  opacity: revoking === s.token ? 0.5 : 1,
                }}
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
        .select('id, name, job_role, employment_type, start_date, hourly_rate, contracted_hours, working_days, is_under_18, emergency_contact_name, emergency_contact_phone')
        .eq('id', staffId)
        .maybeSingle(),
      supabase.from('staff_hr_documents')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', staffId),
      supabase.from('staff_disciplinary_log')
        .select('strike_number')
        .eq('staff_id', staffId)
        .order('strike_number', { ascending: false })
        .limit(1),
    ]).then(([staffRes, docsRes, strikesRes]) => {
      setStaff(staffRes.data)
      setDocsCount(docsRes.count ?? 0)
      setStrikesCount(strikesRes.data?.[0]?.strike_number ?? 0)
      setLoading(false)
    })
  }, [staffId])

  if (!staffId) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', minHeight: 300, color: MC.ink4, fontFamily: MF, gap: 12, padding: 40,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <p style={{ fontSize: 13 }}>Select a staff member to view their record</p>
      </div>
    )
  }

  const hasAction   = false // derived from parent flags; not re-fetched here
  const hasExpiring = false

  // Status badges shown in the header — re-use the props passed from hub if available
  // (In practice the hub passes staff flags; for EmployeeRecordPage we derive from data)

  return (
    <div style={{ fontFamily: MF }}>
      {/* Back button (directory / URL mode only) */}
      {onBack && (
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7,
          fontFamily: MM, fontSize: 11, fontWeight: 600, color: MC.ink3, letterSpacing: '0.04em',
        }}>
          {Ico.back} HR Records
        </button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 18, flexWrap: 'wrap' }}>
        {loading
          ? <div style={{ width: 56, height: 56, borderRadius: 15, background: MC.line2 }} />
          : <Avatar name={staff?.name ?? ''} size={56} radius={15} />
        }
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: MC.ink, margin: 0 }}>
              {loading ? <span style={{ color: MC.ink4 }}>Loading…</span> : (staff?.name ?? '—')}
            </h1>
          </div>
          {!loading && staff && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: MC.ink3 }}>{staff.job_role}</span>
              {staff.employment_type && (
                <>
                  <span style={{ width: 1, height: 12, background: MC.line }} />
                  <span style={{ fontFamily: MM, fontSize: 11, color: MC.ink3 }}>
                    {EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type}
                    {staff.start_date && ` · ${tenure(staff.start_date)}`}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {/* Header action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
          <button style={btn('default')} onClick={() => navigate(`/v/${venueSlug}/settings`)}>
            {Ico.edit} Edit
          </button>
          <button style={btn('primary')} onClick={() => setTab('Documents')}>
            {Ico.doc} Upload doc
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        background: MC.line2, borderRadius: 12, padding: 3,
        maxWidth: 560, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer', borderRadius: 9,
            whiteSpace: 'nowrap',
            background: tab === t ? MC.paper : 'transparent',
            color: tab === t ? MC.ink : MC.ink3,
            fontFamily: MM, fontSize: 10, fontWeight: tab === t ? 700 : 600,
            letterSpacing: '0.02em',
            boxShadow: tab === t ? '0 1px 4px rgba(13,26,20,0.10)' : 'none',
            transition: 'all .15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Profile'      && <ProfileTab      staff={staff} docsCount={docsCount} strikesCount={strikesCount} venueSlug={venueSlug} />}
      {tab === 'Documents'    && <DocumentsTab    staffId={staffId} venueId={venueId} onDocsCountChange={setDocsCount} />}
      {tab === 'Disciplinary' && <DisciplinaryTab staffId={staffId} venueId={venueId} />}
      {tab === 'Leave'        && <LeaveTab        staffId={staffId} venueSlug={venueSlug} />}
      {tab === 'Training'     && <TrainingTab     staffId={staffId} venueSlug={venueSlug} />}
      {tab === 'Security'     && <SecurityTab     staffId={staffId} />}
    </div>
  )
}
