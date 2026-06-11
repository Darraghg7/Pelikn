/**
 * Offline-aware Supabase wrapper.
 * Wraps insert/update/upsert — if the call fails due to network error,
 * it queues the operation for later sync.
 */
import { supabase } from './supabase'
import { enqueue, enqueueRpc, getQueue, dequeue } from './offlineQueue'

function isNetworkError(error) {
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

/** RPC call with offline fallback */
export async function offlineRpc(fnName, args) {
  try {
    const result = await supabase.rpc(fnName, args)
    if (result.error && isNetworkError(result.error)) {
      enqueueRpc(fnName, args)
      return { data: null, error: null, queued: true }
    }
    return result
  } catch (err) {
    if (isNetworkError(err)) {
      enqueueRpc(fnName, args)
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
        result = await supabase.rpc(item.fnName, item.args)
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
        dequeue(item.id)
        failed++
      }
      // Still a network error — leave in queue
    } catch (err) {
      if (!isNetworkError(err)) {
        dequeue(item.id)
        failed++
      }
    }
  }

  return { synced, failed }
}
