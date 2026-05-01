/**
 * Fitness to Work (SC7) — Staff health declarations.
 *
 * Staff must complete this at the start of each shift. Records are
 * stored in fitness_declarations and visible to managers for EHO audits.
 * Any staff member reporting illness (is_fit=false) is flagged.
 */
import React, { useState, useCallback, useEffect } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Hook: today's declarations ────────────────────────────────────────────────

function useDeclarations(venueId, date) {
  const [declarations, setDeclarations] = useState([])
  const [loading, setLoading]           = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('fitness_declarations')
      .select('id, is_fit, declared_at, shift_type, staff_name, staff_id, has_dv_symptoms, has_skin_infection, has_other_illness, illness_details, confirm_handwashing, confirm_clean_uniform, confirm_no_jewellery')
      .eq('venue_id', venueId)
      .eq('declaration_date', date)
      .order('declared_at', { ascending: false })
    setDeclarations(data ?? [])
    setLoading(false)
  }, [venueId, date])

  useEffect(() => { load() }, [load])
  return { declarations, loading, reload: load }
}

// ── Staff declaration form ────────────────────────────────────────────────────

function StaffDeclarationForm({ session, venueId, onSaved }) {
  const toast = useToast()

  const [step, setStep]           = useState('fitness')   // 'fitness' | 'hygiene' | 'done'
  const [isFit, setIsFit]         = useState(null)        // true | false
  const [shiftType, setShiftType] = useState('general')

  // Illness flags (shown when is_fit = false)
  const [hasDV, setHasDV]           = useState(false)
  const [hasSkin, setHasSkin]       = useState(false)
  const [hasOther, setHasOther]     = useState(false)
  const [illnessDetail, setIllness] = useState('')

  // Hygiene confirmations (shown when is_fit = true)
  const [handwashing, setHandwashing]   = useState(false)
  const [uniform, setUniform]           = useState(false)
  const [noJewellery, setNoJewellery]   = useState(false)

  const [saving, setSaving] = useState(false)

  const canSubmitIllness = hasDV || hasSkin || hasOther
  const canSubmitHygiene = handwashing && uniform && noJewellery

  const handleFitnessAnswer = (fit) => {
    setIsFit(fit)
    setStep(fit ? 'hygiene' : 'illness')
  }

  const submit = async () => {
    setSaving(true)
    const { error } = await supabase.from('fitness_declarations').insert({
      venue_id:              venueId,
      staff_id:              session?.staffId ?? null,
      staff_name:            session?.staffName ?? 'Unknown',
      declaration_date:      format(new Date(), 'yyyy-MM-dd'),
      shift_type:            shiftType,
      is_fit:                isFit,
      has_dv_symptoms:       hasDV,
      has_skin_infection:    hasSkin,
      has_other_illness:     hasOther,
      illness_details:       illnessDetail.trim() || null,
      confirm_handwashing:   handwashing,
      confirm_clean_uniform: uniform,
      confirm_no_jewellery:  noJewellery,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    onSaved()
  }

  return (
    <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden max-w-lg w-full mx-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-charcoal/8">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">SC7 — Shift Start</p>
        <h2 className="text-xl font-bold text-charcoal">Fitness to Work</h2>
        <p className="text-sm text-charcoal/50 mt-1">
          Complete before starting your shift. This declaration is recorded for food safety compliance.
        </p>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* Shift type */}
        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Shift type</p>
          <div className="flex gap-2">
            {[['opening','Opening'],['general','General'],['closing','Closing']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setShiftType(v)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${shiftType === v ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Step: fitness question */}
        {step === 'fitness' && (
          <div>
            <p className="text-sm font-medium text-charcoal mb-4">
              Are you feeling well and fit to work today?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleFitnessAnswer(true)}
                className="flex-1 py-4 rounded-xl bg-success/10 border-2 border-success/20 hover:bg-success/15 transition-all text-success font-semibold text-lg"
              >
                <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> Yes</span>
              </button>
              <button
                onClick={() => handleFitnessAnswer(false)}
                className="flex-1 py-4 rounded-xl bg-danger/8 border-2 border-danger/15 hover:bg-danger/12 transition-all text-danger font-semibold text-lg"
              >
                <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> No</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: illness details */}
        {step === 'illness' && (
          <div className="flex flex-col gap-4">
            <div className="bg-danger/8 border border-danger/15 rounded-xl p-4">
              <p className="text-sm font-semibold text-danger mb-1">You have indicated you are not fit to work.</p>
              <p className="text-xs text-danger/70">
                Please inform your manager immediately. Do not handle food until cleared by a medical professional if you have D&amp;V symptoms.
              </p>
            </div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Please indicate your symptoms:</p>

            {[
              [hasDV, setHasDV, 'Diarrhoea and/or vomiting (D&V)', 'Including norovirus symptoms — must not handle food for 48 hrs after last symptom'],
              [hasSkin, setHasSkin, 'Skin infection on hands/arms', 'Cuts, sores, rashes or infected wounds'],
              [hasOther, setHasOther, 'Other illness', 'High temperature, jaundice, or other communicable illness'],
            ].map(([val, setter, label, desc]) => (
              <label key={label} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-charcoal/10 hover:bg-charcoal/4 transition-colors">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => setter(e.target.checked)}
                  className="mt-1 shrink-0 w-4 h-4 accent-danger"
                />
                <div>
                  <p className="text-sm font-medium text-charcoal">{label}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}

            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Additional details (optional)
              </label>
              <textarea
                value={illnessDetail}
                onChange={e => setIllness(e.target.value)}
                placeholder="Describe symptoms or any other relevant information"
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving || !canSubmitIllness}
                className="flex-1 bg-danger text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-danger/90 transition-colors"
              >
                {saving ? 'Saving…' : 'Submit Declaration →'}
              </button>
              <button
                onClick={() => { setIsFit(null); setStep('fitness') }}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step: hygiene confirmations */}
        {step === 'hygiene' && (
          <div className="flex flex-col gap-4">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Before you start — please confirm:</p>

            {[
              [handwashing, setHandwashing, 'I have washed my hands thoroughly', 'Before entering the kitchen or food prep area'],
              [uniform, setUniform, 'I am wearing a clean uniform / apron', 'Clean, appropriate food-safe clothing'],
              [noJewellery, setNoJewellery, 'I have removed jewellery (except plain wedding band)', 'Including watches, rings, earrings, and bracelets'],
            ].map(([val, setter, label, desc]) => (
              <label key={label} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-charcoal/10 hover:bg-charcoal/4 transition-colors">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => setter(e.target.checked)}
                  className="mt-1 shrink-0 w-4 h-4 accent-success"
                />
                <div>
                  <p className="text-sm font-medium text-charcoal">{label}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}

            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving || !canSubmitHygiene}
                className="flex-1 bg-success text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-success/90 transition-colors"
              >
                {saving ? 'Saving…' : 'Confirm & Start Shift →'}
              </button>
              <button
                onClick={() => { setIsFit(null); setStep('fitness') }}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Today's declaration summary (shown after completing) ──────────────────────

function DeclarationSummary({ declaration }) {
  const isFit = declaration.is_fit
  return (
    <div className={`rounded-2xl border-2 p-6 max-w-lg w-full mx-auto ${isFit ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={isFit ? 'text-success' : 'text-warning'}>
          {isFit
            ? <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
            : <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          }
        </span>
        <div>
          <p className={`font-semibold text-lg ${isFit ? 'text-success' : 'text-danger'}`}>
            {isFit ? 'Fit to Work' : 'Not Fit to Work'}
          </p>
          <p className="text-xs text-charcoal/40">
            Declared at {format(new Date(declaration.declared_at), 'HH:mm')} · {declaration.shift_type} shift
          </p>
        </div>
      </div>

      {!isFit && (
        <div className="mt-2 text-sm text-danger/80">
          {declaration.has_dv_symptoms  && <p>• D&V symptoms reported</p>}
          {declaration.has_skin_infection && <p>• Skin infection reported</p>}
          {declaration.has_other_illness  && <p>• Other illness reported</p>}
          {declaration.illness_details    && <p className="mt-1 italic text-xs">{declaration.illness_details}</p>}
        </div>
      )}

      {isFit && (
        <div className="mt-2 text-xs text-charcoal/40 space-y-0.5">
          {declaration.confirm_handwashing   && <p className="flex items-center gap-1"><svg className="w-3 h-3 text-success shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> Hands washed</p>}
          {declaration.confirm_clean_uniform && <p className="flex items-center gap-1"><svg className="w-3 h-3 text-success shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> Clean uniform</p>}
          {declaration.confirm_no_jewellery  && <p className="flex items-center gap-1"><svg className="w-3 h-3 text-success shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> No jewellery</p>}
        </div>
      )}

      <p className="text-xs text-charcoal/30 mt-4">
        Your declaration for today has been recorded. See a manager if your status changes.
      </p>
    </div>
  )
}

// ── Manager view: all declarations ────────────────────────────────────────────

function ManagerDeclarationsView({ venueId }) {
  const [viewDate, setViewDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { declarations, loading, reload } = useDeclarations(venueId, viewDate)

  const fitCount   = declarations.filter(d => d.is_fit).length
  const unfitCount = declarations.filter(d => !d.is_fit).length

  const dates = [
    { label: 'Today',     value: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Yesterday', value: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: format(subDays(new Date(), 2), 'EEE d'), value: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Date picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {dates.map(d => (
          <button
            key={d.value}
            onClick={() => setViewDate(d.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewDate === d.value ? 'bg-charcoal text-cream' : 'bg-charcoal/8 text-charcoal/60 hover:bg-charcoal/12'}`}
          >
            {d.label}
          </button>
        ))}
        <input
          type="date"
          value={viewDate}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={e => e.target.value && setViewDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-charcoal/15 text-xs text-charcoal/60 bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border-charcoal/10 p-4 text-center">
          <p className="text-xl font-bold text-charcoal">{declarations.length}</p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">Declared</p>
        </div>
        <div className="bg-success/5 rounded-xl border border-success/15 p-4 text-center">
          <p className="text-xl font-bold text-success">{fitCount}</p>
          <p className="text-[11px] text-success/60 mt-0.5">Fit to work</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${unfitCount > 0 ? 'bg-danger/8 border-danger/20' : 'bg-charcoal/4 border-charcoal/10'}`}>
          <p className={`text-xl font-bold ${unfitCount > 0 ? 'text-danger' : 'text-charcoal/30'}`}>{unfitCount}</p>
          <p className={`text-[11px] mt-0.5 ${unfitCount > 0 ? 'text-danger/60' : 'text-charcoal/30'}`}>Unfit</p>
        </div>
      </div>

      {/* Declaration list */}
      <div className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : declarations.length === 0 ? (
          <p className="text-sm text-charcoal/35 italic text-center py-8">No declarations recorded for this date.</p>
        ) : (
          <div className="divide-y divide-charcoal/6">
            {declarations.map(d => (
              <div key={d.id} className="flex items-start gap-4 px-5 py-4">
                <span className={`shrink-0 mt-0.5 ${d.is_fit ? 'text-success' : 'text-warning'}`}>
                  {d.is_fit
                    ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
                    : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  }
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-charcoal">{d.staff_name}</p>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${d.is_fit ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {d.is_fit ? 'Fit' : 'Unfit'}
                    </span>
                    <span className="text-[11px] bg-charcoal/8 text-charcoal/50 px-2 py-0.5 rounded-full capitalize">
                      {d.shift_type}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/40 mt-0.5">
                    {format(new Date(d.declared_at), 'HH:mm')}
                    {d.is_fit && d.confirm_handwashing && d.confirm_clean_uniform && d.confirm_no_jewellery
                      ? ' · All hygiene checks confirmed'
                      : ''}
                  </p>
                  {!d.is_fit && (
                    <div className="text-xs text-danger/70 mt-1 space-y-0.5">
                      {d.has_dv_symptoms    && <p>• D&V symptoms</p>}
                      {d.has_skin_infection && <p>• Skin infection</p>}
                      {d.has_other_illness  && <p>• Other illness</p>}
                      {d.illness_details    && <p className="italic">{d.illness_details}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FitnessPage() {
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Check if this staff member has already declared today
  const [myDeclaration, setMyDeclaration] = useState(null)
  const [checkingOwn, setCheckingOwn]     = useState(true)

  const checkOwnDeclaration = useCallback(async () => {
    if (!venueId || !session?.staffId) { setCheckingOwn(false); return }
    const { data } = await supabase
      .from('fitness_declarations')
      .select('id, is_fit, declared_at, shift_type, has_dv_symptoms, has_skin_infection, has_other_illness, illness_details, confirm_handwashing, confirm_clean_uniform, confirm_no_jewellery')
      .eq('venue_id', venueId)
      .eq('staff_id', session.staffId)
      .eq('declaration_date', today)
      .order('declared_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setMyDeclaration(data ?? null)
    setCheckingOwn(false)
  }, [venueId, session?.staffId, today])

  useEffect(() => { checkOwnDeclaration() }, [checkOwnDeclaration])

  if (checkingOwn) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-charcoal/40 mb-1">
            {format(new Date(), 'EEEE, d MMMM')}
          </p>
          <h1 className="text-2xl font-bold text-charcoal">Fitness to Work</h1>
        </div>
        <span className="text-[11px] tracking-widest uppercase text-charcoal/30 border border-charcoal/15 rounded px-2 py-1">SC7</span>
      </div>

      {/* Staff: show form OR summary */}
      {!isManager && (
        myDeclaration
          ? <DeclarationSummary declaration={myDeclaration} />
          : <StaffDeclarationForm session={session} venueId={venueId} onSaved={() => checkOwnDeclaration()} />
      )}

      {/* Manager: always show own form + declarations panel */}
      {isManager && (
        <>
          {/* Manager's own declaration */}
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Your declaration</p>
            {myDeclaration
              ? <DeclarationSummary declaration={myDeclaration} />
              : <StaffDeclarationForm session={session} venueId={venueId} onSaved={() => checkOwnDeclaration()} />
            }
          </div>

          {/* All staff declarations */}
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Team declarations</p>
            <ManagerDeclarationsView venueId={venueId} />
          </div>
        </>
      )}
    </div>
  )
}
