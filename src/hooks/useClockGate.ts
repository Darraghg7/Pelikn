import { useCallback, useState } from 'react'
import { useVenue } from '../contexts/VenueContext'
import { useClockRules } from './useClockRules'
import { clockBlockedNotice, decideClockRules, getPosition, needsPosition } from '../lib/clockRules'

/**
 * The venue's clock-in rules, applied to one punch (157).
 *
 *   const { gate, checking, notice } = useClockGate()
 *   const g = await gate('clock_in')
 *   if (!g.ok) toast(g.message, 'error')
 *   else offlineRpc('record_clock_event', { ...args, ...g.args })
 *
 * `gate` asks the phone for its position only when the location rule needs
 * it; `args` carries the position or the tablet's secret for the server to
 * check again. `notice` is set when this device can't punch at all (the
 * tablet rule is on and this isn't the tablet) so the card can say so up
 * front rather than after a tap.
 */
export interface ClockGateResult {
  ok: boolean
  message?: string
  args: Record<string, unknown>
}

interface Position { latitude: number; longitude: number; accuracy: number }

export function useClockGate() {
  const { venueId } = useVenue()
  const { rules } = useClockRules()
  const [checking, setChecking] = useState(false)

  const gate = useCallback(async (eventType: string): Promise<ClockGateResult> => {
    let position: Position | null = null
    if (needsPosition(rules, eventType)) {
      setChecking(true)
      try {
        position = await getPosition()
      } catch (err) {
        return { ok: false, message: (err as Error).message, args: {} }
      } finally {
        setChecking(false)
      }
    }
    return decideClockRules({ rules, eventType, venueId, position })
  }, [rules, venueId])

  return { gate, checking, notice: clockBlockedNotice(rules, venueId), rules }
}
