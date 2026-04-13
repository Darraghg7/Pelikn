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

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

webpush.setVapidDetails(
  'mailto:nomad.bakes1@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { venueId, title, body, url = '/', roles, staffIds } = await req.json()

    if (!venueId || !title || !body) {
      return new Response(JSON.stringify({ error: 'venueId, title and body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // Look up push subscriptions — either for specific staff or by role
    let query = db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key, staff_id, staff:staff_id(role, venue_id)')

    if (staffIds?.length) {
      query = query.in('staff_id', staffIds)
    } else {
      // Filter to the target venue and roles
      const targetRoles = roles ?? ['manager', 'owner']
      const { data: staffAtVenue } = await db
        .from('staff')
        .select('id')
        .eq('venue_id', venueId)
        .in('role', targetRoles)

      if (!staffAtVenue?.length) {
        return new Response(JSON.stringify({ sent: 0, message: 'No matching staff with push subscriptions' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      query = query.in('staff_id', staffAtVenue.map(s => s.id))
    }

    const { data: subscriptions, error: subErr } = await query
    if (subErr) throw subErr
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No push subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({ title, body, url })
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

    return new Response(JSON.stringify({ sent, expired: expiredIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
