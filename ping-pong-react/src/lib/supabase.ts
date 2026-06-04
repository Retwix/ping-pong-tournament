import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Surfaced clearly in the console + UI rather than failing cryptically.
  console.error(
    'Supabase env vars missing. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')

export const hasSupabaseConfig = Boolean(url && anonKey)
