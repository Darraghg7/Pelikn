import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!isConfigured) {
  console.warn(
    '[SafeServ] Missing Supabase environment variables.\n' +
    'Copy .env.example to .env, fill in your project URL and anon key, then restart the dev server.'
  )
}

// Safe to call createClient with placeholders — it won't crash on init,
// only actual DB queries will fail (handled gracefully when unconfigured).
export const supabase = createClient(
  supabaseUrl     || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
