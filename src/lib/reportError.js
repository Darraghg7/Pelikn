/**
 * captureSilent — report a swallowed/background error to Sentry without
 * surfacing it to the user.
 *
 * For failures that must not interrupt the user (a push notification that
 * didn't send, a best-effort cache refresh, an audit-log write) but that we
 * still want visibility on when they start happening systemically. It never
 * shows UI and never throws — safe to call from any catch block.
 *
 * @param {unknown} error   the caught error
 * @param {string|object} context  a label ('sendPush:rota_published') or an
 *                                  object of extra fields for the Sentry event
 */

// AppShell (non-lazy, wraps almost every route) imports this module, so a
// static `@sentry/react` import here put Sentry's ~140 kB on the same
// render-blocking entry chunk as everything else. Load it on demand instead
// — this path only ever runs from inside a catch block, so a dynamic import
// costs nothing on the happy path.
let sentryPromise = null
function loadSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react')
  return sentryPromise
}

export function captureSilent(error, context) {
  loadSentry()
    .then((Sentry) => {
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: { silent: true },
          extra: typeof context === 'string' ? { context } : (context ?? {}),
        }
      )
    })
    .catch(() => {
      /* error reporting must never itself throw */
    })
}
