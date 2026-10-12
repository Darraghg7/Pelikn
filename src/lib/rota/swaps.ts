import { format } from 'date-fns'
import { resolveShiftSwap, updateShiftStaff } from '../api/shifts'
import { sendPush } from '../sendPush'

/** The note a requester gets when a swap for a shift that has already happened is dismissed. */
export const EXPIRED_SWAP_NOTE = 'Shift had already passed'

export interface SwapLike {
  id: string
  shift_id: string
  requester_id?: string | null
  target_staff_id?: string | null
  shift?: { shift_date?: string } | null
}

type Outcome = { error: { message: string } | null }

/** A swap for a shift that is before today can only be dismissed, not approved. */
export function isSwapExpired(swap: Pick<SwapLike, 'shift'>, today: string = format(new Date(), 'yyyy-MM-dd')): boolean {
  const date = swap.shift?.shift_date
  return !!date && date < today
}

/**
 * Approves a swap: moves the shift to the colleague, marks the request
 * approved and tells both people. Shared by the phone and desktop rotas.
 */
export async function approveSwapRequest(swap: SwapLike, venueId: string): Promise<Outcome> {
  const { error: shiftErr } = await updateShiftStaff(swap.shift_id, swap.target_staff_id ?? null)
  if (shiftErr) return { error: shiftErr }
  const { error } = await resolveShiftSwap(swap.id, 'approved')
  if (error) return { error }
  const staffIds = [swap.requester_id, swap.target_staff_id].filter((id): id is string => !!id)
  if (staffIds.length) {
    sendPush({
      venueId,
      notificationType: 'shift_swap_decision',
      title: 'Shift Swap Approved',
      body: 'Your shift swap request has been approved. Check the rota for updates.',
      url: '/rota',
      staffIds,
    })
  }
  return { error: null }
}

/**
 * Declines (or dismisses) a swap, keeps the manager's note and tells the
 * person who asked. Shared by the phone and desktop rotas.
 */
export async function declineSwapRequest(swap: SwapLike, venueId: string, note?: string | null): Promise<Outcome> {
  const cleanNote = note?.trim() || null
  const { error } = await resolveShiftSwap(swap.id, 'rejected', cleanNote)
  if (error) return { error }
  if (swap.requester_id) {
    sendPush({
      venueId,
      notificationType: 'shift_swap_decision',
      title: 'Shift Swap Rejected',
      body: `Your shift swap request was not approved.${cleanNote ? ' Note: ' + cleanNote : ''}`,
      url: '/rota',
      staffIds: [swap.requester_id],
    })
  }
  return { error: null }
}
