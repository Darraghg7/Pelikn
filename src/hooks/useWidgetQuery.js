/**
 * useWidgetQuery — React Query wrapper for dashboard widgets.
 *
 * Gives every widget stale-while-revalidate behaviour:
 *  - In-session: repeat dashboard visits render instantly from the React Query
 *    cache instead of refetching from scratch.
 *  - Across sessions: the last result is persisted to localStorage and shown
 *    as placeholder data on the next cold open, so widgets display real
 *    numbers immediately while fresh data loads in the background.
 *
 * `scope` is the list of values the data depends on (venueId, date, …).
 * The persisted entry records its scope and is ignored on mismatch, so a new
 * day or a venue switch never shows another scope's stale numbers.
 */
import { useQuery } from '@tanstack/react-query'

const storageKey = (name) => `pelikn_w_${name}`

function readPersisted(name, scopeStr) {
  try {
    const raw = localStorage.getItem(storageKey(name))
    if (!raw) return undefined
    const entry = JSON.parse(raw)
    if (entry?.k !== scopeStr) return undefined
    return entry.data
  } catch {
    return undefined
  }
}

export function useWidgetQuery(name, scope, queryFn, options = {}) {
  const scopeStr = scope.join('|')
  const enabled = options.enabled ?? scope.every(s => s !== null && s !== undefined && s !== '')

  return useQuery({
    queryKey: ['widget', name, ...scope],
    queryFn: async () => {
      const data = await queryFn()
      try {
        localStorage.setItem(storageKey(name), JSON.stringify({ k: scopeStr, data }))
      } catch { /* storage full or unavailable — cache is best-effort */ }
      return data
    },
    enabled,
    placeholderData: () => readPersisted(name, scopeStr),
    staleTime: options.staleTime,
  })
}
