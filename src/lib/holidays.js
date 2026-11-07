import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ঘোষিত ছুটির তালিকা (admin/ছুটির তালিকা পাতা থেকে)। ছুটি না থাকলে বা টেবিল না থাকলে খালি তালিকা।
export function useHolidays() {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!supabase) return
    supabase.from('holidays').select('*').order('from_date').then(({ data }) => setList(data || []))
  }, [])
  const on = (d) => list.find((h) => String(h.from_date) <= d && d <= String(h.to_date)) || null
  const daysIn = (ym) => {
    if (!/^\d{4}-\d{2}$/.test(ym || '')) return 0
    const [y, m] = ym.split('-').map(Number)
    const n = new Date(y, m, 0).getDate()
    let c = 0
    for (let d = 1; d <= n; d++) if (on(`${ym}-${String(d).padStart(2, '0')}`)) c += 1
    return c
  }
  return { list, on, daysIn }
}
