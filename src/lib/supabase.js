import { createClient } from '@supabase/supabase-js'
import { demoSupabase, isDemoSession } from './demoSupabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars tidak ditemukan. Isi .env dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY')
}

const liveSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

// Sesi demo selalu memakai data lokal, sehingga operasi POS tidak mencapai Supabase produksi.
export const supabase = new Proxy(liveSupabase, {
  get(target, key) {
    if (isDemoSession() && key in demoSupabase) return demoSupabase[key]
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  },
})
