import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useSite } from '../../lib/store'
import Icon from '../../components/Icon'

const ROLE_BN = { none: 'সাধারণ সদস্য', super_admin: 'সুপার অ্যাডমিন', admin: 'অ্যাডমিন', accountant: 'হিসাবরক্ষক', teacher: 'শিক্ষক', parent: 'অভিভাবক' }

function PwField({ label, value, onChange, auto }) {
  const [show, setShow] = useState(false)
  return (
    <div className="field">
      <label>{label}</label>
      <div className="pw">
        <input type={show ? 'text' : 'password'} required autoComplete={auto} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" aria-label="show" onClick={() => setShow(!show)}><Icon name={show ? 'eyeoff' : 'eye'} size={19} cls="cur" /></button>
      </div>
    </div>
  )
}

function Profile() {
  const { t, lang } = useSite()
  const { session, profile, signOut, isAdmin, changePassword } = useAuth()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const nav = useNavigate()
  const name = profile?.full_name || session?.user?.user_metadata?.full_name || ''
  const email = profile?.email || session?.user?.email
  async function savePw(e) {
    e.preventDefault()
    setMsg('')
    if (pw.length < 6) return setMsg(t('auth.err.short'))
    const { error } = await changePassword(pw)
    setMsg(error ? error.message : t('auth.pw.saved'))
    if (!error) setPw('')
  }
  return (
    <div className="acc-wrap" style={{ margin: '0 auto' }}><div className="acc-card card">
      <div className="acc-head">
        <span className="avatar big">{(name || email || '?').trim().charAt(0).toUpperCase()}</span>
        <div><h2 style={{ margin: 0 }}>{name || email}</h2><div className="muted">{email}</div></div>
      </div>
      <div className="acc-status"><small>{t('auth.status')}</small><b>{lang === 'bn' ? ROLE_BN[profile?.role || 'none'] : (profile?.role || 'member').replace('_', ' ')}</b></div>
      {!isAdmin && (!profile || profile.role === 'none') && <div className="alert info pre">{t('auth.status.none')}</div>}
      {isAdmin && <button type="button" className="btn" onClick={() => nav('/admin')}><Icon name="dashboard" size={18} cls="cur" /> {t('auth.admin.btn')}</button>}
      <form className="form" onSubmit={savePw} style={{ marginTop: 18 }}>
        <PwField label={t('auth.pw.change')} value={pw} onChange={setPw} auto="new-password" />
        {msg && <div className="alert info">{msg}</div>}
        <button className="btn outline">{t('auth.pw.change')}</button>
      </form>
      <button type="button" className="btn danger" onClick={signOut}><Icon name="logout" size={18} cls="cur" /> {t('auth.logout')}</button>
    </div></div>
  )
}

export function Account() {
  const { t, settings } = useSite()
  const { session, loading, signIn, signUp, resetPassword } = useAuth()
  const initial = (window.location.hash.split('?')[1] || '').includes('tab=signup') ? 'signup' : 'login'
  const [tab, setTab] = useState(initial)
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' })
  const [msg, setMsg] = useState({ k: '', t: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v }))
  const canSignup = settings.signup_enabled !== false

  if (loading) return <section className="section"><div className="container center muted">{t('common.loading')}</div></section>
  if (session) return <section className="section"><div className="container"><Profile /></div></section>

  async function submit(e) {
    e.preventDefault()
    setMsg({ k: '', t: '' })
    setBusy(true)
    if (tab === 'login') {
      const { error } = await signIn(f.email, f.pw)
      if (error) setMsg({ k: 'err', t: t('auth.err.login') })
    } else {
      if (f.pw.length < 6) setMsg({ k: 'err', t: t('auth.err.short') })
      else if (f.pw !== f.pw2) setMsg({ k: 'err', t: t('auth.err.match') })
      else {
        const { error } = await signUp(f.email, f.pw, f.name)
        if (error) setMsg({ k: 'err', t: error.message })
        else { setMsg({ k: 'ok', t: t('auth.signup.done') }); setTab('login') }
      }
    }
    setBusy(false)
  }
  async function forgot() {
    if (!f.email) return setMsg({ k: 'err', t: t('auth.email') + ' *' })
    await resetPassword(f.email)
    setMsg({ k: 'ok', t: t('auth.forgot.sent') })
  }

  return (
    <section className="section">
      <div className="container">
        <div className="acc-wrap" style={{ margin: '0 auto' }}><div className="acc-card card">
          {canSignup && (
            <div className="seg">
              <button type="button" className={tab === 'login' ? 'on' : ''} onClick={() => { setTab('login'); setMsg({ k: '', t: '' }) }}>{t('nav.login')}</button>
              <button type="button" className={tab === 'signup' ? 'on' : ''} onClick={() => { setTab('signup'); setMsg({ k: '', t: '' }) }}>{t('nav.signup')}</button>
            </div>
          )}
          <h2 className="center">{tab === 'login' ? t('auth.login.title') : t('auth.signup.title')}</h2>
          {tab === 'signup' && <p className="muted center pre" style={{ margin: 0 }}>{t('auth.intro')}</p>}
          {tab === 'signup' && !canSignup ? <div className="alert warn">{t('auth.signup.closed')}</div> : (
            <form className="form" onSubmit={submit}>
              {tab === 'signup' && <div className="field"><label>{t('auth.name')}</label><input required value={f.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" /></div>}
              <div className="field"><label>{t('auth.email')}</label><input type="email" required autoComplete="username" value={f.email} onChange={(e) => set('email')(e.target.value)} /></div>
              <PwField label={t('auth.password')} value={f.pw} onChange={set('pw')} auto={tab === 'login' ? 'current-password' : 'new-password'} />
              {tab === 'signup' && <PwField label={t('auth.password2')} value={f.pw2} onChange={set('pw2')} auto="new-password" />}
              {msg.t && <div className={`alert ${msg.k}`}>{msg.t}</div>}
              <button className="btn" disabled={busy}>{busy ? t('form.sending') : tab === 'login' ? t('auth.login.btn') : t('auth.signup.btn')}</button>
              {tab === 'login' && <button type="button" className="btn outline small" onClick={forgot}>{t('auth.forgot')}</button>}
            </form>
          )}
          <p className="center muted" style={{ margin: 0, fontSize: '.88rem' }}>
            <Link to="/terms">{t('nav.terms')}</Link> · <Link to="/privacy">{t('nav.privacy')}</Link>
          </p>
        </div></div>
      </div>
    </section>
  )
}
