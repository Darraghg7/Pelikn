import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Do NOT call skipWaiting() here.
// Previously skipWaiting() + clientsClaim() caused the new service worker to
// immediately hijack all open tabs on every deploy, deleting the old JS chunks
// from the precache and crashing any tab that tried to load them mid-session.
// Users would lose unsaved form data and see a blank screen.
//
// Instead: the new SW waits in "waiting" state until all tabs are closed, or
// until the user manually accepts the update via the "Update ready" banner.
// The app sends a SKIP_WAITING message to trigger the update on demand.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// clients.claim() here is safe precisely because skipWaiting() above is
// gated on the user's explicit click — activate only fires early when they
// asked for it. Without this, skipWaiting() lets the new SW become "active"
// but it never takes control of the already-open tab, so `controllerchange`
// on the client never fires, UpdateBanner's reload() never runs, and the
// Update button silently does nothing (looks like a glitch/flash with no
// effect since the button's own press animation is the only visible change).
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

// Workbox precaching — manifest injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback: serve cached index.html for all page navigations.
// Without this, navigating to /login, /dashboard, /v/... etc. isn't in the
// precache so the SW falls through to network — if that fails the PWA shows
// a blank screen. This makes the app work correctly offline too.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Remove outdated caches from previous builds to free storage
cleanupOutdatedCaches()

// Hashed build assets that are deliberately kept out of the precache (the PDF
// and OCR vendor chunks — see `injectManifest.globIgnores` in vite.config.js).
// The filenames contain a content hash, so a hit can never be stale and
// CacheFirst is safe. This is what gives those chunks offline availability
// from the second use onwards without precaching them for everyone.
registerRoute(
  ({ url, request }) =>
    request.destination === 'script' &&
    url.origin === self.location.origin &&
    /\/assets\/(pdf|ocr)-vendor-[^/]+\.js$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'lazy-vendor-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
)

// Cache Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
)

// ── Push notifications ────────────────────────────────────────────────────

self.addEventListener('push', event => {
  let data = { title: 'Pelikn', body: 'You have a new alert', url: '/dashboard' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (e) {
    // ignore parse errors
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data:  { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetPath = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // Resolve the target path relative to the venue the user is already in.
          // e.g. if client is at /v/nomad/dashboard and targetPath is /time-off,
          // navigate to /v/nomad/time-off instead of bare /time-off
          let resolvedUrl = targetPath
          try {
            const match = new URL(client.url).pathname.match(/^\/v\/([^/]+)/)
            if (match && !targetPath.startsWith('/v/')) {
              resolvedUrl = `/v/${match[1]}${targetPath.startsWith('/') ? targetPath : '/' + targetPath}`
            }
          } catch { /* use targetPath as-is */ }
          client.navigate(resolvedUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetPath)
    })
  )
})
