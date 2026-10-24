import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { VAPID_PUBLIC_KEY } from '../lib/constants'
import { reportError } from '../lib/reportError'
import { useToast } from '../components/ui/Toast'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

/**
 * Make this browser's subscription belong to this person only. Push follows the
 * browser, not the signed-in person: on a shared device the last person kept
 * getting alerts and the next person got none. Stores a row for this person and
 * removes any other person's row for the same browser. Throws if the row can't
 * be stored; a failure to clear the others is reported but not fatal.
 */
async function claimSubscription(staffId: string, venueId: string, sub: PushSubscription): Promise<void> {
  const { endpoint, keys } = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert({
    staff_id: staffId,
    venue_id: venueId,
    endpoint,
    p256dh:   keys?.p256dh,
    auth_key: keys?.auth,
  }, { onConflict: 'staff_id,endpoint' })
  if (error) throw error
  if (!endpoint) return
  const { error: clearErr } = await supabase.from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .neq('staff_id', staffId)
  if (clearErr) reportError(clearErr, 'usePushNotifications:claim-clear-others')
}

export function usePushNotifications(staffId: string, venueId: string): {
  supported: boolean
  permission: NotificationPermission | 'default'
  subscribed: boolean
  subscribing: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  notify: (title: string, body: string, url?: string) => void
} {
  const [supported,   setSupported]   = useState(false)
  const [permission,  setPermission]  = useState<NotificationPermission | 'default'>('default')
  const [subscribed,  setSubscribed]  = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const toast = useToast() as ((message: string, type?: string) => void) | null

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  useEffect(() => {
    if (!supported || !staffId || !venueId) return
    let cancelled = false
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      if (cancelled) return
      setSubscribed(!!sub)
      // The browser is already subscribed (permission was given earlier, maybe
      // by someone else on this device): make sure it is registered for THIS
      // person, and no longer for the last one.
      if (sub && Notification.permission === 'granted') {
        claimSubscription(staffId, venueId, sub).catch(e => reportError(e, 'usePushNotifications:claim'))
      }
    })
    return () => { cancelled = true }
  }, [supported, staffId, venueId])

  const subscribe = useCallback(async () => {
    if (!supported || !staffId || !venueId) return
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setSubscribing(false); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Without the stored subscription the server has nowhere to send alerts,
      // so don't show "on" — the browser side alone does nothing. Throws on failure.
      await claimSubscription(staffId, venueId, sub)

      setSubscribed(true)
    } catch (err) {
      reportError(err, 'usePushNotifications:subscribe')
      toast?.("Couldn't turn on notifications. Please try again.", 'error')
    }
    setSubscribing(false)
  }, [supported, staffId, venueId, toast])

  const unsubscribe = useCallback(async () => {
    if (!supported) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      // The browser subscription is gone, so this device gets nothing either
      // way; a leftover row only means failed sends server-side. Report it.
      const { error } = await supabase.from('push_subscriptions')
        .delete()
        .eq('staff_id', staffId)
        .eq('endpoint', sub.endpoint)
      if (error) reportError(error, 'usePushNotifications:unsubscribe')
    }
    setSubscribed(false)
  }, [supported, staffId])

  // Helper: fire a local browser notification (requires permission)
  const notify = useCallback((title: string, body: string, url = '/dashboard') => {
    if (permission !== 'granted') return
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data:  { url },
      })
    })
  }, [permission])

  return { supported, permission, subscribed, subscribing, subscribe, unsubscribe, notify }
}
