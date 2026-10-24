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

// ভর্তির কাগজপত্র (ছবি/PDF, সর্বোচ্চ ৫ MB): যে কেউ জমা দিতে পারে, কিন্তু বাকেট ব্যক্তিগত —
// শুধু অ্যাডমিন সাইন-করা সাময়িক লিংকে দেখতে পারেন। ফাইলের পথ (path) ফেরত দেয়।
export async function uploadApplicationFile(file) {
  if (!supabase) throw new Error('offline')
  if (file.size > 5 * 1024 * 1024) throw new Error('size')
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `docs/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { error } = await supabase.storage.from('applications').upload(path, file, { cacheControl: '3600' })
  if (error) throw error
  return path
}

// অ্যাডমিনের জন্য ব্যক্তিগত ফাইলের সাময়িক (১ ঘণ্টার) লিংক
export async function signedUrl(path) {
  if (!supabase || !path) return ''
  if (/^https?:/.test(path)) return path
  const { data } = await supabase.storage.from('applications').createSignedUrl(path, 3600)
  return data?.signedUrl || ''
}
