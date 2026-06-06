import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO, isPast, differenceInDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Design tokens ──────────────────────────────────────────────────────────────
const MC = {
  ink: '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line: '#e4e6e2', line2: '#eef0ec',
  bg: '#f3f3ef', paper: '#ffffff',
  brand: '#13362a', brandSoft: '#e2ece7', brandTint: '#eef4f0',
  good: '#1a7a4c', goodBg: '#e3f0e7',
  warn: '#a85d12', warnBg: '#fbeedc',
  bad:  '#b3331c', badBg:  '#fbeae6',
}
const MM = '"Geist Mono", ui-monospace, "SF Mono", monospace'
const MF = '"Geist", -apple-system, "SF Pro Text", system-ui, sans-serif'

const TABS = ['Profile', 'Documents', 'Disciplinary', 'Leave', 'Training']

const FORMAL_ACTION_LABELS = {
  verbal_warning:       'Verbal Warning',
  written_warning:      'Written Warning',
  final_written_warning:'Final Written Warning',
  dismissal:            'Dismissal',
  other:                'Other',
}

const FORMAL_ACTION_TONE = {
  verbal_warning:        { fg: MC.warn, bg: MC.warnBg },
  written_warning:       { fg: MC.bad,  bg: MC.badBg  },
  final_written_warning: { fg: '#7a1212', bg: '#fbeae6' },
  dismissal:             { fg: '#ffffff', bg: '#0d1a14' },
  other:                 { fg: MC.ink3, bg: MC.line2 },
}

const DOC_CATEGORY_LABELS = { contract: 'Contract', food_hygiene: 'Food Hygiene', other: 'Other' }
const DOC_CATEGORY_TONE   = {
  contract:     { fg: MC.brand, bg: MC.brandTint },
  food_hygiene: { fg: MC.good,  bg: MC.goodBg    },
  other:        { fg: MC.ink3,  bg: MC.line2     },
}

const EMPLOYMENT_LABELS = {
  full_time: 'Full-time', part_time: 'Part-time',
  zero_hours: 'Zero hours', fixed_term: 'Fixed term',
}

const DAYS_MAP = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }

