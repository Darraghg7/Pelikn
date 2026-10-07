// Browser globals the app reads that the standard DOM types don't describe.
// Declared once here so the JS type check (tsconfig.checkjs.json) doesn't flag
// every use. Keep entries optional: none of these are guaranteed to exist.

interface Window {
  /** Set by main.jsx once the launch splash has finished animating. */
  __peliknSplashDone?: boolean
  __peliknSplashStarted?: boolean
  /** Injected by the Capacitor native shell (iOS/Android) before the bundle loads. */
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  /** Older Safari only. */
  webkitAudioContext?: typeof AudioContext
}

interface Navigator {
  /** iOS Safari: true when launched from the home screen. */
  standalone?: boolean
  /** Network Information API — Chromium only. */
  connection?: { effectiveType?: string; saveData?: boolean; downlink?: number }
}
