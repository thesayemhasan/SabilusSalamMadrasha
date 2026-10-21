import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase সংযোগ না থাকলেও পাবলিক সাইট ডিফল্ট লেখা নিয়ে চলবে
export const configured = Boolean(url && key && !url.includes('xxxxxxxx'))
export const supabase = configured ? createClient(url, key) : null

export async function uploadImage(file, folder = 'misc') {
  if (!supabase) throw new Error('Supabase সংযুক্ত নয়')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600' })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
