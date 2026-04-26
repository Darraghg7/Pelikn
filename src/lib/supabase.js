import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!isConfigured) {
  console.warn(
    '[Pelikn] Missing Supabase environment variables.\n' +
    'Copy .env.example to .env, fill in your project URL and anon key, then restart the dev server.'
  )
}

// Safe to call createClient with placeholders — it won't crash on init,
// only actual DB queries will fail (handled gracefully when unconfigured).
export const supabase = createClient(
  supabaseUrl     || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      // Explicitly enable session persistence and auto token refresh.
      // Supabase JWTs expire after 1 hour — auto-refresh keeps the owner
      // logged in without requiring re-entry of email/password.
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: true,
      storageKey: 'pelikn-auth-token',
    },
    global: {
      // Abort any hanging fetch after 15 seconds to prevent indefinite hangs
      fetch: (url, options = {}) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        return fetch(url, { ...options, signal: controller.signal })
          .finally(() => clearTimeout(timeout))
      },
    },
  }
)
