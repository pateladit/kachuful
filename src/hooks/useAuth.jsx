import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Resolve the initial session before rendering protected routes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch is_admin whenever the logged-in user changes
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(data?.is_admin ?? false))
  }, [user?.id])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email, password, username) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Note: Google OAuth must be enabled in the Supabase dashboard under
  // Authentication → Providers → Google.
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/history` },
    })
    if (error) throw error
  }

  async function signInAnonymously(displayName) {
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { username: displayName } },
    })
    if (error) throw error
  }

  // Upgrade anonymous → email/password account.
  // Sends a confirmation email; session stays anonymous until confirmed.
  async function upgradeWithEmail(email, password) {
    const { error } = await supabase.auth.updateUser({ email, password })
    if (error) throw error
  }

  // Link Google identity to the current (anonymous) session.
  // Requires "Identity Linking" enabled in Supabase Auth settings.
  async function linkWithGoogle() {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/preferences` },
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user, loading, isAdmin,
      signIn, signUp, signOut,
      signInWithGoogle, signInAnonymously,
      upgradeWithEmail, linkWithGoogle,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
