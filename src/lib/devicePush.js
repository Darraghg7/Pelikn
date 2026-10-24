/**
 * Stop this device receiving the signed-out person's push notifications.
 *
 * Push subscriptions belong to a device, not a person, so on a shared tablet
 * the previous person's rota and time-off alerts kept arriving after they
 * signed out, and the next person was told notifications were already on.
 *
 * Web: unsubscribing in the browser kills the endpoint; the next send gets a
 * 410 and send-push deletes the stored row itself, so no signed-in request is
 * needed. iOS: the stored APNs token is removed with the session token the
 * caller had before sign-out cleared it.
 *
 * Never throws — sign-out must not fail over push clean-up.
 */
import { reportError } from './reportError'

export async function releaseDevicePush(staffId, sessionToken) {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window) {
      // getRegistration, not .ready: .ready never settles without a worker.
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
  } catch (e) {
    reportError(e, 'devicePush:web')
  }
  try {
    const { unregisterNativePush } = await import('../hooks/useNativePush')
    await unregisterNativePush(staffId, sessionToken)
  } catch (e) {
    reportError(e, 'devicePush:native')
  }
}
