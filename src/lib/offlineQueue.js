/**
 * Offline Queue — stores failed Supabase writes in localStorage
 * and retries them when back online.
 */

const QUEUE_KEY = 'pelikn_offline_queue'

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch { return [] }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/** Add a failed table operation to the queue */
export function enqueue(table, operation, payload) {
  const queue = getQueue()
  queue.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2),
    type: 'table',
    table,
    operation, // 'insert' | 'update' | 'upsert'
    payload,
    timestamp: new Date().toISOString(),
  })
  saveQueue(queue)
}

/** Add a failed RPC call to the queue */
export function enqueueRpc(fnName, args) {
  const queue = getQueue()
  queue.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2),
    type: 'rpc',
    fnName,
    args,
    timestamp: new Date().toISOString(),
  })
  saveQueue(queue)
}

/** Remove a processed item from the queue */
export function dequeue(id) {
  const queue = getQueue().filter(item => item.id !== id)
  saveQueue(queue)
}

/** Clear entire queue */
export function clearQueue() {
  saveQueue([])
}

/** Get count of pending items */
export function queueCount() {
  return getQueue().length
}
