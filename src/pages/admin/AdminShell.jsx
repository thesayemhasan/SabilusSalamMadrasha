import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { configured } from '../../lib/supabase'
import { useAuth, useSite } from '../../lib/store'
import { ScrollToTop } from '../../components/ScrollTools'
import Icon from '../../components/Icon'
import { MODULES, MODULE_GROUPS, BUILT } from '../../lib/modules'

const MENU = [
  ['প্রধান', [['/admin', 'dashboard', 'ড্যাশবোর্ড', true], ['/admin/applications', 'clipboard', 'ভর্তির আবেদন'], ['/admin/messages', 'mail', 'যোগাযোগের বার্তা']]],
  ['ওয়েবসাইট', [['/admin/texts', 'edit', 'সাইটের লেখা'], ['/admin/slides', 'image', 'হোম স্লাইড'], ['/admin/departments', 'books', 'বিভাগসমূহ'], ['/admin/home-blocks', 'building', 'হোম সেকশন (নতুন রো)'], ['/admin/notices', 'megaphone', 'নোটিশ'], ['/admin/events', 'calendar', 'ইভেন্ট ও টাইমার'], ['/admin/gallery', 'video', 'গ্যালারি'], ['/admin/teachers', 'teacher', 'শিক্ষকবৃন্দ (পাবলিক)'], ['/admin/admission-form', 'apply', 'ভর্তি ফরম']]],
  ['সিস্টেম', [['/admin/modules', 'sliders', 'মডিউল সুইচ'], ['/admin/integrations', 'plug', 'মেশিন ও বাইরের সেবা'], ['/admin/settings', 'gear', 'সাইটের সেটিংস (হেডার, ফুটার…)'], ['/admin/users', 'users', 'ব্যবহারকারী ও অনুমতি']]],
]

function Login() {
  const { signIn } = useAuth()
  const { settings } = useSite()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await signIn(email, pw)
    setBusy(false)
    if (error) setErr(`লগইন হয়নি: ${error.message}`)
  }

  return (
    <div className="login-wrap">
      <form className="card form login-box" onSubmit={submit}>
        <div className="center">
          <img src={settings.logo_url} alt="" style={{ width: 84, height: 84, margin: '0 auto 8px', objectFit: 'contain' }} />
          <h2 style={{ marginBottom: 2 }}>অ্যাডমিন লগইন</h2>
          <div className="muted">সাবিলুস সালাম মাদরাসা</div>
        </div>
        <div className="field"><label>ইমেইল</label><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>পাসওয়ার্ড</label><input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <div className="alert err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'প্রবেশ করুন'}</button>
        <Link to="/" className="center muted">← ওয়েবসাইটে ফিরুন</Link>
      </form>
    </div>
  )
}

export default function AdminShell() {
  const { session, profile, loading, isAdmin, signOut } = useAuth()
  const { settings, theme, setTheme } = useSite()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])

  if (!configured) {
    return (
      <div className="login-wrap">
        <div className="card login-box">
          <h2>Supabase সংযুক্ত নয়</h2>
          <p>অ্যাডমিন প্যানেল চালাতে .env ফাইলে (বা GitHub Secrets এ) VITE_SUPABASE_URL ও VITE_SUPABASE_ANON_KEY বসাতে হবে। README ফাইলে ধাপগুলো দেওয়া আছে।</p>
          <Link to="/" className="btn">ওয়েবসাইটে ফিরুন</Link>
        </div>
      </div>
    )
  }
  if (loading) return <div className="login-wrap"><p>লোড হচ্ছে…</p></div>
  if (!session) return <Login />
  if (!isAdmin) {
    return (
      <div className="login-wrap">
        <div className="card login-box">
          <h2>অ্যাক্সেস নেই</h2>
          <p>{profile ? 'আপনার অ্যাকাউন্টে এখনো অ্যাডমিন অনুমতি দেওয়া হয়নি। সুপার অ্যাডমিনকে বলুন আপনার ভূমিকা ঠিক করে দিতে।' : 'প্রোফাইল পাওয়া যায়নি। schema.sql চালানো হয়েছে কিনা দেখুন।'}</p>
          <button className="btn outline" onClick={signOut}>লগআউট</button>
        </div>
      </div>
    )
  }

  return (
    <div className="adm">
      <ScrollToTop />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`adm-side ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src={settings.logo_url} alt="" style={{ background: '#fff', borderRadius: '50%', padding: 2 }} />
          <span>অ্যাডমিন প্যানেল</span>
        </div>
        {MENU.map(([title, items]) => (
          <div key={title}>
            <h5>{title}</h5>
            {items.map(([to, ic, label, end]) => (
              <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="ic"><Icon name={ic} size={20} cls="cur" /></span>{label}
              </NavLink>
            ))}
          </div>
        ))}
        <h5>ম্যানেজমেন্ট মডিউল</h5>
        {MODULE_GROUPS.map((g) => (
          <details key={g.id} style={{ margin: '2px 0' }}>
            <summary style={{ cursor: 'pointer', padding: '8px 12px', fontSize: '.95rem' }}>{g.label}</summary>
            {MODULES.filter((m) => m.group === g.id).map((m) => (
              <NavLink key={m.key} to={`/admin/m/${m.key}`} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')} style={{ paddingInlineStart: 28, fontSize: '.9rem' }}>
                {m.name}
                <span className="tag" style={{ marginInlineStart: 'auto' }}>{BUILT.has(m.key) ? 'তৈরি' : `ধাপ ${m.step}`}</span>
              </NavLink>
            ))}
          </details>
        ))}
        <h5>অন্যান্য</h5>
        <Link to="/"><span className="ic"><Icon name="globe" size={20} cls="cur" /></span>ওয়েবসাইট দেখুন</Link>
      </aside>
      <div className="adm-main">
        <div className="adm-top">
          <button className="menu-btn" onClick={() => setOpen(true)}><Icon name="menu" size={22} /></button>
          <span className="muted grow" style={{ fontSize: '.9rem' }}>{profile.full_name || profile.email}</span>
          <button type="button" className="theme-btn solid" aria-label="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <span key={theme} className="theme-ic"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} cls="cur" /></span>
          </button>
          <button className="btn small outline" onClick={signOut}><Icon name="logout" size={15} cls="cur" /> লগআউট</button>
        </div>
        <div className="adm-body">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
