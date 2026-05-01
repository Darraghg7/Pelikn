/**
 * send-push — Web Push notification sender
 *
 * Sends a push notification to all subscribed managers/owners at a venue,
 * or to a specific list of staff IDs.
 *
 * Body: { venueId, title, body, url, roles? }
 *   venueId  — the venue to target
 *   title    — notification title
 *   body     — notification body text
 *   url      — path to open on click (e.g. '/timeoff')
 *   roles    — optional array of staff roles to target (default: ['manager','owner'])
 */

import webpush from 'npm:web-push'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY  = 'BBDUCYpy030Ejbra3lzqTxIo663ciiqK_H-qCDmMQZ1wNwt9icOCYvjqhcyYAIyTIKorp4gpsS81MOp5InvjJDc'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const DEV_ORIGIN = Deno.env.get('DEV_ORIGIN')
const ALLOWED_ORIGINS = [
  'https://pelikn.app',
  'capacitor://localhost',
  'ionic://localhost',
  ...(DEV_ORIGIN ? [DEV_ORIGIN] : []),
]

webpush.setVapidDetails(
  'mailto:hello@pelikn.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

async function applyNotificationPreferences(db: any, staffIds: string[], venueId: string, notificationType?: string) {
  if (!notificationType || !staffIds.length) return staffIds

  const { data, error } = await db
    .from('staff_notification_preferences')
    .select('staff_id, enabled')
    .eq('venue_id', venueId)
    .eq('notification_type', notificationType)
    .in('staff_id', staffIds)

  if (error) throw error

  const disabled = new Set((data ?? []).filter((row: any) => row.enabled === false).map((row: any) => row.staff_id))
  return staffIds.filter(id => !disabled.has(id))
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { venueId, title, body, url = '/', roles, staffIds, sessionToken, notificationType } = await req.json()

    if (!venueId || !title || !body) {
      return jsonResponse({ error: 'venueId, title and body are required' }, 400, corsHeaders)
    }
    if (!sessionToken) {
      return jsonResponse({ error: 'Missing session token' }, 401, corsHeaders)
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const { data: allowed, error: authErr } = await db.rpc('validate_staff_session_for_venue', {
      p_session_token: sessionToken,
      p_venue_id:      venueId,
    })
    if (authErr) throw authErr
    if (!allowed) return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders)

    // Look up push subscriptions — either for specific staff or by role
    let query = db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key, staff_id, staff:staff_id(role, venue_id)')

    if (staffIds?.length) {
      const { data: staffAtVenue } = await db
        .from('staff')
        .select('id')
        .eq('venue_id', venueId)
        .in('id', staffIds)
        .eq('is_active', true)

      if (!staffAtVenue?.length) {
        return jsonResponse({ sent: 0, message: 'No matching staff with push subscriptions' }, 200, corsHeaders)
      }

      const targetIds = await applyNotificationPreferences(db, staffAtVenue.map(s => s.id), venueId, notificationType)
      if (!targetIds.length) {
        return jsonResponse({ sent: 0, message: 'All matching staff disabled this notification type' }, 200, corsHeaders)
      }

      query = query.in('staff_id', targetIds)
    } else {
      // Filter to the target venue and roles
      const targetRoles = roles ?? ['manager', 'owner']
      const { data: staffAtVenue } = await db
        .from('staff')
        .select('id')
        .eq('venue_id', venueId)
        .in('role', targetRoles)

      if (!staffAtVenue?.length) {
        return jsonResponse({ sent: 0, message: 'No matching staff with push subscriptions' }, 200, corsHeaders)
      }

      const targetIds = await applyNotificationPreferences(db, staffAtVenue.map(s => s.id), venueId, notificationType)
      if (!targetIds.length) {
        return jsonResponse({ sent: 0, message: 'All matching staff disabled this notification type' }, 200, corsHeaders)
      }

      query = query.in('staff_id', targetIds)
    }

    const { data: subscriptions, error: subErr } = await query
    if (subErr) throw subErr
    if (!subscriptions?.length) {
      return jsonResponse({ sent: 0, message: 'No push subscriptions found' }, 200, corsHeaders)
    }

    const payload = JSON.stringify({ title, body, url, notificationType })
    const expiredIds: string[] = []
    let sent = 0

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        )
        sent++
      } catch (err: any) {
        // 410 Gone = subscription expired, clean it up
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id)
        } else {
          console.error(`Push failed for ${sub.endpoint}:`, err?.message)
        }
      }
    }))

    // Remove expired subscriptions
    if (expiredIds.length) {
      await db.from('push_subscriptions').delete().in('id', expiredIds)
    }

    return jsonResponse({ sent, expired: expiredIds.length }, 200, corsHeaders)
  } catch (err) {
    console.error('send-push error:', err)
    return jsonResponse({ error: String(err) }, 500, corsHeaders)
  }
})
