// src/lib/supabase.ts
//
// PURPOSE: Supabase client for the admin panel.
// Uses the SERVICE ROLE KEY — bypasses RLS to read all user data.
// This key must NEVER be exposed in the student app.
// It lives in .env only and is never committed to git.
//
// IMPORTANT: This client has full DB access — use with care.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const serviceKey   = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing Supabase environment variables. Check .env file.')
}

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    // Use persistent sessions so admin stays logged in across refreshes
    persistSession: true,
    autoRefreshToken: true,
  }
})
