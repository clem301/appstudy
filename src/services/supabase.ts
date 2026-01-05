import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Sync will be disabled.')
}

let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
  console.log('✅ Supabase initialisé - Sync activée')
} else {
  console.warn('⚠️ Supabase non configuré - Mode local uniquement')
}

export { supabase }

/**
 * Vérifie si Supabase est configuré et disponible
 */
export function isSupabaseEnabled(): boolean {
  return supabase !== null
}

/**
 * Récupère un ID unique pour cet appareil
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}
