import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { validateEmail, validateNewPassword } from '../utils/authValidation'
import { changePasswordWithVerification } from '../utils/changePassword'
import { normalizeUsername, validateUsername } from '../utils/username'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!error) setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    loadProfile(session?.user?.id)
  }, [session?.user?.id, loadProfile])

  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  async function resetPassword(password) {
    const validationError = validateNewPassword(password)
    if (validationError) throw new Error(validationError)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  async function changePassword(currentPassword, password) {
    await changePasswordWithVerification(supabase.auth, session?.user, currentPassword, password)
  }

  async function signUp({ email, password, displayName, username: requestedUsername, avatarEmoji }) {
    const validationError = validateEmail(email) || validateNewPassword(password)
    if (validationError) throw new Error(validationError)
    const username = normalizeUsername(requestedUsername || '')
    const usernameError = validateUsername(username)
    if (usernameError) throw new Error(usernameError)
    if (!displayName.trim() || displayName.trim().length > 80) throw new Error('Ad Soyad 1–80 karakter olmalı.')
    const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', { candidate: username })
    if (availabilityError) throw new Error('Kullanıcı adı kontrol edilemedi. Lütfen tekrar dene.')
    if (!available) throw new Error('Bu kullanıcı adı alınmış. Başka bir kullanıcı adı seç.')
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), username, avatar_emoji: avatarEmoji },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) {
      // Another signup may have claimed the name after our availability check.
      const { data: stillAvailable } = await supabase.rpc('is_username_available', { candidate: username })
      if (stillAvailable === false) throw new Error('Bu kullanıcı adı alınmış. Başka bir kullanıcı adı seç.')
      throw error
    }
  }

  async function resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (error) throw error
  }

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function updateProfile(patch) {
    if (!session?.user) throw new Error('Lütfen tekrar giriş yap.')
    if (typeof patch.display_name === 'string') {
      patch = { ...patch, display_name: patch.display_name.trim() }
      if (!patch.display_name || patch.display_name.length > 80) throw new Error('Ad Soyad 1–80 karakter olmalı.')
    }
    if (typeof patch.username === 'string') {
      patch = { ...patch, username: normalizeUsername(patch.username) }
      const usernameError = validateUsername(patch.username)
      if (usernameError) throw new Error(usernameError)
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', session.user.id)
      .select()
      .single()
    if (error?.code === '23505') throw new Error('Bu kullanıcı adı alınmış. Başka bir kullanıcı adı seç.')
    if (error) throw error
    setProfile(data)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resendConfirmation,
    requestPasswordReset,
    resetPassword,
    changePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
