import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://djwgyyerxvxovicixxrp.supabase.co'
// Anon key is public by design. Hardcoded directly to bypass a Vercel env var
// that was accidentally set to the wrong publishable key format.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2d5eWVyeHZ4b3ZpY2l4eHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDIyMzEsImV4cCI6MjA4ODkxODIzMX0.PD3MydxFkVladSc7Trje7R3kPikE3axfqnIEkEM08Q8'

export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!isConfigured) {
  console.warn(
    '[Pelikn] Missing Supabase environment variables.\n' +
    'Copy .env.example to .env, fill in your project URL and anon key, then restart the dev server.'
  )
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
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        return fetch(url, { ...options, signal: controller.signal })
          .finally(() => clearTimeout(timeout))
      },
    },
  }
)
