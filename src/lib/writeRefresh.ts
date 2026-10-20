/**
 * Which queries does a write make stale?
 *
 * Until now every successful write refreshed every query on screen. One tick on
 * the cleaning list re-ran the compliance score, the rota widgets, the training
 * count and the rest. That is invisible with a few venues and a heavy,
 * multiplying load with thousands: reads per save = queries on screen.
 *
 * The rule here keeps the old behaviour as the default and carves out the
 * exceptions that are safe to declare:
 *
 *  - A query listed in QUERY_TABLES is refreshed only when a table it reads
 *    was written (or when the write is one we cannot place, see below).
 *  - A query NOT listed is refreshed on every write, exactly as before. A new
 *    screen can therefore never go stale because someone forgot this file; it
 *    just costs a little more until it is added.
 *  - A write we cannot place (an RPC not in RPC_TABLES) refreshes everything.
 *
 * When you add a table to a listed query's fetch, add it here too.
 */
import type { Query } from '@tanstack/react-query'

/** Tables each listed query reads. Key is the first part of the query key, or `widget:<name>`. */
export const QUERY_TABLES: Record<string, readonly string[]> = {
  'widget:pending_swaps':       ['shift_swaps', 'staff'],
  'widget:weekly_labour':       ['shifts', 'staff', 'app_settings'],
  'widget:probe_calibration':   ['probe_calibrations'],
  'widget:compliance_score':    ['fridge_temperature_logs', 'fridges', 'delivery_checks', 'probe_calibrations', 'corrective_actions', 'staff_training'],
  'widget:staff_notifications': ['time_off_requests', 'shift_swaps', 'staff_training', 'staff'],
  'widget:fridge_alerts':       ['fridge_temperature_logs', 'fridges'],
  'widget:expiring_training':   ['staff_training', 'staff'],
  'widget:todays_deliveries':   ['delivery_checks'],
  'widget:open_actions':        ['corrective_actions'],
  'widget:staff_on_shift':      ['shifts', 'staff'],
  departmentChecksToday:        ['opening_closing_checks', 'opening_closing_completions', 'departments', 'staff_departments'],
  'venue-compliance-data':      ['fridge_temperature_logs', 'cooking_temp_logs', 'hot_holding_logs', 'time_off_requests', 'clock_events'],
  managers:                     ['staff'],
  'venue-branding':             ['app_settings'],
  venue_closures:               ['venue_closures'],
}

/** Writes made through an RPC whose tables we know. Any other RPC refreshes everything. */
export const RPC_TABLES: Record<string, readonly string[]> = {
  'rpc:complete_cleaning_task': ['cleaning_completions'],
}

export function queryId(key: readonly unknown[]): string | null {
  const first = key[0]
  if (typeof first !== 'string') return null
  if (first === 'widget') return typeof key[1] === 'string' ? `widget:${key[1]}` : null
  return first
}

/** Expand what was written into table names; null means "cannot tell, refresh everything". */
export function tablesWritten(writes: Iterable<string>): Set<string> | null {
  const out = new Set<string>()
  for (const w of writes) {
    if (w.startsWith('rpc:')) {
      const known = RPC_TABLES[w]
      if (!known) return null
      known.forEach(t => out.add(t))
    } else {
      out.add(w)
    }
  }
  return out
}

/** Predicate for queryClient.invalidateQueries. */
export function shouldRefresh(query: Pick<Query, 'queryKey'>, written: Set<string> | null): boolean {
  if (written === null) return true
  const id = queryId(query.queryKey)
  const reads = id ? QUERY_TABLES[id] : undefined
  if (!reads) return true
  return reads.some(t => written.has(t))
}
