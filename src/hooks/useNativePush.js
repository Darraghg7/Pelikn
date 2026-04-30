/**
 * useNativePush — Capacitor native iOS push notification registration
 *
 * Call registerNativePush(staffId, venueId) once after login on native iOS.
 * It will:
 *   1. Request permission from the OS
 *   2. Receive the APNs device token from Apple
 *   3. Upsert the token into the apns_tokens table
 *   4. Set up a listener so tapping a notification navigates to its URL
 *
 * On non-Capacitor platforms (web) this is a no-op.
 */

import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { SESSION_TOKEN_KEY } from '../lib/constants'

let listenersRegistered = false

export async function registerNativePush(staffId, venueId, navigate) {
  if (!Capacitor.isNativePlatform()) return
  if (!staffId || !venueId) return

  try {
    // Lazy-import to avoid bundling the plugin on web
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Request permission
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') {
      console.info('[push] permission not granted:', receive)
      return
    }

    // Register with Apple
    await PushNotifications.register()

    if (!listenersRegistered) {
      listenersRegistered = true

      // Token received — store it
      await PushNotifications.addListener('registration', async ({ value: token }) => {
        if (!token) return
        try {
          await supabase.rpc('register_apns_token', {
            p_session_token: localStorage.getItem(SESSION_TOKEN_KEY),
            p_staff_id:      staffId,
            p_venue_id:      venueId,
            p_token:         token,
          })
          console.info('[push] APNs token registered')
        } catch (err) {
          console.warn('[push] failed to store token:', err)
        }
      })

      // Token error
      await PushNotifications.addListener('registrationError', ({ error }) => {
        console.warn('[push] registration error:', error)
      })

      // Notification received while app is open — show it as foreground notification
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.info('[push] received in foreground:', notification.title)
        // Optionally: show an in-app toast here using the Toast context
      })

      // Notification tapped — navigate to the URL in the payload
      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = notification?.data?.url
        if (url && navigate) {
          navigate(url)
        }
      })
    }
  } catch (err) {
    console.warn('[push] native push setup failed:', err)
  }
}

/** Remove the stored APNs token for this device on logout */
export async function unregisterNativePush(staffId) {
  if (!Capacitor.isNativePlatform() || !staffId) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.getDeliveredNotifications()
    await supabase.rpc('unregister_apns_tokens', {
      p_session_token: localStorage.getItem(SESSION_TOKEN_KEY),
      p_staff_id:      staffId,
    })
    // Remove all delivered notifications from the notification centre
    await PushNotifications.removeAllDeliveredNotifications()
    listenersRegistered = false
    void result
  } catch (_) {
    // ignore
  }
}
