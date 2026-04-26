/**
 * sendPush — unified push helper
 *
 * Fires both Web Push (send-push) and native iOS APNs (send-apns) in parallel.
 * Either can fail silently without affecting the other or the caller.
 *
 * Usage:
 *   import { sendPush } from '../lib/sendPush'
 *   await sendPush({ venueId, title, body, url, roles })           // to role(s)
 *   await sendPush({ venueId, title, body, url, staffIds: [id] })  // to specific staff
 */

import { supabase } from './supabase'

export async function sendPush({ venueId, title, body, url = '/', roles, staffIds } = {}) {
  if (!venueId || !title || !body) return

  const payload = { venueId, title, body, url, ...(staffIds ? { staffIds } : { roles }) }

  await Promise.allSettled([
    supabase.functions.invoke('send-push', { body: payload }),
    supabase.functions.invoke('send-apns', { body: payload }),
  ])
}
