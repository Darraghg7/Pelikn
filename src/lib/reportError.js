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
import * as Sentry from '@sentry/react'

export function captureSilent(error, context) {
  try {
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
      {
        tags: { silent: true },
        extra: typeof context === 'string' ? { context } : (context ?? {}),
      }
    )
  } catch {
    /* error reporting must never itself throw */
  }
}
