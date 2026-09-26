import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import Button from '../../components/ui/Button'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { fetchMockInspections, insertMockInspection, MockInspectionsUnavailable } from '../../lib/api/mockInspections'

// In-progress answers are kept on this device so leaving the page part-way
// doesn't lose them (they used to live in component state only). Per-viewer
// convenience, not a record — the submitted result is saved to the database.
const draftKey = (venueId) => `pelikn_mock_draft_${venueId}`
function loadDraft(venueId) {
  try { return JSON.parse(localStorage.getItem(draftKey(venueId)) ?? '{}') ?? {} } catch { return {} }
}
function saveDraft(venueId, answers) {
  try {
    if (Object.keys(answers).length) localStorage.setItem(draftKey(venueId), JSON.stringify(answers))
    else localStorage.removeItem(draftKey(venueId))
  } catch { /* storage blocked — the draft just won't survive leaving the page */ }
}

const SECTIONS = [
  {
    id: 'food_hygiene',
    label: 'Food Hygiene',
    questions: [
      { id: 'fh1', text: 'Are all food handlers trained in basic food hygiene?', weight: 5 },
      { id: 'fh2', text: 'Are staff following correct handwashing procedures?', weight: 5 },
      { id: 'fh3', text: 'Is raw food kept separate from ready-to-eat food?', weight: 5 },
      { id: 'fh4', text: 'Are allergens correctly documented and communicated to customers?', weight: 5 },
      { id: 'fh5', text: 'Is food labelled with use-by dates and stored correctly?', weight: 5 },
    ],
  },
  {
    id: 'temp_control',
    label: 'Temperature Control',
    questions: [
      { id: 'tc1', text: 'Are fridge temperatures logged daily (1–5°C)?', weight: 5 },
      { id: 'tc2', text: 'Are freezer temperatures checked and within range (≤-18°C)?', weight: 5 },
      { id: 'tc3', text: 'Are cooking core temperatures verified and recorded (≥75°C)?', weight: 5 },
      { id: 'tc4', text: 'Is hot holding kept above 63°C and documented?', weight: 5 },
      { id: 'tc5', text: 'Is the probe thermometer calibrated and in good working order?', weight: 5 },
    ],
  },
  {
    id: 'cleaning',
    label: 'Cleaning & Disinfection',
    questions: [
      { id: 'cl1', text: 'Is there a cleaning schedule in place and being followed?', weight: 5 },
      { id: 'cl2', text: 'Are cleaning records completed and up to date?', weight: 5 },
      { id: 'cl3', text: 'Are food contact surfaces cleaned and sanitised before use?', weight: 5 },
      { id: 'cl4', text: 'Are approved food-grade sanitisers used at correct dilutions?', weight: 5 },
    ],
  },
  {
    id: 'pest_control',
    label: 'Pest Control',
    questions: [
      { id: 'pc1', text: 'Is there a pest control contract in place with a registered contractor?', weight: 5 },
      { id: 'pc2', text: 'Are pest control visit reports retained on site?', weight: 5 },
      { id: 'pc3', text: 'Are there no signs of pest activity (droppings, gnaw marks, nests)?', weight: 5 },
      { id: 'pc4', text: 'Are all entry points (gaps, drains, vents) properly sealed?', weight: 5 },
    ],
  },
  {
    id: 'management',
    label: 'Management & Documentation',
    questions: [
      { id: 'md1', text: 'Is a HACCP-based food safety management system in place?', weight: 5 },
      { id: 'md2', text: 'Are supplier delivery records and checks documented?', weight: 5 },
      { id: 'md3', text: 'Are staff food hygiene training records kept on file?', weight: 5 },
      { id: 'md4', text: 'Are corrective actions documented when food safety issues arise?', weight: 5 },
      { id: 'md5', text: 'Are waste management procedures followed?', weight: 5 },
      { id: 'md6', text: 'Are opening / closing checklists completed daily?', weight: 5 },
    ],
  },
]

const ANSWER_OPTIONS = [
  { value: 'yes',     label: 'Yes',     score: 1.0,  style: 'bg-success/10 text-success border-success/30 ring-success/40' },
  { value: 'partial', label: 'Partial', score: 0.5,  style: 'bg-warning/10 text-warning border-warning/30 ring-warning/40' },
  { value: 'no',      label: 'No',      score: 0.0,  style: 'bg-danger/10  text-danger  border-danger/30  ring-danger/40'  },
  { value: 'na',      label: 'N/A',     score: null, style: 'bg-charcoal/8 dark:bg-white/8 text-charcoal/50 dark:text-white/40 border-charcoal/20 dark:border-white/20 ring-charcoal/20 dark:ring-white/20' },
]

function scoreLabel(pct) {
  if (pct >= 80) return { label: 'Good', color: 'text-success' }
  if (pct >= 60) return { label: 'Needs Improvement', color: 'text-warning' }
  return { label: 'Urgent Action Required', color: 'text-danger' }
}

