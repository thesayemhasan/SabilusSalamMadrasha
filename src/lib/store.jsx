import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, configured } from './supabase'
import { DEFAULTS, LANGS } from './texts'

const SiteCtx = createContext(null)
const AuthCtx = createContext(null)

export const DEFAULT_SETTINGS = {
  logo_url: './logo.png',
  phone: '',
  email: '',
  whatsapp: '',
  facebook: '',
  youtube: '',
  map_embed: '',
  hero_image: '',
  color_primary: '#16a34a',
  color_secondary: '#e0158a',
  color_accent: '#1f2a7a',
  // হেডার ও মেনু
  header_show: true,
  header_lang: true,
  header_show_signup: true,
  menu: null,
  // হোম
  apply_open: true,
  apply_link: '/admission',
  hero_mode: 'custom', // 'custom' = নিজস্ব স্লাইডের ছবি, 'gallery' = গ্যালারির ছবি
  hero_brand_slide: true,
  hero_interval: 5,
  urgent_show: true,
  urgent_count: 6,
  quick_show: true,
  stats_show: true,
  why_show: true,
  depts_show: true,
  contact_show: true,
  cta_show: true,
  // অ্যাকাউন্ট ও ভর্তি
  signup_enabled: true,
  admission_agree: true,
  // ফুটার ও ডেভেলপার
  footer_show_links: true,
  socials: [],
  dev_show: true,
  dev_name: '',
  dev_role: '',
  dev_photo: '',
  dev_socials: [],
}

const readTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function SiteProvider({ children }) {
  const [lang, setLangState] = useState(() => { const l = localStorage.getItem('lang'); return LANGS.some((x) => x.code === l) ? l : 'bn' })
  const [overrides, setOverrides] = useState({})
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [modules, setModules] = useState({})
  const [ready, setReady] = useState(!configured)
  const [theme, setThemeState] = useState(readTheme)

  const load = useCallback(async () => {
    if (!supabase) return
    const [tx, st, md] = await Promise.all([
      supabase.from('site_texts').select('*'),
      supabase.from('site_settings').select('*'),
      supabase.from('modules').select('*'),
    ])
    if (tx.data) {
      const o = {}
      tx.data.forEach((r) => (o[r.key] = r))
      setOverrides(o)
    }
    if (st.data) {
      const inst = st.data.find((r) => r.key === 'institute')
      if (inst) setSettings({ ...DEFAULT_SETTINGS, ...inst.value })
    }
    if (md.data) {
      const m = {}
      md.data.forEach((r) => (m[r.key] = r.enabled))
      setModules(m)
    }
    setReady(true)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const l = LANGS.find((x) => x.code === lang) || LANGS[0]
    document.documentElement.lang = l.code
    document.documentElement.dir = l.dir
    localStorage.setItem('lang', l.code)
  }, [lang])

  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--primary', settings.color_primary)
    r.setProperty('--secondary', settings.color_secondary)
    r.setProperty('--accent', settings.color_accent)
  }, [settings])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* ব্রাউজার না দিলে সমস্যা নেই */ }
    const m = document.querySelector('meta[name="theme-color"]')
    if (m) m.setAttribute('content', theme === 'dark' ? '#0d1511' : '#16a34a')
  }, [theme])
  const setTheme = useCallback((v) => setThemeState(v === 'dark' ? 'dark' : 'light'), [])
  const toggleTheme = useCallback(() => setThemeState((x) => (x === 'dark' ? 'light' : 'dark')), [])

  const t = useCallback(
    (key) => {
      const o = overrides[key]
      const d = DEFAULTS[key]
      if (o && o[lang]) return o[lang]
      if (d && d[lang]) return d[lang]
      const fb = (o && o.bn) || (d && d.bn)
      if (fb) return fb
      return d ? '' : key
    },
    [overrides, lang]
  )

  const value = useMemo(
    () => ({ lang, setLang: setLangState, t, settings, modules, overrides, ready, reload: load, theme, setTheme, toggleTheme }),
    [lang, t, settings, modules, overrides, ready, load, theme, setTheme, toggleTheme]
  )
  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>
}
export const useSite = () => useContext(SiteCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  const loadProfile = useCallback(async (uid) => {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data || null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      loadProfile(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()
  const signUp = (email, password, full_name) => supabase.auth.signUp({ email, password, options: { data: { full_name } } })
  const resetPassword = (email) => (supabase.auth.resetPasswordForEmail ? supabase.auth.resetPasswordForEmail(email) : Promise.resolve({ error: null }))
  const changePassword = (password) => (supabase.auth.updateUser ? supabase.auth.updateUser({ password }) : Promise.resolve({ error: null }))
  const isAdmin = Boolean(profile && ['super_admin', 'admin'].includes(profile.role))
  const isSuper = Boolean(profile && profile.role === 'super_admin')
  const isFinance = Boolean(profile && ['super_admin', 'admin', 'accountant'].includes(profile.role))
  const isAccountant = Boolean(profile && profile.role === 'accountant')

  return (
    <AuthCtx.Provider value={{ session, profile, loading, signIn, signOut, signUp, resetPassword, changePassword, isAdmin, isSuper, isFinance, isAccountant }}>
      {children}
    </AuthCtx.Provider>
  )
}
export const useAuth = () => useContext(AuthCtx)

// ছোট ডেটা-ফেচ হুক (পাবলিক পেইজের জন্য)
export function useRows(table, { order = 'created_at', asc = false, limit } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(Boolean(supabase))
  useEffect(() => {
    if (!supabase) return
    let q = supabase.from(table).select('*').order(order, { ascending: asc })
    if (limit) q = q.limit(limit)
    q.then(({ data }) => {
      // অ্যাডমিন লগইন থাকলে RLS সব সারি পাঠায়; পাবলিক সাইটে শুধু প্রকাশিতগুলো দেখাই
      setRows((data || []).filter((r) => r.published !== false))
      setLoading(false)
    })
  }, [table, order, asc, limit])
  return { rows, loading }
}

// i18n কলাম থেকে বর্তমান ভাষার মান (খালি হলে বাংলা)
export function pick(row, field, lang) {
  return row[`${field}_${lang}`] || row[`${field}_bn`] || row[`${field}_en`] || ''
}

// বিভাগ: ডেটাবেস থেকে; টেবিল না থাকলে (স্কিমা এখনো চালানো হয়নি) ডিফল্ট তিনটি
const DEFAULT_DEPTS = [
  { id: 'd1', icon: 'book', k: 'dept.hifz' },
  { id: 'd2', icon: 'books', k: 'dept.qawmi' },
  { id: 'd3', icon: 'lotus', k: 'dept.women' },
]
export function useDepartments() {
  const { t, lang } = useSite()
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!supabase) return
    supabase.from('departments').select('*').order('sort', { ascending: true }).then(({ data, error }) => {
      if (!error && data) setRows(data.filter((r) => r.published !== false))
    })
  }, [])
  const list = rows
    ? rows.map((r) => ({ id: r.id, icon: r.icon || 'book', title: pick(r, 'name', lang), text: pick(r, 'text', lang) }))
    : DEFAULT_DEPTS.map((d) => ({ id: d.id, icon: d.icon, title: t(d.k + '.title'), text: t(d.k + '.text') }))
  return { list, fromDb: rows !== null }
}
