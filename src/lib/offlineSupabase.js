/**
 * Offline-aware Supabase wrapper.
 * Wraps insert/update/upsert — if the call fails due to network error,
 * it queues the operation for later sync.
 */
import { supabase } from './supabase'
import { enqueue, enqueueRpc, getQueue, dequeue, updateQueueItem } from './offlineQueue'
import { reportError } from './reportError'

export function isNetworkError(error) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('load failed') ||
    !navigator.onLine
  )
}

/** Insert with offline fallback */
export async function offlineInsert(table, payload) {
  try {
    const result = await supabase.from(table).insert(payload)
    if (result.error && isNetworkError(result.error)) {
      enqueue(table, 'insert', payload)
      return { data: null, error: null, queued: true }
    }
    return result
  } catch (err) {
    if (isNetworkError(err)) {
      enqueue(table, 'insert', payload)
      return { data: null, error: null, queued: true }
    }
    throw err
  }
}

// A clock punch is a payroll record. Unlike other queued writes it is never
// dropped on the first refusal, and every one that waits on a device is
// reported, so a punch that never arrives can't vanish without a trace.
const CLOCK_RPC = 'record_clock_event'

/**
 * supabase.rpc, plus one compatibility retry: record_clock_event only takes
 * p_occurred_at (the tap time) from migration 144. Before that is applied
 * PostgREST answers PGRST202 (no function with those arguments), so the call
 * is repeated without it — the server then stamps its own time, as before.
 */
async function callRpc(fnName, args) {
  const result = await supabase.rpc(fnName, args)
  if (fnName === CLOCK_RPC && result.error?.code === 'PGRST202' && args && 'p_occurred_at' in args) {
    const { p_occurred_at: _tapTime, ...rest } = args
    return supabase.rpc(fnName, rest)
  }
  return result
}

function enqueueAndReport(fnName, args, error) {
  enqueueRpc(fnName, args)
  if (fnName === CLOCK_RPC) {
    reportError(error ?? new Error('Clock event held on device'), {
      context: 'offlineRpc:clock-event-queued',
      event_type: args?.p_event_type,
      staff_id: args?.p_staff_id,
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    })
  }
}

/** RPC call with offline fallback */
export async function offlineRpc(fnName, args) {
  try {
    const result = await callRpc(fnName, args)
    if (result.error && isNetworkError(result.error)) {
      enqueueAndReport(fnName, args, result.error)
      return { data: null, error: null, queued: true }
    }
    return result
  } catch (err) {
    if (isNetworkError(err)) {
      enqueueAndReport(fnName, args, err)
      return { data: null, error: null, queued: true }
    }
    throw err
  }
}

/** Update with offline fallback. recordId is required — the PK value of the row to update. */
export async function offlineUpdate(table, recordId, payload, idColumn = 'id') {
  try {
    const result = await supabase.from(table).update(payload).eq(idColumn, recordId)
    if (result.error && isNetworkError(result.error)) {
      enqueue(table, 'update', payload, recordId, idColumn)
      return { data: null, error: null, queued: true }
    }
    return result
  } catch (err) {
    if (isNetworkError(err)) {
      enqueue(table, 'update', payload, recordId, idColumn)
      return { data: null, error: null, queued: true }
    }
    throw err
  }
}

// A write the server refused as "not allowed" (SQLSTATE 42501: an RLS denial,
// a revoked function, or a clock RPC's caller check — migration 139). When a
// queued write replays, that usually means the device's venue JWT had lapsed
// and couldn't be renewed yet, not that the write is wrong — so it stays
// queued for the next sync instead of being thrown away. A clock punch is a
// payroll record; dropping it silently is worse than retrying it.
const AUTH_REFUSED = '42501'

// …but not forever: something still refused after a week is never going to
// be allowed (the person left, the venue was unlinked), and a stuck clock
// event would keep useClockStatus showing a stale state on this device.
const AUTH_RETRY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function isFresh(item) {
  const queuedAt = Date.parse(item.timestamp)
  return Number.isFinite(queuedAt) && Date.now() - queuedAt < AUTH_RETRY_MAX_AGE_MS
}

function shouldKeepRefused(item, error) {
  // Clock punches are kept through ANY refusal for the week, not only 42501:
  // the device can't tell a transient failure from a lasting one, and deleting
  // the punch loses someone's hours or break for good. The server refuses
  // anything older than a week itself (144), so this always ends.
  if (item.type === 'rpc' && item.fnName === CLOCK_RPC) return isFresh(item)
  if (error?.code !== AUTH_REFUSED) return false
  return isFresh(item)
}

// First refusal of each queued clock punch goes to Sentry — once, not on
// every 60 s retry — and so does giving up on one.
function reportClockReplay(item, error, gaveUp) {
  if (item.type !== 'rpc' || item.fnName !== CLOCK_RPC) return
  if (!gaveUp && item.reported) return
  reportError(error, {
    context: gaveUp ? 'syncQueue:clock-event-dropped' : 'syncQueue:clock-event-refused',
    event_type: item.args?.p_event_type,
    staff_id: item.args?.p_staff_id,
    queued_at: item.timestamp,
  })
  if (!gaveUp) updateQueueItem(item.id, { reported: true })
}

/** Retry all queued operations */
export async function syncQueue() {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const item of queue) {
    try {
      let result
      if (item.type === 'rpc') {
        result = await callRpc(item.fnName, item.args)
      } else if (item.operation === 'insert') {
        result = await supabase.from(item.table).insert(item.payload)
      } else if (item.operation === 'update') {
        // Drop updates that were queued without a recordId — they can't be safely replayed
        if (!item.recordId) { dequeue(item.id); failed++; continue }
        result = await supabase.from(item.table).update(item.payload).eq(item.idColumn ?? 'id', item.recordId)
      } else if (item.operation === 'upsert') {
        result = await supabase.from(item.table).upsert(item.payload)
      }

      if (!result?.error) {
        dequeue(item.id)
        synced++
      } else if (!isNetworkError(result.error)) {
        if (shouldKeepRefused(item, result.error)) {
          reportClockReplay(item, result.error, false)
        } else {
          reportClockReplay(item, result.error, true)
          dequeue(item.id)
          failed++
        }
      }
      // Still a network error, or refused while signed out — leave in queue
    } catch (err) {
      if (!isNetworkError(err)) {
        if (shouldKeepRefused(item, err)) {
          reportClockReplay(item, err, false)
        } else {
          reportClockReplay(item, err, true)
          dequeue(item.id)
          failed++
        }
      }
    }
  }

  return { synced, failed }
}
