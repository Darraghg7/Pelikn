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

// Holds the active PIN-session token so the custom fetch wrapper can inject it
// into every Supabase request as X-Pelikn-Session. PostgREST reads this header
// via the pre_request function, sets app.current_venue_id, and RLS policies
// use that value to scope all queries to the authenticated venue.
let _sessionToken = ''

export function updateSessionToken(token) {
  _sessionToken = token ?? ''
}

export const supabase = createClient(
  supabaseUrl     || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: true,
      storageKey: 'pelikn-auth-token',
    },
    global: {
      fetch: (url, options = {}) => {
        const headers = {
          ...options.headers,
          ...(_sessionToken ? { 'x-pelikn-session': _sessionToken } : {}),
        }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        return fetch(url, { ...options, headers, signal: controller.signal })
          .finally(() => clearTimeout(timeout))
      },
    },
  }
)
