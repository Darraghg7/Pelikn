/**
 * ClosingChecklistGateModal — shown instead of clocking out when
 * useClosingCheckoutGuard finds a blocked department. Each department is
 * either "not finished" (send them to the checklist) or "finished, but you
 * haven't signed off" (accept in place). A manager PIN always overrides.
 *
 * Simpler PIN entry than StaffAlertModal's manager-approval numpad — a plain
 * 4-digit input rather than a custom numpad — since this is a secondary
 * override path, not the primary late-clock-in flow that component serves.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'

export default function ClosingChecklistGateModal({
  open,
  onClose,
  departments,
  accepting,
  onAccept,
  managers,
  onVerifyManagerPin,
  onOverride,
}) {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const [showOverride, setShowOverride] = useState(false)
  const [managerId, setManagerId] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)

  if (!open) return null

  const incomplete = departments.filter((d) => !d.isComplete)
  const needsAccept = departments.filter((d) => d.isComplete)

  const submitOverride = async () => {
    if (!managerId || pin.length !== 4 || verifying) return
    setVerifying(true)
    const result = await onVerifyManagerPin(managerId, pin)
    setVerifying(false)
    if (!result.ok) { setPinError(result.error ?? 'Incorrect PIN, try again'); setPin(''); return }
    onOverride()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-charcoal/40 dark:bg-white/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-paperDark rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {!showOverride ? (
          <>
            <div>
              <p className="text-[11px] tracking-widest uppercase text-danger mb-1">Closing checklist not finished</p>
              <h3 className="font-semibold text-charcoal dark:text-white text-lg">Before you clock out</h3>
            </div>

            {incomplete.map((d) => (
              <div key={d.departmentId} className="rounded-xl border border-charcoal/10 dark:border-white/10 p-4 flex flex-col gap-2">
                <p className="text-sm font-medium text-charcoal dark:text-white">{d.departmentName}</p>
                <p className="text-xs text-charcoal/50 dark:text-white/40">
                  {d.doneChecks}/{d.totalChecks} closing checks done — log each as done, or flag an issue, before you can clock out.
                </p>
                <button
                  onClick={() => navigate(`/v/${venueSlug}/opening-closing`)}
                  className="mt-1 bg-warning text-white py-2.5 rounded-lg text-sm font-medium hover:bg-warning/90 transition-colors"
                >
                  Go to closing checklist →
                </button>
              </div>
            ))}

            {needsAccept.map((d) => (
              <div key={d.departmentId} className="rounded-xl border border-charcoal/10 dark:border-white/10 p-4 flex flex-col gap-2">
                <p className="text-sm font-medium text-charcoal dark:text-white">{d.departmentName}</p>
                <p className="text-xs text-charcoal/50 dark:text-white/40">
                  Closing checklist is complete. You're on record for tonight's close — confirm you've checked it yourself before clocking out.
                </p>
                <button
                  onClick={() => onAccept(d.departmentId)}
                  disabled={accepting === d.departmentId}
                  className="mt-1 bg-brand text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  {accepting === d.departmentId ? 'Confirming…' : 'Accept & Clock Out'}
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/50 dark:text-white/40"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowOverride(true)}
                className="flex-1 text-xs text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white underline"
              >
                Manager PIN override
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-1">Manager Override</p>
              <h3 className="font-semibold text-charcoal dark:text-white text-lg">Clock out anyway</h3>
              <p className="text-xs text-charcoal/40 dark:text-white/35 mt-1">
                A manager confirms this clock-out without the closing checklist being finished. This is logged.
              </p>
            </div>
            <select
              value={managerId}
              onChange={(e) => { setManagerId(e.target.value); setPinError('') }}
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white"
            >
              <option value="">Select manager…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
              placeholder="4-digit PIN"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-center tracking-[0.4em] text-charcoal dark:text-white"
            />
            {pinError && <p className="text-xs text-danger">{pinError}</p>}
            <div className="flex gap-2">
              <button
                onClick={submitOverride}
                disabled={!managerId || pin.length !== 4 || verifying}
                className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                {verifying ? 'Verifying…' : 'Confirm Override'}
              </button>
              <button
                onClick={() => { setShowOverride(false); setPin(''); setPinError('') }}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/50 dark:text-white/40"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