function scoreBg(pct) {
  if (pct >= 80) return 'bg-success/10 border-success/30'
  if (pct >= 60) return 'bg-warning/10 border-warning/30'
  return 'bg-danger/10 border-danger/30'
}

export default function EHOMockPage() {
  const { venueId } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [draft, setDraft]         = useState(() => loadDraft(venueId))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving]       = useState(false)
  // A past result opened from the history list — shown read-only.
  const [viewing, setViewing]     = useState(null)

  const history = useQuery({
    queryKey: ['mockInspections', venueId],
    queryFn: () => fetchMockInspections(venueId),
    enabled: !!venueId,
    retry: (count, err) => !(err instanceof MockInspectionsUnavailable) && count < 1,
  })
  const unavailable = history.error instanceof MockInspectionsUnavailable

  useEffect(() => { if (!submitted && !viewing) saveDraft(venueId, draft) }, [venueId, draft, submitted, viewing])

  const answers  = viewing ? viewing.answers : draft
  const readOnly = submitted || !!viewing

  const allQuestions = SECTIONS.flatMap((s) => s.questions)

  const answeredCount = Object.keys(answers).length
  const allAnswered   = answeredCount === allQuestions.length

  // N/A questions are excluded from both numerator and denominator
  const eligibleQuestions = allQuestions.filter(q => answers[q.id] !== 'na')
  const eligibleWeight    = eligibleQuestions.reduce((acc, q) => acc + q.weight, 0)
  const rawScore = eligibleQuestions.reduce((acc, q) => {
    const ans = answers[q.id]
    const opt = ANSWER_OPTIONS.find((o) => o.value === ans)
    return acc + (opt && opt.score !== null ? opt.score * q.weight : 0)
  }, 0)

  const pct = eligibleWeight > 0 ? Math.round((rawScore / eligibleWeight) * 100) : 0
  const { label: scoreLabel_, color: scoreColor } = scoreLabel(pct)

  const setAnswer = (qId, value) => {
    setDraft((prev) => ({ ...prev, [qId]: value }))
  }

  const submit = async () => {
    setSaving(true)
    try {
      await insertMockInspection({
        venue_id:          venueId,
        completed_by:      session?.staffId ?? null,
        completed_by_name: session?.staffName ?? null,
        answers:           draft,
        score:             pct,
      })
      queryClient.invalidateQueries({ queryKey: ['mockInspections', venueId] })
      toast('Mock inspection saved')
    } catch (err) {
      toast(err instanceof MockInspectionsUnavailable ? err.message : `Could not save: ${err.message}`, 'error')
    }
    setSaving(false)
    setSubmitted(true)
    saveDraft(venueId, {})
  }

  // Leaving a past result goes back to whatever was in progress; otherwise
  // start a fresh inspection.
  const startOver = () => {
    if (viewing) { setViewing(null); return }
    setDraft({}); setSubmitted(false)
  }

  const openPast = (row) => {
    // A just-submitted inspection is saved — don't reopen it as a draft later.
    if (submitted) { setDraft({}); setSubmitted(false) }
    setViewing(row)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const failedQuestions = allQuestions.filter((q) => {
    const ans = answers[q.id]
    return ans === 'no' || ans === 'partial'
  })

  const naCount = allQuestions.filter(q => answers[q.id] === 'na').length

  const handlePrint = () => window.print()

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>

      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-charcoal dark:text-white">EHO Mock Inspection</h1>
            <p className="text-sm text-charcoal/40 dark:text-white/35 mt-1">
              {viewing
                ? `Saved result · ${format(new Date(viewing.created_at), 'd MMM yyyy, HH:mm')}${viewing.completed_by_name ? ` · ${viewing.completed_by_name}` : ''}`
                : 'Food Standards Agency-style self-assessment checklist'}
            </p>
          </div>
          {readOnly && (
            <button
              onClick={handlePrint}
              className="no-print text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white transition-colors border-b border-charcoal/20 dark:border-white/20"
            >
              Print Result
            </button>
          )}
        </div>

        {/* Live score bar */}
        <div className={`rounded-2xl border p-5 ${readOnly ? scoreBg(pct) : 'bg-white dark:bg-paperDark border-charcoal/10 dark:border-white/10'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">
              {readOnly
              ? `Final Score${naCount > 0 ? ` · ${naCount} N/A` : ''}`
              : `Progress · ${answeredCount}/${allQuestions.length} answered${naCount > 0 ? ` · ${naCount} N/A` : ''}`
            }
            </p>
            <p className={`text-xl font-bold font-semibold ${readOnly ? scoreColor : 'text-charcoal dark:text-white'}`}>
              {readOnly ? `${pct}/100` : `${pct}%`}
            </p>
          </div>
          <div className="h-2 rounded-full bg-charcoal/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {readOnly && (
            <p className={`text-sm font-semibold mt-2 ${scoreColor}`}>{scoreLabel_}</p>
          )}
        </div>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.id} className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-charcoal/8 dark:border-white/8 bg-charcoal/2 dark:bg-white/3">
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">{section.label}</p>
            </div>
            <div className="flex flex-col divide-y divide-charcoal/6 dark:divide-white/8">
              {section.questions.map((q) => {
                const current = answers[q.id]
                return (
                  <div key={q.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="text-sm text-charcoal dark:text-white flex-1 leading-relaxed">{q.text}</p>
                    <div className="flex gap-2 shrink-0">
                      {ANSWER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => !readOnly && setAnswer(q.id, opt.value)}
                          disabled={readOnly}
                          className={[
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            current === opt.value
                              ? `${opt.style} ring-2 ring-offset-1`
                              : 'bg-white dark:bg-paperDark text-charcoal/40 dark:text-white/35 border-charcoal/15 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30 disabled:cursor-default',
                          ].join(' ')}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Submit / Results */}
        {!readOnly ? (
          <div className="no-print">
            <Button
              variant="primary"
              onClick={submit}
              disabled={!allAnswered || saving}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving…' : allAnswered ? 'Submit Inspection →' : `Answer all questions (${answeredCount}/${allQuestions.length})`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Final result card */}
            <div className={`rounded-xl border p-6 text-center ${scoreBg(pct)}`}>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">Your Mock Inspection Score</p>
              <p className={`text-4xl font-bold font-semibold ${scoreColor}`}>{pct}<span className="text-2xl">/100</span></p>
              <p className={`text-base font-semibold mt-2 ${scoreColor}`}>{scoreLabel_}</p>
              <p className="text-xs text-charcoal/40 dark:text-white/35 mt-1">
                {pct >= 80 ? 'Your food safety management appears to be in good order.' :
                 pct >= 60 ? 'Some areas need attention before an EHO inspection.' :
                 'Significant improvements are required. Review the areas below urgently.'}
              </p>
            </div>

            {/* Areas to improve */}
            {failedQuestions.length > 0 && (
              <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-charcoal/8 dark:border-white/8">
                  <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">Areas to Improve</p>
                </div>
                <div className="flex flex-col divide-y divide-charcoal/6 dark:divide-white/8">
                  {failedQuestions.map((q) => {
                    const ans = answers[q.id]
                    return (
                      <div key={q.id} className="px-5 py-3 flex items-start gap-3">
                        <span className={`text-xs font-semibold mt-0.5 shrink-0 ${ans === 'partial' ? 'text-warning' : 'text-danger'}`}>
                          {ans === 'partial' ? '~' : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                        </span>
                        <p className="text-sm text-charcoal/70 dark:text-white/60">{q.text}</p>
                        <span className={`text-[11px] tracking-widest uppercase shrink-0 ${ans === 'partial' ? 'text-warning' : 'text-danger'}`}>
                          {ans === 'partial' ? 'Partial' : 'Fail'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {failedQuestions.length === 0 && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-center">
                <p className="text-success font-semibold">No failed or partial answers</p>
                <p className="text-xs text-charcoal/40 dark:text-white/35 mt-1">Excellent — you answered Yes to every question.</p>
              </div>
            )}

            <div className="no-print flex gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/60 dark:text-white/50 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
              >
                Print Result
              </button>
              <button
                onClick={startOver}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
              >
                {viewing ? 'New inspection' : 'Start Over'}
              </button>
            </div>
          </div>
        )}

        {/* History */}
        <div className="no-print bg-white dark:bg-paperDark rounded-2xl border border-charcoal/10 dark:border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-charcoal/8 dark:border-white/8">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">Previous inspections</p>
          </div>
          {unavailable ? (
            <p className="px-5 py-4 text-sm text-danger">
              Results can't be saved yet — database migration 131 (mock_inspections) needs applying.
            </p>
          ) : history.isLoading ? (
            <p className="px-5 py-4 text-sm text-charcoal/40 dark:text-white/35">Loading…</p>
          ) : history.error ? (
            <p className="px-5 py-4 text-sm text-danger">Couldn't load previous inspections — {history.error.message}</p>
          ) : !history.data?.length ? (
            <p className="px-5 py-4 text-sm text-charcoal/40 dark:text-white/35">No saved inspections yet. Submit one to start a history.</p>
          ) : (
            <div className="flex flex-col divide-y divide-charcoal/6 dark:divide-white/8">
              {history.data.map((row) => {
                const tone = scoreLabel(row.score)
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openPast(row)}
                    className={`px-5 py-3 flex items-center gap-3 text-left hover:bg-charcoal/3 dark:hover:bg-white/5 transition-colors ${viewing?.id === row.id ? 'bg-charcoal/4 dark:bg-white/5' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal dark:text-white">{format(new Date(row.created_at), 'd MMM yyyy, HH:mm')}</p>
                      {row.completed_by_name && <p className="text-xs text-charcoal/40 dark:text-white/35">{row.completed_by_name}</p>}
                    </div>
                    <span className={`text-xs font-semibold ${tone.color}`}>{tone.label}</span>
                    <span className={`font-mono text-sm font-semibold ${tone.color}`}>{row.score}/100</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
