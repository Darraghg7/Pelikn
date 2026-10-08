/**
 * reportError — send a caught error to Sentry without showing the user anything.
 *
 * Every catch block in the app does one of three things:
 *   (a) ignores the error on purpose, with a comment saying why;
 *   (b) calls reportError() — a failure the user doesn't need to act on (a
 *       background refresh, a push token, a realtime subscribe) but that we
 *       want to see when it starts happening systemically;
 *   (c) shows the user a toast — anything they initiated (save, delete,
 *       approve, clock-in, upload). Those may call reportError() as well.
 *
 * Never throws and never shows UI, so it is safe in any catch block. In dev it
 * also console.warns, because Sentry is disabled outside production.
 *
 * @param {unknown} error   the caught error (Error, PostgrestError, string…)
 * @param {string|object} [context]  a label ('useDuties:save-items') or an
 *                                    object of extra fields for the event
 */

// Sentry is lazy-loaded by main.jsx (initSentry), and skipped entirely in dev,
// without a DSN, or on slow/metered connections. So this module never imports
// @sentry/react itself — doing so would download ~160 kB just to report into
// an SDK that was never initialised. Instead main.jsx hands us the SDK once
// init has run, and anything reported before then waits in a small queue.
// If Sentry never starts, the queue is simply never flushed.
const MAX_QUEUE = 20
let sentry = null
let queue = []

function toError(error) {
  if (error instanceof Error) return error
  // PostgrestError / StorageError are plain objects with a message — keep it
  // readable in Sentry instead of "[object Object]".
  if (error && typeof error === 'object' && 'message' in error) {
    const e = new Error(String(error.message))
    if ('code' in error && error.code) e.name = `SupabaseError ${error.code}`
    return e
  }
  return new Error(String(error))
}

function send(error, context, tags) {
  try {
    sentry.captureException(toError(error), {
      tags,
      extra: typeof context === 'string' ? { context } : (context ?? {}),
    })
  } catch {
    /* error reporting must never itself throw */
  }
}

export function reportError(error, context, { silent = true } = {}) {
  if (import.meta.env.DEV) console.warn('[reportError]', context ?? '', error)
  const tags = { silent }
  if (sentry) send(error, context, tags)
  else if (queue.length < MAX_QUEUE) queue.push([error, context, tags])
}

/** Called by main.jsx after Sentry.init — flushes anything reported early. */
export function attachSentry(sdk) {
  sentry = sdk
  const pending = queue
  queue = []
  for (const [error, context, tags] of pending) send(error, context, tags)
}

/** @deprecated older name for reportError — kept so existing call sites read the same. */
export const captureSilent = reportError

/** Test-only: forget the attached SDK and queue. */
export function __resetForTests() {
  sentry = null
  queue = []
}
