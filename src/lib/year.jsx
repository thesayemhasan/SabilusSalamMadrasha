import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { fetchAll } from './db'

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

// নির্বাচিত শিক্ষাবর্ষে ভর্তি থাকা ছাত্র: ids = ছাত্র-আইডির সেট, classOf = বর্ষে তার শ্রেণি। শিক্ষাবর্ষ না থাকলে ids = null (ফিল্টার হয় না)
export function useEnrolled() {
  const { year } = useYear()
  const id = year?.id || ''
  const [st, setSt] = useState({ id: '', ids: null, classOf: {}, loading: Boolean(id) })
  const load = useCallback(async () => {
    if (!id) { setSt({ id: '', ids: null, classOf: {}, loading: false }); return }
    const { data } = await fetchAll((a, b) => supabase.from('enrollments').select('student_id,class_id').eq('year_id', id).order('id').range(a, b))
    const ids = new Set(); const classOf = {}
    ;(data || []).forEach((e) => { ids.add(e.student_id); classOf[e.student_id] = e.class_id })
    setSt({ id, ids, classOf, loading: false })
  }, [id])
  useEffect(() => { load() }, [load])
  const ready = !id || st.id === id
  return { ids: ready ? st.ids : null, classOf: st.classOf, loading: !ready, reload: load, has: (sid) => (!id ? true : ready ? st.ids.has(sid) : false), active: Boolean(id) }
}

const clampTo = (v, lo, hi) => (lo && v < lo ? lo : hi && v > hi ? hi : v)
// একটি দিন (হাজিরা ইত্যাদি): আজ বর্ষের ভেতরে হলে আজ, নইলে বর্ষের সবচেয়ে কাছের দিন
export function useYearDay() {
  const { year } = useYear()
  const [d, setD] = useState(todayStr())
  useEffect(() => { setD(clampTo(todayStr(), year?.start_date, year?.end_date)) }, [year?.id]) // eslint-disable-line
  const lo = year?.start_date; const hi = year?.end_date
  return { date: clampTo(d, lo, hi), setDate: setD, min: lo, max: hi }
}
// একটি মাস (YYYY-MM)
export function useYearMonth() {
  const { year } = useYear()
  const [m, setM] = useState(todayStr().slice(0, 7))
  const lo = year ? year.start_date.slice(0, 7) : undefined; const hi = year ? year.end_date.slice(0, 7) : undefined
  useEffect(() => { setM(clampTo(todayStr().slice(0, 7), lo, hi)) }, [year?.id]) // eslint-disable-line
  return { month: clampTo(m, lo, hi), setMonth: setM, min: lo, max: hi }
}

// পরীক্ষা নির্বাচিত বর্ষের কিনা: শুরুর তারিখ বর্ষের ভেতরে; তারিখ না থাকলে 'শিক্ষাবর্ষ' লেখা বর্ষের নামের সাথে মিললে; নইলে তৈরির তারিখে
export const examInYear = (x, y) => {
  if (!y) return true
  const within = (d) => { const s = String(d || '').slice(0, 10); return s >= y.start_date && s <= y.end_date }
  if (x.date_from) return within(x.date_from)
  if (x.year && String(x.year).trim() && [y.name_bn, y.name_en].filter(Boolean).includes(String(x.year).trim())) return true
  return within(x.created_at)
}

// ছাত্র-তালিকাকে নির্বাচিত বর্ষের ভর্তি অনুযায়ী ছাঁকে এবং বর্ষের শ্রেণি বসায় (শিক্ষাবর্ষ না থাকলে যেমন আছে তেমনই)
export const inYearStudents = (list, en) => (en.active ? (en.ids ? list.filter((s) => en.ids.has(s.id)).map((s) => ({ ...s, class_id: en.classOf[s.id] !== undefined ? en.classOf[s.id] : s.class_id })) : []) : list)
