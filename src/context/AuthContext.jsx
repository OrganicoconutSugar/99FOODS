import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
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
    const url = `${urlData.publicUrl}?t=${Date.now()}`

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
    const { data, error } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    })
    if (error) throw error
    setUser(data.user)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, uploadAvatar, removeAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
