import React, { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── HACCP 7 Principles ────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'step_1',
    principle: 'Principle 1',
    title: 'Hazard Analysis',
    guidance: 'Identify all biological, chemical, and physical hazards that could occur at each stage of your food operation — from receiving through to service.',
    placeholder: 'List your process steps and the hazards at each point…',
    default: `Process Step: Receiving
Hazards: Biological — pathogenic bacteria in raw meat/fish; Chemical — cleaning chemical contamination; Physical — foreign objects in deliveries.
Controls: All deliveries inspected on arrival. Chilled deliveries ≤8°C, frozen ≤-18°C. Damaged or unlabelled goods rejected.

Process Step: Storage
Hazards: Biological — bacterial growth due to incorrect temperatures; cross-contamination between raw and ready-to-eat foods.
Controls: Raw food stored below RTE food. Fridge 1–5°C daily. Freezer ≤-18°C daily. FIFO rotation applied. Foods covered and labelled.

Process Step: Preparation
Hazards: Biological — cross-contamination from raw to RTE foods. Physical — foreign body contamination.
Controls: Separate colour-coded chopping boards and utensils for raw and RTE foods. Surfaces cleaned and sanitised between uses.

Process Step: Cooking
Hazards: Biological — survival of pathogenic bacteria if food not cooked to correct temperature.
Controls: Core temperature verified with calibrated probe thermometer. Target ≥75°C (poultry and pork ≥75°C for 2 minutes).

Process Step: Cooling
Hazards: Biological — bacterial growth if food cooled too slowly.
Controls: Food cooled from 70°C to below 8°C within 90 minutes. Blast chiller or ice bath used. Cooling log completed.

Process Step: Service/Hot Holding
Hazards: Biological — bacterial growth if hot food not maintained at correct temperature.
Controls: Hot food held at ≥63°C during service. Cold food at ≤8°C. Covered when not in use. Hot holding temperature logged.`,
  },
  {
    id: 'step_2',
    principle: 'Principle 2',
    title: 'Critical Control Points',
    guidance: 'Identify the specific steps in your process where controls are essential to prevent or eliminate a food safety hazard. These are your Critical Control Points (CCPs).',
    placeholder: 'List your CCPs and why each one is critical…',
    default: `CCP 1 — Cooking
Reason: This is the only step that eliminates pathogenic bacteria. If the food is not cooked to the correct core temperature, harmful bacteria may survive and cause illness.

CCP 2 — Cooling
Reason: Rapid cooling prevents bacterial growth in cooked food. The danger zone (8°C–63°C) must be passed through quickly to prevent multiplication of organisms like Bacillus cereus and Clostridium perfringens.

CCP 3 — Hot Holding
Reason: Food held below 63°C supports rapid bacterial growth. Maintaining ≥63°C during service is critical where food is not served immediately after cooking.

CCP 4 — Chilled Storage (Receiving / Storage)
Reason: Correct refrigeration temperatures prevent bacterial growth throughout the supply chain. Failures here could allow contamination to go undetected until service.`,
  },
  {
    id: 'step_3',
    principle: 'Principle 3',
    title: 'Critical Limits',
    guidance: 'For each CCP, define the measurable boundary that separates safe from unsafe. These limits are based on UK food safety law and science.',
    placeholder: 'Define the critical limit for each CCP…',
    default: `CCP 1 — Cooking
Critical Limit: Core temperature ≥75°C for 2 minutes (poultry and pork). Or equivalent time-temperature combination validated by a food safety professional.

CCP 2 — Cooling
Critical Limit: Food must be cooled from 70°C to below 8°C within 90 minutes.

CCP 3 — Hot Holding
Critical Limit: Hot food must be maintained at ≥63°C at all times during service.

CCP 4 — Chilled Storage
Critical Limit: Fridge temperature 1–5°C. Freezer temperature ≤-18°C. Incoming chilled deliveries ≤8°C.`,
  },
  {
    id: 'step_4',
    principle: 'Principle 4',
    title: 'Monitoring Procedures',
    guidance: 'Describe how each CCP is monitored — who does it, what they measure, how often, and what they use.',
    placeholder: 'Describe your monitoring procedures for each CCP…',
    default: `CCP 1 — Cooking
Who: The cook responsible for the dish.
How: Probe thermometer inserted into the thickest part of the food, away from bone.
When: Every batch of cooked food before service.
Record: Cooking temperature log completed immediately with time, food item, and core temp.

CCP 2 — Cooling
Who: The person responsible for portioning/cooling.
How: Probe thermometer used at regular intervals during cooling; time recorded.
When: During every cooling event.
Record: Cooling log completed showing start time, end time, and temperatures.

CCP 3 — Hot Holding
Who: Front-of-house or kitchen staff on duty.
How: Probe thermometer used to spot-check hot holding equipment.
When: Every 2 hours during service.
Record: Hot holding log completed each check.

CCP 4 — Chilled Storage
Who: Opening member of staff (or designated team member).
How: Digital fridge thermometer display or probe thermometer.
When: Once daily (minimum), at opening.
Record: Fridge temperature log completed daily.`,
  },
  {
    id: 'step_5',
    principle: 'Principle 5',
    title: 'Corrective Actions',
    guidance: 'Define what must happen when a critical limit is breached. These actions must prevent unsafe food from reaching the customer.',
    placeholder: 'Define corrective actions for each CCP…',
    default: `CCP 1 — Cooking (temperature not reached)
Action: Return food to heat immediately. Do not serve. Re-probe to verify target temperature reached. If food cannot reach temperature, discard. Log corrective action with reason and outcome.

CCP 2 — Cooling (not cooled within 90 minutes)
Action: Discard food. Do not refrigerate for later use. Log corrective action and investigate root cause (e.g., portion size, equipment failure).

CCP 3 — Hot Holding (temperature below 63°C)
Action: Identify how long food has been below temperature. If under 2 hours, reheat to 75°C and return to hot holding. If over 2 hours, discard. Log corrective action.

CCP 4 — Chilled Storage (temperature out of range)
Action: Investigate cause (door seal, overloading, equipment fault). Move food to alternative refrigeration. Do not use any food that has exceeded safe temperatures. Log corrective action and arrange equipment repair. Contact environmental health if food may have been compromised.

All corrective actions are recorded in the corrective actions log and reviewed by the manager.`,
  },
  {
    id: 'step_6',
    principle: 'Principle 6',
    title: 'Verification',
    guidance: 'Describe how you confirm that your HACCP system is working effectively. Verification is separate from day-to-day monitoring.',
    placeholder: 'Describe your verification activities…',
    default: `1. Probe Thermometer Calibration
Frequency: Weekly. Method: Ice slurry test (0°C ±1°C) and/or boiling water test (100°C ±1°C at sea level). Record: Probe calibration log. Action if failed: Probe taken out of service and replaced.

2. Record Review
Frequency: Weekly by the manager. Activity: Review temperature logs, cleaning records, and corrective action logs for completeness and any patterns of non-compliance.

3. Internal Self-Audit
Frequency: Monthly. Method: Walk-through inspection using the EHO mock inspection checklist. Record: Internal audit report filed in documents.

4. HACCP Plan Review
Frequency: Annually, or whenever the menu, process, or equipment changes significantly. Activity: Review all 7 principles to ensure the plan remains accurate and effective.

5. Staff Training Verification
Frequency: At induction and annually. Method: Training sign-off records (SC6) confirmed by manager. External food hygiene certificates tracked and renewed before expiry.`,
  },
  {
    id: 'step_7',
    principle: 'Principle 7',
    title: 'Documentation & Record Keeping',
    guidance: 'Summarise the records your business keeps to demonstrate that the HACCP system is operating correctly.',
    placeholder: 'List the records you keep and how long you retain them…',
    default: `Records Maintained:

1. Fridge & Freezer Temperature Logs — Daily. Stored digitally in Pelikn. Retained for minimum 3 months (recommended: 2 years).

2. Cooking Temperature Logs — Per service. Stored digitally in Pelikn. Retained for minimum 3 months.

3. Cooling Logs — Per cooling event. Stored digitally in Pelikn. Retained for minimum 3 months.

4. Hot Holding Logs — Every 2 hours during service. Stored digitally in Pelikn. Retained for minimum 3 months.

5. Delivery Inspection Records — Per delivery. Stored digitally in Pelikn. Retained for minimum 3 months.

6. Probe Calibration Records — Weekly. Stored digitally in Pelikn. Retained for minimum 1 year.

7. Cleaning Schedule Completion Records — Daily/weekly/monthly. Stored digitally in Pelikn.

8. Corrective Action Records — Per incident. Stored digitally in Pelikn with resolution status.

9. Staff Training Records (SC6) — At induction. Retained for duration of employment + 2 years.

10. External Training Certificates — Stored digitally in Pelikn with expiry dates tracked.

11. Pest Control Contractor Reports — Per visit. Stored digitally in Pelikn.

12. Supplier Records — Ongoing. Includes approval status and food safety certificates.

13. This HACCP Plan — Reviewed annually. Signed by responsible manager.

All records are available for inspection by an Environmental Health Officer on request.`,
  },
]

