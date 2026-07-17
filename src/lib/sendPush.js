/**
 * sendPush — unified push helper
 *
 * Fires both Web Push (send-push) and native iOS APNs (send-apns) in parallel.
 * Either can fail silently without affecting the other or the caller.
 *
 * Usage:
 *   import { sendPush } from '../lib/sendPush'
 *   await sendPush({ venueId, notificationType, title, body, url, roles })
 *   await sendPush({ venueId, notificationType, title, body, url, staffIds: [id] })
 */

import { supabase } from './supabase'
import { SESSION_TOKEN_KEY } from './constants'
import { captureSilent } from './reportError'

export async function sendPush({ venueId, notificationType, title, body, url = '/', roles, staffIds } = {}) {
  if (!venueId || !title || !body) return

  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY)
  const payload = {
    venueId,
    title,
    body,
    url,
    sessionToken,
    notificationType,
    ...(staffIds ? { staffIds } : { roles }),
  }

  // Never rejects — a failed push must not break the primary action that
  // triggered it. Failures are reported to Sentry so a systemically broken
  // push channel is visible rather than silent.
  const [webPush, apns] = await Promise.allSettled([
    supabase.functions.invoke('send-push', { body: payload }),
    supabase.functions.invoke('send-apns', { body: payload }),
  ])
  if (webPush.status === 'rejected' || webPush.value?.error) {
    captureSilent(webPush.reason ?? webPush.value?.error, `sendPush:send-push:${notificationType}`)
  }
  if (apns.status === 'rejected' || apns.value?.error) {
    captureSilent(apns.reason ?? apns.value?.error, `sendPush:send-apns:${notificationType}`)
  }
}
