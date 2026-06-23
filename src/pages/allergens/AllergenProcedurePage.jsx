import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Procedure sections ────────────────────────────────────────────────────────

const PROC_SECTIONS = [
  {
    key: 'receiving',
    title: '1. Receiving Allergen Information',
    desc: 'How staff take and acknowledge an allergen requirement from a customer.',
    rows: 4,
    default:
      'When a customer informs staff of an allergen requirement:\n' +
      '• Acknowledge the allergen clearly and repeat it back to the customer to confirm.\n' +
      '• Do not guess — if unsure of any ingredient, check with the kitchen before confirming.\n' +
      '• Never promise an allergen-free dish unless you can guarantee it through separate preparation.\n' +
      '• Record the allergen requirement on the order (written on the ticket or verbally confirmed with the kitchen).',
  },
  {
    key: 'communication',
    title: '2. Kitchen Communication',
    desc: 'How the allergen requirement is passed accurately to food preparation staff.',
    rows: 4,
    default:
      'The allergen requirement must be communicated clearly to the kitchen:\n' +
      '• Write the allergen on the order ticket / ticket system and highlight it clearly.\n' +
      '• Verbally inform the chef or food preparer who will handle the dish.\n' +
      '• The kitchen must confirm receipt of the allergen information before preparation begins.\n' +
      '• Do not assume another staff member has communicated the allergen requirement — always verify.',
  },
  {
    key: 'preparation',
    title: '3. Separate Preparation',
    desc: 'How food is prepared safely to avoid cross-contamination.',
    rows: 4,
    default:
      'To prevent cross-contamination during preparation:\n' +
      '• Use separate, clean utensils, chopping boards, and equipment for the allergen-safe dish.\n' +
      '• Wash hands thoroughly before handling the dish.\n' +
      '• Where possible, prepare the allergen-safe dish before other dishes to reduce contamination risk.\n' +
      '• If shared fryers or cooking surfaces present a cross-contamination risk, inform the customer before confirming the order can be fulfilled safely.',
  },
  {
    key: 'service',
    title: '4. Service & Presentation',
    desc: 'How the allergen-safe dish is identified and delivered to the correct customer.',
    rows: 3,
    default:
      'Before serving the dish:\n' +
      '• Label or flag the dish clearly so it reaches the correct customer (e.g. allergen flag, coloured ticket, verbal handover).\n' +
      '• Confirm with the customer at point of service that this is their allergen-safe dish.\n' +
      '• Ideally the same staff member who took the order delivers the dish, or ensures a clear verbal handover to the server.',
  },
  {
    key: 'responsibilities',
    title: '5. Staff Responsibilities & Escalation',
    desc: 'Who is responsible and what to do if something goes wrong.',
    rows: 4,
    default:
      'The responsible manager (see contact above) is accountable for this procedure.\n\n' +
      'All food-handling staff must:\n' +
      '• Know how to access the allergen register (Pelikn allergen QR menu).\n' +
      '• Never guess about ingredients — always check.\n' +
      '• Escalate to the manager if they are uncertain about any allergen claim.\n\n' +
      'If a customer reports an allergic reaction:\n' +
      '• Take it seriously immediately. Call 999 if the reaction is severe (anaphylaxis).\n' +
      '• Record the incident in the Complaints log in Pelikn.\n' +
      '• Notify the responsible manager immediately.',
  },
]

const DEFAULT_SECTIONS = Object.fromEntries(PROC_SECTIONS.map(s => [s.key, s.default]))

// ── Data hook ─────────────────────────────────────────────────────────────────

function useAllergenProcedure(venueId) {
  const [procedure, setProcedure] = useState(null)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('allergen_procedures')
      .select('*')
      .eq('venue_id', venueId)
      .maybeSingle()
    setProcedure(data)
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { procedure, loading, reload: load }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AllergenProcedurePage() {
  const { venueId }                         = useVenue()
  const toast                               = useToast()
  const { procedure, loading, reload }      = useAllergenProcedure(venueId)
  const [sections, setSections]             = useState(DEFAULT_SECTIONS)
  const [meta, setMeta]                     = useState({ responsible_manager: '', eho_contact: '' })
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    if (procedure) {
      setSections({ ...DEFAULT_SECTIONS, ...(procedure.procedure_sections || {}) })
      setMeta({
        responsible_manager: procedure.responsible_manager ?? '',
        eho_contact:         procedure.eho_contact ?? '',
      })
    }
  }, [procedure])

  const buildProcedureText = (s) =>
    PROC_SECTIONS
      .map(({ title, key }) => `${title.toUpperCase()}\n${'─'.repeat(38)}\n${s[key] || ''}`)
      .join('\n\n')

  const save = async () => {
    setSaving(true)
    const payload = {
      venue_id:            venueId,
      procedure_sections:  sections,
      procedure_text:      buildProcedureText(sections),
      responsible_manager: meta.responsible_manager.trim() || null,
      eho_contact:         meta.eho_contact.trim() || null,
      updated_at:          new Date().toISOString(),
    }
    const { error } = procedure
      ? await supabase.from('allergen_procedures').update(payload).eq('venue_id', venueId)
      : await supabase.from('allergen_procedures').insert(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Allergen procedure saved')
    await reload()
  }

  if (loading) return <div className="flex justify-center pt-16"><LoadingSpinner size="md" /></div>

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Allergen Management Procedure</h1>
        <p className="text-sm text-charcoal/50 mt-1">
          Written procedure for handling allergen requests during service — required by EHOs post-Natasha's Law.
        </p>
      </div>

      {/* Legal banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex gap-3">
        <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Required document</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Since Natasha's Law (Oct 2021) and the Food Information Regulations 2014, EHOs specifically
            ask how allergen requests are handled during service — not just what allergens are in your food.
            This procedure, combined with your allergen register and staff training records, demonstrates
            full compliance.
          </p>
        </div>
      </div>

      {/* Key contacts */}
      <div className="bg-white rounded-2xl border border-charcoal/10 p-5">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Key Contacts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'responsible_manager', label: 'Responsible manager', placeholder: 'Name of manager responsible for allergen compliance' },
            { key: 'eho_contact',         label: 'Local EHO contact',   placeholder: 'Name and phone of your local Environmental Health Officer' },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest uppercase text-charcoal/30">{f.label}</label>
              <input
                value={meta[f.key]}
                onChange={e => setMeta(m => ({ ...m, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Procedure sections */}
      {PROC_SECTIONS.map(section => (
        <div key={section.key} className="bg-white rounded-2xl border border-charcoal/10 p-5">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-0.5">{section.title}</p>
          <p className="text-xs text-charcoal/40 mb-3">{section.desc}</p>
          <textarea
            value={sections[section.key] || ''}
            onChange={e => setSections(prev => ({ ...prev, [section.key]: e.target.value }))}
            rows={section.rows}
            className="w-full px-4 py-3 rounded-lg border border-charcoal/15 bg-white text-charcoal text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none"
          />
        </div>
      ))}

      {/* Last saved */}
      {procedure?.updated_at && (
        <p className="text-[11px] text-charcoal/30 text-right -mt-2">
          Last saved {format(new Date(procedure.updated_at), 'd MMM yyyy, HH:mm')}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Procedure'}
        </button>
        <button
          onClick={() => window.print()}
          className="px-5 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/60 hover:border-charcoal/30 hover:text-charcoal transition-colors"
        >
          Print
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: fixed; top: 0; left: 0; width: 100%; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  )
}
