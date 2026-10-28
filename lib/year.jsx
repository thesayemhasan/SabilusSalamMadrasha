import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// শিক্ষাবর্ষ: অ্যাডমিন প্যানেলের হিসাব/তথ্য নির্বাচিত বর্ষের তারিখের ভেতরে ফিল্টার হয়।
// কোনো শিক্ষাবর্ষ তৈরি না থাকলে (year = null) কিছুই ফিল্টার হয় না — আগের মতোই সব দেখায়।
const Ctx = createContext({ years: [], year: null, from: null, to: null, setYearId: () => {}, inYear: () => true, reload: () => {}, loading: true })
const KEY = 'adm_year_id'
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const read = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const write = (v) => { try { localStorage.setItem(KEY, v) } catch { /* ignore */ } }

export function YearProvider({ children }) {
  const [years, setYears] = useState([])
  const [picked, setPicked] = useState(read())
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const { data } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false })
    setYears(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])

  const current = useMemo(() => {
    const t = todayStr()
    return years.find((y) => y.start_date <= t && t <= y.end_date) || years.find((y) => y.start_date <= t) || years[years.length - 1] || null
  }, [years])
  const year = useMemo(() => years.find((y) => y.id === picked) || current, [years, picked, current])
  const setYearId = (id) => { setPicked(id); write(id) }
  const from = year ? year.start_date : null
  const to = year ? year.end_date : null
  const inYear = useCallback((d) => { if (!year || !d) return true; const s = String(d).slice(0, 10); return s >= year.start_date && s <= year.end_date }, [year])
  const value = useMemo(() => ({ years, year, current, from, to, setYearId, inYear, reload, loading }), [years, year, current, from, to, inYear, reload, loading])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useYear = () => useContext(Ctx)

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// তারিখ-পরিসরের ডিফল্ট: আজ বর্ষের ভেতরে হলে চলতি মাসের ১ তারিখ থেকে আজ; নইলে পুরো বর্ষ। বর্ষ বদলালে নিজে রিসেট হয়।
export function useYearDates() {
  const { year } = useYear()
  const id = year?.id || ''
  const calc = () => {
    const t = todayStr()
    if (!year) return [`${t.slice(0, 7)}-01`, t]
    if (t >= year.start_date && t <= year.end_date) return [`${t.slice(0, 7)}-01`, t]
    return [year.start_date, year.end_date]
  }
  const [r, setR] = useState(calc)
  useEffect(() => { setR(calc()) }, [id]) // eslint-disable-line
  const lo = year ? year.start_date : undefined
  const hi = year ? year.end_date : undefined
  const clampF = (v) => (lo && v < lo ? lo : hi && v > hi ? hi : v)
  return { from: clampF(r[0]), to: clampF(r[1]), setFrom: (v) => setR([v, r[1]]), setTo: (v) => setR([r[0], v]), min: lo, max: hi }
}
