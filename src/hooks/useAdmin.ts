// src/hooks/useAdmin.ts
//
// PURPOSE: Auth hook for the admin panel.
// Checks that the logged-in user has use_mode = 'admin' in profiles.
// If not admin, returns isAdmin: false — the router redirects to login.
//
// READS FROM: profiles table (Supabase)
// USED BY: App.tsx (route protection), all admin pages

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AdminAuth {
  user: User | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAdmin(): AdminAuth {
  const [user, setUser]       = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        checkAdminRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        checkAdminRole(session.user.id)
      } else {
        setUser(null)
        setIsAdmin(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Verify admin role — use_mode = 'admin' must be set in profiles table
  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('use_mode')
      .eq('id', userId)
      .single()
    setIsAdmin(data?.use_mode === 'admin')
    setLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
  }

  return { user, isAdmin, loading, signIn, signOut }
}