// ── Data hook ─────────────────────────────────────────────────────────────────

function useHACCPPlan(venueId) {
  const [plan, setPlan]       = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('haccp_plans')
      .select('*')
      .eq('venue_id', venueId)
      .maybeSingle()
    setPlan(data)
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { plan, loading, reload: load }
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total, steps }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex flex-col items-center">
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < current  ? 'bg-success text-white' :
              i === current ? 'bg-charcoal text-cream' :
                             'bg-charcoal/10 text-charcoal/30',
            ].join(' ')}>
              {i < current
                ? <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                : i + 1}
            </div>
            <p className={`text-[11px] font-medium mt-0.5 text-center w-12 leading-tight ${i === current ? 'text-charcoal' : 'text-charcoal/30'}`}>
              P{i + 1}
            </p>
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-px mx-1 mb-3 min-w-[12px] ${i < current ? 'bg-success/50' : 'bg-charcoal/10'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Print document ────────────────────────────────────────────────────────────

function PrintDoc({ venueName, managerName, reviewDate, answers }) {
  return (
    <div id="haccp-print-root" style={{ display: 'none' }}>
      <style>{`
        @media print {
          body > *:not(#haccp-print-root) { display: none !important; }
          #haccp-print-root { display: block !important; }
          #haccp-print-doc  { display: block !important; }
          @page { margin: 20mm; }
        }
      `}</style>
      <div id="haccp-print-doc" style={{ fontFamily: 'serif', fontSize: '11pt', color: '#000', lineHeight: '1.6' }}>
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: 0 }}>HACCP Food Safety Management Plan</h1>
          <p style={{ margin: '4px 0 0' }}>{venueName}</p>
          <div style={{ marginTop: '8px', fontSize: '10pt', display: 'flex', gap: '24px' }}>
            <span>Responsible manager: <strong>{managerName || '_______________'}</strong></span>
            <span>Review date: <strong>{reviewDate || '_______________'}</strong></span>
            <span>Date produced: <strong>{format(new Date(), 'd MMMM yyyy')}</strong></span>
          </div>
        </div>

        {STEPS.map((step, i) => (
          <div key={step.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '12pt', fontWeight: 'bold', margin: '0 0 4px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
              {step.principle}: {step.title}
            </h2>
            <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0, fontSize: '10pt' }}>
              {answers[step.id] || step.default}
            </pre>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #000', paddingTop: '16px', marginTop: '24px' }}>
          <p style={{ margin: '0 0 24px', fontSize: '10pt' }}>
            This HACCP plan has been prepared in accordance with Regulation (EC) No 852/2004 as retained in UK law. It is reviewed annually and whenever processes, menus, or equipment change.
          </p>
          <div style={{ display: 'flex', gap: '48px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '10pt' }}>Manager signature: ___________________________</p>
              <p style={{ margin: '4px 0 0', fontSize: '10pt' }}>Date signed: ___________________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HACCPWizardPage() {
  const { venueId, venueName } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const { plan, loading, reload } = useHACCPPlan(venueId)

  const [step, setStep]         = useState(0)
  const [answers, setAnswers]   = useState({})
  const [meta, setMeta]         = useState({ business_name: '', responsible_manager: '', review_date: '' })
  const [saving, setSaving]     = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const textRef = useRef(null)

  // Populate from DB when loaded
  useEffect(() => {
    if (!plan) return
    const a = {}
    STEPS.forEach(s => { if (plan[s.id]) a[s.id] = plan[s.id] })
    setAnswers(a)
    setMeta({
      business_name:        plan.business_name ?? '',
      responsible_manager:  plan.responsible_manager ?? '',
      review_date:          plan.review_date ?? '',
    })
  }, [plan])

  const currentAnswer = answers[STEPS[step]?.id] ?? ''

  const setCurrentAnswer = (val) => {
    setAnswers(prev => ({ ...prev, [STEPS[step].id]: val }))
  }

  const save = useCallback(async (andNext = false) => {
    if (!venueId) return
    setSaving(true)

    const payload = {
      venue_id: venueId,
      business_name:       meta.business_name || venueName,
      responsible_manager: meta.responsible_manager,
      review_date:         meta.review_date || null,
      updated_at:          new Date().toISOString(),
      ...answers,
    }

    const { error } = plan
      ? await supabase.from('haccp_plans').update(payload).eq('id', plan.id)
      : await supabase.from('haccp_plans').insert({ ...payload, is_complete: false }).select().single()

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }

    await reload()
    if (andNext && step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else if (!andNext) {
      toast('HACCP plan saved')
    }
  }, [venueId, venueName, plan, answers, meta, step, reload, toast])

  const handleNext = () => save(true)
  const handlePrev = async () => {
    await save(false)
    setStep(s => s - 1)
  }

  const handlePrint = async () => {
    await save(false)
    setTimeout(() => window.print(), 300)
  }

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  // ── Review / print screen
  if (reviewing) {
    return (
      <>
        <PrintDoc
          venueName={meta.business_name || venueName}
          managerName={meta.responsible_manager}
          reviewDate={meta.review_date}
          answers={answers}
        />
        <div className="flex flex-col gap-6 max-w-2xl">
          <div className="flex items-center gap-4">
            <button onClick={() => setReviewing(false)} className="text-charcoal/40 hover:text-charcoal transition-colors text-lg">←</button>
            <div>
              <h1 className="text-2xl font-bold text-charcoal">HACCP Plan Review</h1>
              <p className="text-sm text-charcoal/40 mt-0.5">Check all 7 principles, then print or save as PDF</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-4">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Plan Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] tracking-widest uppercase text-charcoal/30">Business Name</label>
                <input
                  value={meta.business_name}
                  onChange={e => setMeta(m => ({ ...m, business_name: e.target.value }))}
                  placeholder={venueName}
                  className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] tracking-widest uppercase text-charcoal/30">Responsible Manager</label>
                <input
                  value={meta.responsible_manager}
                  onChange={e => setMeta(m => ({ ...m, responsible_manager: e.target.value }))}
                  placeholder="Manager name"
                  className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] tracking-widest uppercase text-charcoal/30">Next Review Date</label>
                <input
                  type="date"
                  value={meta.review_date}
                  onChange={e => setMeta(m => ({ ...m, review_date: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
            </div>
          </div>

          {STEPS.map((s, i) => (
            <div key={s.id} className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-charcoal/8 flex items-center justify-between">
                <div>
                  <span className="text-[11px] tracking-widest uppercase text-charcoal/40">{s.principle}</span>
                  <p className="font-semibold text-charcoal text-sm">{s.title}</p>
                </div>
                <button
                  onClick={() => { setReviewing(false); setStep(i) }}
                  className="text-xs text-accent hover:text-accent/70 transition-colors"
                >
                  Edit
                </button>
              </div>
              <div className="px-5 py-4">
                <pre className="text-xs text-charcoal/70 whitespace-pre-wrap font-sans leading-relaxed">
                  {answers[s.id] || s.default}
                </pre>
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={saving}
              className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save & Generate PDF →'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Wizard step screen
  const currentStep = STEPS[step]
  const completedCount = STEPS.filter(s => answers[s.id]).length

  return (
    <>
      <PrintDoc
        venueName={meta.business_name || venueName}
        managerName={meta.responsible_manager}
        reviewDate={meta.review_date}
        answers={answers}
      />
      <div className="flex flex-col gap-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-charcoal">HACCP Plan</h1>
            <p className="text-sm text-charcoal/40 mt-0.5">
              {plan ? `Last saved ${format(new Date(plan.updated_at), 'd MMM yyyy, HH:mm')}` : 'Not saved yet — complete each step'}
            </p>
          </div>
          {completedCount > 0 && (
            <button
              onClick={() => setReviewing(true)}
              className="shrink-0 text-sm font-medium text-accent hover:text-accent/70 transition-colors"
            >
              Review all →
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="bg-white rounded-2xl border-charcoal/10 px-5 py-4">
          <StepIndicator current={step} total={STEPS.length} steps={STEPS} />
          <div className="mt-3">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">{currentStep.principle}</p>
            <p className="text-base font-semibold text-charcoal">{currentStep.title}</p>
          </div>
        </div>

        {/* Guidance */}
        <div className="bg-charcoal/4 rounded-xl px-4 py-3 border border-charcoal/8">
          <p className="text-sm text-charcoal/70 leading-relaxed">{currentStep.guidance}</p>
        </div>

        {/* Textarea */}
        <div className="bg-white rounded-2xl border-charcoal/10 p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Your notes for this principle</label>
            {!currentAnswer && (
              <button
                type="button"
                onClick={() => setCurrentAnswer(currentStep.default)}
                className="text-[11px] text-accent hover:text-accent/70 transition-colors"
              >
                Use suggested text
              </button>
            )}
          </div>
          <textarea
            ref={textRef}
            value={currentAnswer}
            onChange={e => setCurrentAnswer(e.target.value)}
            placeholder={currentStep.placeholder}
            rows={14}
            className="w-full px-4 py-3 rounded-lg border border-charcoal/15 bg-white text-charcoal placeholder-charcoal/25 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none font-mono leading-relaxed"
          />
          {!currentAnswer && (
            <p className="text-[11px] text-charcoal/30 mt-1.5">
              Click "Use suggested text" above to pre-fill with guidance for a typical hospitality business, then edit to match your operation.
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={handlePrev}
              disabled={saving}
              className="px-5 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal transition-colors disabled:opacity-40"
            >
              {saving ? '…' : '← Previous'}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Save & Continue → (${step + 2} of ${STEPS.length})`}
            </button>
          ) : (
            <button
              onClick={() => { save(false).then(() => setReviewing(true)) }}
              disabled={saving}
              className="flex-1 bg-success text-white py-3 rounded-xl text-sm font-semibold hover:bg-success/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Complete & Review Plan →'}
            </button>
          )}
        </div>

        {/* Progress summary */}
        <div className="text-center">
          <p className="text-xs text-charcoal/30">
            {completedCount} of {STEPS.length} principles completed
            {completedCount === STEPS.length && ' — ready to generate your plan'}
          </p>
        </div>
      </div>
    </>
  )
}
