import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ---------------------------------------------------------------------------
// Memoized auth fetchers
//
// `supabase.auth.getUser()` uses an internal lock that breaks under React
// Strict Mode: the first useEffect's getUser() acquires the lock, the unmount
// orphans it, the second useEffect waits 5s and steals it, and the first
// promise rejects with "released because another request stole it".
//
// Solution: dedupe concurrent callers by sharing the same in-flight promise.
// The second mount awaits the first mount's request — only one lock acquisition.
// ---------------------------------------------------------------------------

export type ConsultorAuth = {
  id: string
  nombre: string
  email_institucional: string
  email: string | null
  rol: 'admin' | 'consultor'
  auth_id: string | null
  created_at: string
}

let userPromise: Promise<User | null> | null = null
let consultorPromise: Promise<ConsultorAuth | null> | null = null
let listenerSetup = false

function ensureAuthListener() {
  if (typeof window === 'undefined' || listenerSetup) return
  listenerSetup = true
  createClient().auth.onAuthStateChange(() => {
    userPromise = null
    consultorPromise = null
  })
}

export function getCurrentUser(): Promise<User | null> {
  ensureAuthListener()
  if (!userPromise) {
    userPromise = createClient().auth.getUser()
      .then(({ data, error }) => (error ? null : data.user))
      .catch(() => {
        userPromise = null
        return null
      })
  }
  return userPromise
}

export function getCurrentConsultor(): Promise<ConsultorAuth | null> {
  ensureAuthListener()
  if (!consultorPromise) {
    consultorPromise = (async () => {
      const user = await getCurrentUser()
      if (!user) return null
      const { data, error } = await createClient()
        .from('consultores')
        .select('id, nombre, email_institucional, email, rol, auth_id, created_at')
        .eq('auth_id', user.id)
        .single()
      if (error) return null
      return data as ConsultorAuth
    })().catch(() => {
      consultorPromise = null
      return null
    })
  }
  return consultorPromise
}

export function invalidateAuthCache() {
  userPromise = null
  consultorPromise = null
}
