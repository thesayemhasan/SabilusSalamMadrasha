import { supabase } from './supabase'

// বাংলাদেশি মোবাইল নম্বর: 8801XXXXXXXXX রূপে (ঠিক না হলে ফাঁকা)
export const normPhone = (p) => {
  const d = String(p || '').replace(/[^\d]/g, '')
  const n = d.startsWith('880') ? d : d.startsWith('0') ? `88${d}` : d.length === 10 ? `880${d}` : d
  return /^8801[3-9]\d{8}$/.test(n) ? n : ''
}
// বাংলা (ইউনিকোড) বার্তায় ৭০ অক্ষরে ১টি SMS, ইংরেজিতে ১৬০
export const segments = (t) => (/^[\x00-\x7F]*$/.test(t) ? Math.max(1, Math.ceil(t.length / 160)) : Math.max(1, Math.ceil([...t].length / 70)))
export const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ''))

export async function sendBatch(kind, items, onProgress) {
  const tot = { sent: 0, failed: 0, skipped: 0, segments: 0 }
  for (let i = 0; i < items.length; i += 100) {
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { kind, items: items.slice(i, i + 100) } })
    if (error) {
      let msg = error.message
      try { const j = await error.context.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
      throw new Error(msg)
    }
    if (data?.error) throw new Error(data.error)
    ;['sent', 'failed', 'skipped', 'segments'].forEach((k) => { tot[k] += data[k] || 0 })
    onProgress && onProgress(Math.min(items.length, i + 100), items.length)
  }
  return tot
}