// ── Shared atoms ───────────────────────────────────────────────────────────────
function SectionCard({ children, style }) {
  return (
    <div style={{
      background: MC.paper, border: `1px solid ${MC.line}`,
      borderRadius: 14, overflow: 'hidden', ...style,
    }}>{children}</div>
  )
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${MC.line2}` }}>
      <span style={{ fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink4, minWidth: 120, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: MC.ink, flex: 1 }}>{value}</span>
    </div>
  )
}

function Badge({ tone, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: MM, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
      textTransform: 'uppercase', borderRadius: 999, padding: '3px 8px',
      color: tone.fg, background: tone.bg,
    }}>{children}</span>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 20px', color: MC.ink4, fontFamily: MF }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 13 }}>{text}</p>
    </div>
  )
}

// ── Profile tab ────────────────────────────────────────────────────────────────
function ProfileTab({ staff, venueSlug }) {
  const navigate = useNavigate()
  if (!staff) return <div style={{ padding: 32, textAlign: 'center' }}><LoadingSpinner /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionCard>
        <div style={{ padding: '12px 16px 4px', borderBottom: `1px solid ${MC.line2}` }}>
          <span style={{ fontFamily: MM, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: MC.ink3 }}>Employment</span>
        </div>
        <Row label="Name"        value={staff.name} />
        <Row label="Job Role"    value={staff.job_role} />
        <Row label="Contract"    value={EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type} />
        <Row label="Start Date"  value={staff.start_date ? format(parseISO(staff.start_date), 'd MMMM yyyy') : null} />
        <Row label="Hourly Rate" value={staff.hourly_rate != null ? `£${Number(staff.hourly_rate).toFixed(2)} / hr` : null} />
        <Row label="Hours / wk"  value={staff.contracted_hours != null ? `${staff.contracted_hours} h` : null} />
        <Row label="Working Days" value={staff.working_days?.length ? staff.working_days.map(d => DAYS_MAP[d]).join(', ') : null} />
        <Row label="Under 18"    value={staff.is_under_18 ? 'Yes' : null} />
        {/* Remove last border */}
        <div style={{ height: 4 }} />
      </SectionCard>

      <SectionCard>
        <div style={{ padding: '12px 16px 4px', borderBottom: `1px solid ${MC.line2}` }}>
          <span style={{ fontFamily: MM, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: MC.ink3 }}>Emergency Contact</span>
        </div>
        {(staff.emergency_contact_name || staff.emergency_contact_phone) ? (
          <>
            <Row label="Name"  value={staff.emergency_contact_name} />
            <Row label="Phone" value={staff.emergency_contact_phone} />
          </>
        ) : (
          <p style={{ padding: '12px 16px', fontSize: 13, color: MC.ink4, fontStyle: 'italic' }}>No emergency contact on file</p>
        )}
        <div style={{ height: 4 }} />
      </SectionCard>

      <button
        onClick={() => navigate(`/v/${venueSlug}/settings`)}
        style={{
          background: 'transparent', border: `1px solid ${MC.line}`,
          borderRadius: 12, padding: '11px 16px', cursor: 'pointer',
          fontFamily: MM, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
          color: MC.ink3, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        Edit in Settings
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1 1l3 3.5L1 8"/>
        </svg>
      </button>
    </div>
  )
}

// ── Documents tab ──────────────────────────────────────────────────────────────
function DocumentsTab({ staffId, venueId }) {
  const toast = useToast()
  const { session } = useSession()
  const [docs,     setDocs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form,     setForm]     = useState({ title: '', category: 'contract', expiry_date: '', notes: '' })
  const [file,     setFile]     = useState(null)
  const [saving,   setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('staff_hr_documents')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }, [staffId])

  useEffect(() => { load() }, [load])

  const upload = async () => {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    if (!file) { toast('Please select a file', 'error'); return }
    if (file.size > 15 * 1024 * 1024) { toast('File must be under 15 MB', 'error'); return }
    setSaving(true)

    const ext  = file.name.split('.').pop()
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
    if (dbErr) { toast('Failed to save record: ' + dbErr.message, 'error'); return }
    toast('Document uploaded')
    setShowModal(false)
    setForm({ title: '', category: 'contract', expiry_date: '', notes: '' })
    setFile(null)
    load()
  }

  const deleteDoc = async (doc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    await supabase.from('staff_hr_documents').delete().eq('id', doc.id)
    toast('Document deleted')
    load()
  }

  const expiryStatus = (dateStr) => {
    if (!dateStr) return null
    const days = differenceInDays(parseISO(dateStr), new Date())
    if (days < 0)  return { label: 'Expired',   tone: { fg: MC.bad,  bg: MC.badBg  } }
    if (days <= 30) return { label: `${days}d`,  tone: { fg: MC.warn, bg: MC.warnBg } }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: MC.brand, color: '#fff', border: 'none', borderRadius: 10,
            padding: '9px 16px', cursor: 'pointer',
            fontFamily: MM, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          }}
        >
          + Upload
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : docs.length === 0 ? (
        <EmptyState icon="📄" text="No documents uploaded yet" />
      ) : (
        <SectionCard>
          {docs.map((doc, i) => {
            const catTone = DOC_CATEGORY_TONE[doc.category] ?? DOC_CATEGORY_TONE.other
            const exp = expiryStatus(doc.expiry_date)
            return (
              <div key={doc.id} style={{
                padding: '12px 16px',
                borderBottom: i < docs.length - 1 ? `1px solid ${MC.line2}` : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink }}>{doc.title}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge tone={catTone}>{DOC_CATEGORY_LABELS[doc.category] ?? doc.category}</Badge>
                    {exp && <Badge tone={exp.tone}>{exp.label}</Badge>}
                    {doc.expiry_date && !exp && (
                      <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>
                        Expires {format(parseISO(doc.expiry_date), 'd MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 4 }}>
                    {format(parseISO(doc.created_at), 'd MMM yyyy')} · {(doc.file_size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: MC.brandTint, color: MC.brand, border: 'none',
                      borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                      fontFamily: MM, fontSize: 10, fontWeight: 700, textDecoration: 'none',
                    }}
                  >
                    View
                  </a>
                  <button
                    onClick={() => deleteDoc(doc)}
                    style={{
                      background: MC.badBg, color: MC.bad, border: 'none',
                      borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                      fontFamily: MM, fontSize: 10, fontWeight: 700,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </SectionCard>
      )}

      {/* Upload modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setFile(null); setForm({ title: '', category: 'contract', expiry_date: '', notes: '' }) }} title="Upload Document">
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
              {Object.entries(DOC_CATEGORY_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: k }))}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${form.category === k ? MC.brand : MC.line}`,
                    background: form.category === k ? MC.brand : 'transparent',
                    color: form.category === k ? '#fff' : MC.ink3,
                    fontFamily: MM, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  }}
                >{v}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>File</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ width: '100%', fontSize: 13, fontFamily: MF }}
            />
            {file && <p style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 4 }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Expiry Date (optional)</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={upload}
            disabled={saving}
            style={{
              background: MC.brand, color: '#fff', border: 'none', borderRadius: 12,
              padding: '13px 0', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              fontFamily: MM, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
            }}
          >
            {saving ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Disciplinary tab ───────────────────────────────────────────────────────────
function DisciplinaryTab({ staffId, venueId }) {
  const toast = useToast()
  const { session } = useSession()
  const [strikes,    setStrikes]    = useState([])
  const [formals,    setFormals]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [form,       setForm]       = useState({ action_type: 'verbal_warning', occurred_at: new Date().toISOString().slice(0, 10), notes: '' })
  const [file,       setFile]       = useState(null)
  const [saving,     setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [strikeRes, formalRes] = await Promise.all([
      supabase.from('staff_disciplinary_log')
        .select('*')
        .eq('staff_id', staffId)
        .order('occurred_at', { ascending: false }),
      supabase.from('hr_formal_actions')
        .select('*, added_by_staff:added_by(name)')
        .eq('staff_id', staffId)
        .order('occurred_at', { ascending: false }),
    ])
    setStrikes(strikeRes.data ?? [])
    setFormals(formalRes.data ?? [])
    setLoading(false)
  }, [staffId])

  useEffect(() => { load() }, [load])

  // Merge and sort by date desc
  const timeline = useMemo(() => {
    const items = [
      ...strikes.map(s => ({ ...s, _type: 'strike',  _date: s.occurred_at })),
      ...formals.map(f => ({ ...f, _type: 'formal',  _date: f.occurred_at })),
    ]
    return items.sort((a, b) => new Date(b._date) - new Date(a._date))
  }, [strikes, formals])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: MC.bad, color: '#fff', border: 'none', borderRadius: 10,
            padding: '9px 16px', cursor: 'pointer',
            fontFamily: MM, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          }}
        >
          + Add Formal Action
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : timeline.length === 0 ? (
        <EmptyState icon="✅" text="No disciplinary history on file" />
      ) : (
        <SectionCard>
          {timeline.map((item, i) => {
            const isLast = i === timeline.length - 1
            if (item._type === 'formal') {
              const tone = FORMAL_ACTION_TONE[item.action_type] ?? FORMAL_ACTION_TONE.other
              return (
                <div key={`formal-${item.id}`} style={{
                  padding: '14px 16px',
                  borderBottom: isLast ? 'none' : `1px solid ${MC.line2}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Badge tone={tone}>{FORMAL_ACTION_LABELS[item.action_type]}</Badge>
                        <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>
                          {format(parseISO(item.occurred_at), 'd MMM yyyy')}
                        </span>
                      </div>
                      {item.notes && (
                        <p style={{ fontSize: 13, color: MC.ink2, margin: '6px 0 0', lineHeight: 1.4 }}>{item.notes}</p>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                        {item.added_by_staff?.name && (
                          <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>
                            Added by {item.added_by_staff.name}
                          </span>
                        )}
                        {item.file_url && (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontFamily: MM, fontSize: 10, color: MC.brand, fontWeight: 700, textDecoration: 'none' }}
                          >
                            📎 {item.file_name ?? 'Attachment'}
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteFormal(item.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: MC.ink4, flexShrink: 0 }}
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </div>
                </div>
              )
            }

            // Clock strike
            return (
              <div key={`strike-${item.id}`} style={{
                padding: '12px 16px',
                borderBottom: isLast ? 'none' : `1px solid ${MC.line2}`,
                display: 'flex', alignItems: 'flex-start', gap: 10,
                opacity: 0.75,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: MC.line2, color: MC.ink3,
                  display: 'grid', placeItems: 'center',
                  fontFamily: MM, fontSize: 11, fontWeight: 700,
                }}>
                  {item.strike_number}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: MC.ink2 }}>
                      Strike {item.strike_number} — {OFFENCE_LABELS[item.offence_type] ?? item.offence_type}
                    </span>
                    <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>
                      {item.mins_over != null ? `${item.mins_over} min over` : ''}
                    </span>
                  </div>
                  <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 3 }}>
                    {format(parseISO(item.occurred_at), 'd MMM yyyy, HH:mm')}
                  </div>
                </div>
                <span style={{ fontFamily: MM, fontSize: 9, color: MC.ink4, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Auto</span>
              </div>
            )
          })}
        </SectionCard>
      )}

      {/* Add formal action modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setFile(null) }} title="Add Formal Action">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Action Type</label>
            <select
              value={form.action_type}
              onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', background: MC.paper, boxSizing: 'border-box' }}
            >
              {Object.entries(FORMAL_ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Date</label>
            <input
              type="date"
              value={form.occurred_at}
              onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Details, outcome, follow-up actions…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: MM, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: MC.ink3, marginBottom: 6 }}>Attachment (optional)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ width: '100%', fontSize: 13, fontFamily: MF }}
            />
          </div>

          <button
            onClick={addFormal}
            disabled={saving}
            style={{
              background: MC.bad, color: '#fff', border: 'none', borderRadius: 12,
              padding: '13px 0', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              fontFamily: MM, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
            }}
          >
            {saving ? 'Saving…' : 'Record Action'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Leave tab ──────────────────────────────────────────────────────────────────
function LeaveTab({ staffId, venueSlug }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.from('time_off_requests')
      .select('*')
      .eq('staff_id', staffId)
      .order('start_date', { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setLoading(false) })
  }, [staffId])

  const STATUS_TONE = {
    approved: { fg: MC.good, bg: MC.goodBg },
    pending:  { fg: MC.warn, bg: MC.warnBg },
    rejected: { fg: MC.bad,  bg: MC.badBg  },
  }

  const LEAVE_LABELS = { annual: 'Annual', unpaid: 'Unpaid', other: 'Other' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon="🗓️" text="No leave requests on record" />
      ) : (
        <SectionCard>
          {requests.map((r, i) => {
            const tone = STATUS_TONE[r.status] ?? STATUS_TONE.pending
            return (
              <div key={r.id} style={{
                padding: '12px 16px',
                borderBottom: i < requests.length - 1 ? `1px solid ${MC.line2}` : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink }}>
                    {format(parseISO(r.start_date), 'd MMM')} – {format(parseISO(r.end_date), 'd MMM yyyy')}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <Badge tone={{ fg: MC.ink3, bg: MC.line2 }}>{LEAVE_LABELS[r.leave_type] ?? r.leave_type}</Badge>
                    {r.reason && <span style={{ fontFamily: MM, fontSize: 10, color: MC.ink4 }}>{r.reason}</span>}
                  </div>
                </div>
                <Badge tone={tone}>{r.status}</Badge>
              </div>
            )
          })}
        </SectionCard>
      )}
      <button
        onClick={() => navigate(`/v/${venueSlug}/time-off`)}
        style={{
          background: 'transparent', border: `1px solid ${MC.line}`,
          borderRadius: 12, padding: '11px 16px', cursor: 'pointer',
          fontFamily: MM, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
          color: MC.ink3, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        Manage in Time Off
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1 1l3 3.5L1 8"/>
        </svg>
      </button>
    </div>
  )
}

// ── Training tab ───────────────────────────────────────────────────────────────
function TrainingTab({ staffId, venueSlug }) {
  const navigate = useNavigate()
  const [certs,     setCerts]     = useState([])
  const [inductions, setInductions] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('staff_training')
        .select('*')
        .eq('staff_id', staffId)
        .order('expiry_date', { ascending: true }),
      supabase.from('training_sign_offs')
        .select('*')
        .eq('staff_id', staffId)
        .order('training_date', { ascending: false }),
    ]).then(([certRes, indRes]) => {
      setCerts(certRes.data ?? [])
      setInductions(indRes.data ?? [])
      setLoading(false)
    })
  }, [staffId])

  const certStatus = (expiry) => {
    if (!expiry) return { label: 'No expiry', tone: { fg: MC.ink4, bg: MC.line2 } }
    const days = differenceInDays(parseISO(expiry), new Date())
    if (days < 0)   return { label: 'Expired',    tone: { fg: MC.bad,  bg: MC.badBg  } }
    if (days <= 30) return { label: `${days}d`,   tone: { fg: MC.warn, bg: MC.warnBg } }
    return { label: format(parseISO(expiry), 'd MMM yy'), tone: { fg: MC.good, bg: MC.goodBg } }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
      ) : (
        <>
          {/* Certificates */}
          <div style={{ fontFamily: MM, fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: MC.ink3 }}>
            Certificates ({certs.length})
          </div>
          {certs.length === 0 ? (
            <EmptyState icon="🎓" text="No certificates on file" />
          ) : (
            <SectionCard>
              {certs.map((c, i) => {
                const status = certStatus(c.expiry_date)
                return (
                  <div key={c.id} style={{
                    padding: '12px 16px',
                    borderBottom: i < certs.length - 1 ? `1px solid ${MC.line2}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink }}>{c.title}</div>
                      {c.category && <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 2, textTransform: 'uppercase' }}>{c.category}</div>}
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                )
              })}
            </SectionCard>
          )}

          {/* Induction sign-offs */}
          <div style={{ fontFamily: MM, fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: MC.ink3 }}>
            Induction Records ({inductions.length})
          </div>
          {inductions.length === 0 ? (
            <EmptyState icon="📋" text="No induction sign-offs on file" />
          ) : (
            <SectionCard>
              {inductions.map((ind, i) => (
                <div key={ind.id} style={{
                  padding: '12px 16px',
                  borderBottom: i < inductions.length - 1 ? `1px solid ${MC.line2}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink }}>
                        Induction — {ind.trainer_name ?? 'Unknown trainer'}
                      </div>
                      <div style={{ fontFamily: MM, fontSize: 10, color: MC.ink4, marginTop: 2 }}>
                        {format(parseISO(ind.training_date), 'd MMM yyyy')}
                      </div>
                    </div>
                    <Badge tone={ind.staff_acknowledged ? { fg: MC.good, bg: MC.goodBg } : { fg: MC.warn, bg: MC.warnBg }}>
                      {ind.staff_acknowledged ? 'Signed' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </SectionCard>
          )}
        </>
      )}

      <button
        onClick={() => navigate(`/v/${venueSlug}/training`)}
        style={{
          background: 'transparent', border: `1px solid ${MC.line}`,
          borderRadius: 12, padding: '11px 16px', cursor: 'pointer',
          fontFamily: MM, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
          color: MC.ink3, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        Manage in Training
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1 1l3 3.5L1 8"/>
        </svg>
      </button>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────
export default function EmployeeRecordPage() {
  const { staffId } = useParams()
  const navigate    = useNavigate()
  const { venueId, venueSlug } = useVenue()

  const [staff,   setStaff]   = useState(null)
  const [tab,     setTab]     = useState('Profile')

  useEffect(() => {
    if (!staffId) return
    supabase.from('staff')
      .select('id, name, job_role, employment_type, start_date, hourly_rate, contracted_hours, working_days, is_under_18, emergency_contact_name, emergency_contact_phone, holiday_pay_eligible')
      .eq('id', staffId)
      .maybeSingle()
      .then(({ data }) => setStaff(data))
  }, [staffId])

  const initials = staff ? staff.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <div style={{ fontFamily: MF, padding: '0 0 96px' }}>
      {/* Back + header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate(`/v/${venueSlug}/hr`)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 0 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: MM, fontSize: 11, fontWeight: 600, color: MC.ink3, letterSpacing: '0.04em',
          }}
        >
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 1L1 5l4 4"/>
          </svg>
          HR Records
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: MC.brandTint, color: MC.brand,
            display: 'grid', placeItems: 'center',
            fontFamily: MM, fontSize: 16, fontWeight: 700,
          }}>{initials}</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: MC.ink, margin: 0 }}>
              {staff?.name ?? '…'}
            </h1>
            <div style={{ fontSize: 13, color: MC.ink3, marginTop: 2 }}>
              {staff?.job_role ?? ''}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        background: MC.line2, borderRadius: 12, padding: 3,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, minWidth: 0, padding: '8px 4px', border: 'none', cursor: 'pointer',
              borderRadius: 9, whiteSpace: 'nowrap',
              background: tab === t ? MC.paper : 'transparent',
              color: tab === t ? MC.ink : MC.ink3,
              fontFamily: MM, fontSize: 10, fontWeight: tab === t ? 700 : 600,
              letterSpacing: '0.03em',
              boxShadow: tab === t ? '0 1px 4px rgba(13,26,20,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Profile'      && <ProfileTab     staff={staff}   venueSlug={venueSlug} />}
      {tab === 'Documents'    && <DocumentsTab    staffId={staffId} venueId={venueId} />}
      {tab === 'Disciplinary' && <DisciplinaryTab staffId={staffId} venueId={venueId} />}
      {tab === 'Leave'        && <LeaveTab        staffId={staffId} venueSlug={venueSlug} />}
      {tab === 'Training'     && <TrainingTab     staffId={staffId} venueSlug={venueSlug} />}
    </div>
  )
}
