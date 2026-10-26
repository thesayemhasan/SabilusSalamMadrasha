import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { configured } from '../../lib/supabase'
import { useAuth, useSite } from '../../lib/store'
import { ScrollToTop } from '../../components/ScrollTools'
import Icon from '../../components/Icon'
import { MODULES, MODULE_GROUPS, BUILT } from '../../lib/modules'
import { PATH_FEATURE } from '../../lib/features'

const MENU = [
  ['প্রধান', [['/admin', 'dashboard', 'ড্যাশবোর্ড', true], ['/admin/applications', 'clipboard', 'ভর্তির আবেদন'], ['/admin/messages', 'mail', 'যোগাযোগের বার্তা']]],
  ['ছাত্র ও হাজিরা', [['/admin/students', 'users', 'ছাত্র-ছাত্রী'], ['/admin/classes', 'books', 'শ্রেণি ও হালকা'], ['/admin/staff', 'teacher', 'শিক্ষক ও কর্মচারী'], ['/admin/attendance', 'clipboard', 'হাজিরা'], ['/admin/residence', 'building', 'আবাসিক/অনাবাসিক ধরন'], ['/admin/sessions', 'clock', 'হাজিরার সময়'], ['/admin/import', 'apply', 'এক্সেল ইম্পোর্ট']]],
  ['পরীক্ষা ও হিফজ', [['/admin/exams', 'clipboard', 'পরীক্ষা ও ফলাফল'], ['/admin/hifz', 'books', 'হিফজ ট্র্যাকিং'], ['/admin/idcards', 'users', 'আইডি কার্ড'], ['/admin/admit', 'clipboard', 'প্রবেশপত্র'], ['/admin/readmit', 'apply', 'পুনঃভর্তি ও ভর্তি ফরম']]],
  ['ফি ও হিসাব', [['/admin/fees', 'wallet', 'ফি আদায় ও রসিদ'], ['/admin/billing', 'clipboard', 'বিল তৈরি'], ['/admin/fee-setup', 'sliders', 'ফি-র ধরন ও পরিমাণ'], ['/admin/income', 'coins', 'দান ও অন্যান্য আয়'], ['/admin/expense', 'coins', 'ব্যয়'], ['/admin/salary', 'users', 'শিক্ষক-কর্মচারীর বেতন'], ['/admin/reports', 'chart', 'হিসাব ও রিপোর্ট'], ['/admin/account-setup', 'gear', 'খাত ও পেমেন্ট মাধ্যম'], ['/admin/audit', 'shield', 'আর্থিক লগ'], ['/admin/receipt-settings', 'printer', 'রসিদের লেখা ও ডিজাইন']]],
  ['ওয়েবসাইট', [['/admin/texts', 'edit', 'সাইটের লেখা'], ['/admin/slides', 'image', 'হোম স্লাইড'], ['/admin/departments', 'books', 'বিভাগসমূহ'], ['/admin/home-blocks', 'building', 'হোম সেকশন (নতুন রো)'], ['/admin/notices', 'megaphone', 'নোটিশ'], ['/admin/events', 'calendar', 'ইভেন্ট ও টাইমার'], ['/admin/gallery', 'video', 'গ্যালারি'], ['/admin/teachers', 'teacher', 'শিক্ষকবৃন্দ (পাবলিক)'], ['/admin/admission-form', 'apply', 'ভর্তি ফরম']]],
  ['সিস্টেম', [['/admin/modules', 'sliders', 'মডিউল সুইচ'], ['/admin/integrations', 'plug', 'মেশিন ও বাইরের সেবা'], ['/admin/settings', 'gear', 'সাইটের সেটিংস (হেডার, ফুটার…)'], ['/admin/users', 'users', 'ব্যবহারকারী ও অনুমতি']]],
]

const PATH_MOD = { '/admin/students': 'students', '/admin/classes': 'students', '/admin/staff': 'teachers', '/admin/attendance': 'attendance', '/admin/residence': 'students', '/admin/sessions': 'attendance', '/admin/fees': 'fees', '/admin/billing': 'fees', '/admin/fee-setup': 'fees', '/admin/income': 'accounts_basic', '/admin/expense': 'accounts_basic', '/admin/account-setup': 'accounts_basic', '/admin/salary': 'hr_payroll', '/admin/reports': 'reports', '/admin/audit': 'activity_log', '/admin/exams': 'exams', '/admin/hifz': 'hifz', '/admin/idcards': 'id_print', '/admin/admit': 'admit_card', '/admin/readmit': 'readmission' }

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
  const { session, profile, loading, isStaff, isSuper, can, signOut } = useAuth()
  const { settings, theme, setTheme, modules } = useSite()
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
  if (!isStaff) {
    return (
      <div className="login-wrap">
        <div className="card login-box">
          <h2>অ্যাক্সেস নেই</h2>
          <p>{profile ? 'এই অ্যাকাউন্টে অ্যাডমিন প্যানেলের অনুমতি নেই। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' : 'প্রোফাইল পাওয়া যায়নি। schema.sql চালানো হয়েছে কিনা দেখুন।'}</p>
          <button className="btn outline" onClick={signOut}>লগআউট</button>
        </div>
      </div>
    )
  }

  const seg = pathname.replace(/\/$/, '')
  const featKey = PATH_FEATURE[seg] || (seg.startsWith('/admin/m/') ? PATH_FEATURE['/admin/m'] : null)
  const allowed = seg === '/admin/users' ? isSuper : !featKey || can(featKey)

  return (
    <div className="adm">
      <ScrollToTop />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`adm-side ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src={settings.logo_url} alt="" style={{ background: '#fff', borderRadius: '50%', padding: 2 }} />
          <span>অ্যাডমিন প্যানেল</span>
        </div>
        {MENU.map(([title, items]) => [title, items.filter(([to]) => (to === '/admin/users' ? isSuper : !PATH_FEATURE[to] || can(PATH_FEATURE[to])) && modules[PATH_MOD[to]] !== false)]).filter(([, items]) => items.length > 0).map(([title, items]) => (
          <div key={title}>
            <h5>{title}</h5>
            {items.map(([to, ic, label, end]) => (
              <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="ic"><Icon name={ic} size={20} cls="cur" /></span>{label}
              </NavLink>
            ))}
          </div>
        ))}
        {can('modules') && <h5>ম্যানেজমেন্ট মডিউল</h5>}
        {can('modules') && MODULE_GROUPS.map((g) => (
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
          {allowed ? <Outlet /> : (
            <div className="card center" style={{ padding: 28 }}>
              <h2>এই পেজের অনুমতি নেই</h2>
              <p className="muted">সুপার অ্যাডমিন আপনাকে এই ফিচারটি চালু করে দিলে এখানে কাজ করতে পারবেন।</p>
              <Link to="/admin" className="btn">ড্যাশবোর্ডে ফিরুন</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
