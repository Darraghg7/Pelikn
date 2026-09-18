/**
 * useClosingCheckoutGuard — the one place "is this clock-out allowed to
 * proceed?" gets decided, shared by every clock-out surface (ClockPanel,
 * MobileClockCard) the same way useClockAlerts already shares late/overrun
 * detection. A new clock surface gets the gate by construction rather than by
 * remembering to copy it.
 *
 * Usage:
 *   const guard = useClosingCheckoutGuard({ staffId, onProceed: () => record('clock_out') })
 *   <button onClick={guard.guardClockOut}>Clock Out</button>
 *   <ClosingChecklistGateModal {...guard.modalProps} />
 */
import { useCallback, useState } from 'react'
import { useVenue } from '../contexts/VenueContext'
import { useSession } from '../contexts/SessionContext'
import { useAppSettings } from './useSettings'
import { useClosingGate } from './useClosingGate'
import { useManagers, verifyManagerPin } from './useManagers'

export function useClosingCheckoutGuard({ staffId, onProceed }) {
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const { enforceClosingChecklist } = useAppSettings()
  const gate = useClosingGate(staffId)
  const managers = useManagers(venueId)

  const [open, setOpen] = useState(false)
  const [accepting, setAccepting] = useState(null) // department id currently being accepted

  const guardClockOut = useCallback(() => {
    if (!enforceClosingChecklist || !gate.blocked) { onProceed(); return }
    setOpen(true)
  }, [enforceClosingChecklist, gate.blocked, onProceed])

  const handleAccept = useCallback(async (departmentId) => {
    setAccepting(departmentId)
    const { error } = await gate.accept(session?.token, venueSlug, departmentId)
    setAccepting(null)
    if (error) return { error }
    const stillBlocked = gate.departments.some(
      (d) => d.departmentId !== departmentId && !d.cleared,
    )
    if (!stillBlocked) { setOpen(false); onProceed() }
    return { error: null }
  }, [gate, session?.token, venueSlug, onProceed])

  const handleOverride = useCallback(() => {
    setOpen(false)
    onProceed()
  }, [onProceed])

  return {
    guardClockOut,
    modalProps: {
      open,
      onClose: () => setOpen(false),
      departments: gate.departments.filter((d) => !d.cleared),
      accepting,
      onAccept: handleAccept,
      managers,
      onVerifyManagerPin: (managerId, pin) => verifyManagerPin(venueId, managerId, pin),
      onOverride: handleOverride,
    },
  }
}
