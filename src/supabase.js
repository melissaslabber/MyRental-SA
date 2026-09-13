import { createClient } from '@supabase/supabase-js'

// Public browser credentials. Row Level Security in Supabase protects all data.
// Vercel variables take priority; these values keep production working if the
// build environment is not injected correctly.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://hneloyinjdhgocezglxl.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vXXB2JoofmPdHl82O-dc9A_rfSRfS59'

export const supabaseConfigured = Boolean(url && anonKey)
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
