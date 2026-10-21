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
  principal_photo: '',
  show_message: false,
  apply_open: true,
  color_primary: '#16a34a',
  color_secondary: '#e0158a',
  color_accent: '#1f2a7a',
}

export function SiteProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'bn')
  const [overrides, setOverrides] = useState({})
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [modules, setModules] = useState({})
  const [ready, setReady] = useState(!configured)

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

  const t = useCallback(
    (key) => {
      const o = overrides[key]
      const d = DEFAULTS[key]
      if (o && o[lang]) return o[lang]
      if (d && d[lang]) return d[lang]
      return (o && o.bn) || (d && d.bn) || key
    },
    [overrides, lang]
  )

  const value = useMemo(
    () => ({ lang, setLang: setLangState, t, settings, modules, overrides, ready, reload: load }),
    [lang, t, settings, modules, overrides, ready, load]
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
  const isAdmin = profile && ['super_admin', 'admin'].includes(profile.role)
  const isSuper = profile && profile.role === 'super_admin'

  return (
    <AuthCtx.Provider value={{ session, profile, loading, signIn, signOut, isAdmin, isSuper }}>
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
      setRows(data || [])
      setLoading(false)
    })
  }, [table, order, asc, limit])
  return { rows, loading }
}

// i18n কলাম থেকে বর্তমান ভাষার মান (খালি হলে বাংলা)
export function pick(row, field, lang) {
  return row[`${field}_${lang}`] || row[`${field}_bn`] || row[`${field}_en`] || ''
}
