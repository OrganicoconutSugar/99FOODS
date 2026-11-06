import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_SESSION_KEY, getDemoProfile, saveDemoProfile } from '../lib/demoSupabase'

const AuthContext = createContext(null)
export { DEMO_EMAIL, DEMO_PASSWORD }
const demoUser = () => ({ id: 'demo-local', email: DEMO_EMAIL, user_metadata: getDemoProfile() })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => sessionStorage.getItem(DEMO_SESSION_KEY) === '1' ? demoUser() : null)
  const [isDemo, setIsDemo] = useState(() => sessionStorage.getItem(DEMO_SESSION_KEY) === '1')
  const [loading, setLoading] = useState(() => sessionStorage.getItem(DEMO_SESSION_KEY) !== '1')

  useEffect(() => {
    if (sessionStorage.getItem(DEMO_SESSION_KEY) === '1') return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (sessionStorage.getItem(DEMO_SESSION_KEY) !== '1') setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (sessionStorage.getItem(DEMO_SESSION_KEY) !== '1') setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    if (email.trim().toLowerCase() === DEMO_EMAIL) {
      if (password !== DEMO_PASSWORD) throw new Error('Password demo tidak sesuai')
      sessionStorage.setItem(DEMO_SESSION_KEY, '1')
      setIsDemo(true)
      setUser(demoUser())
      return { user: demoUser() }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
    if (isDemo) {
      sessionStorage.removeItem(DEMO_SESSION_KEY)
      setIsDemo(false)
      setUser(null)
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Upload avatar ke bucket menu-images/avatars/{userId}.jpg (overwrite),
  // simpan public URL ke user.user_metadata.avatar_url
  const uploadAvatar = async (blob) => {
    if (!user) throw new Error('Belum login')
    const path = `avatars/${user.id}.jpg`
    const { error: upErr } = await supabase.storage
      .from('menu-images')
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true })
    if (upErr) throw upErr

    const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(path)
    const url = isDemo ? urlData.publicUrl : `${urlData.publicUrl}?t=${Date.now()}`

    if (isDemo) {
      const metadata = { ...getDemoProfile(), avatar_url: url }
      saveDemoProfile(metadata)
      setUser({ ...user, user_metadata: metadata })
      return url
    }

    const { data, error: updErr } = await supabase.auth.updateUser({
      data: { avatar_url: url },
    })
    if (updErr) throw updErr
    setUser(data.user)
    return url
  }

  const removeAvatar = async () => {
    if (!user) throw new Error('Belum login')
    await supabase.storage.from('menu-images').remove([`avatars/${user.id}.jpg`])
    if (isDemo) {
      const metadata = { ...getDemoProfile(), avatar_url: null }
      saveDemoProfile(metadata)
      setUser({ ...user, user_metadata: metadata })
      return
    }
    const { data, error } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    })
    if (error) throw error
    setUser(data.user)
  }

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, login, logout, uploadAvatar, removeAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
