import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LANGS } from '../lib/texts'
import { useAuth, useSite } from '../lib/store'
import { isExternal, menuOf } from '../lib/util'
import Icon from './Icon'
import Socials from './Socials'
import { BackToTop, ScrollToTop } from './ScrollTools'

// লোগোতে ক্লিক করলে পেইজ রিফ্রেশ
const refresh = (e) => { e.preventDefault(); window.location.hash = '#/'; window.location.reload() }

function MenuLink({ m, label, onClick }) {
  if (isExternal(m.to)) return <a href={m.to} target="_blank" rel="noreferrer" onClick={onClick}>{label}</a>
  return <NavLink to={m.to} end={m.to === '/'} onClick={onClick} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
}

export default function PublicLayout() {
  const { t, lang, setLang, settings, theme, setTheme } = useSite()
  const { session, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  const menu = menuOf(settings).filter((m) => m.show !== false)
  const labelOf = (m) => (lang === 'en' ? m.label_en : m.label_bn) || (m.key ? t(m.key) : m.label_bn || m.label_en || m.to)
  const topText = t('header.text') || (settings.phone ? settings.phone : t('site.tagline'))
  const initial = (profile?.full_name || profile?.email || session?.user?.email || '?').trim().charAt(0).toUpperCase()
  const footLinks = menu.filter((m) => m.to !== '/').slice(0, 7)

  return (
    <>
      <ScrollToTop />
      <div className="topbar">
        <div className="container">
          <div className="top-info">
            {!t('header.text') && settings.phone ? <a href={`tel:${settings.phone}`}><Icon name="phone" size={15} cls="cur" />{settings.phone}</a> : <span>{topText}</span>}
          </div>
          <div className="top-right">
            <div className="langs">
              {LANGS.map((l) => (
                <button key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code)}>{l.code === 'bn' ? 'বাং' : 'EN'}</button>
              ))}
            </div>
            <button className="theme-btn" type="button" aria-label="theme" title={theme === 'dark' ? 'Light' : 'Dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <span className="theme-ic" key={theme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} cls="cur" /></span>
            </button>
            {session ? (
              <Link to="/account" title={t('nav.account')}><span className="avatar">{initial}</span></Link>
            ) : settings.header_show_signup !== false && settings.signup_enabled !== false ? (
              <>
                <Link to="/account" className="top-login" title={t('nav.login')}><Icon name="user" size={16} cls="cur" /><span>{t('nav.login')}</span></Link>
                <Link to="/account?tab=signup" className="top-signup">{t('nav.signup')}</Link>
              </>
            ) : (
              <Link to="/account" className="top-login" title={t('nav.login')}><Icon name="user" size={16} cls="cur" /><span>{t('nav.login')}</span></Link>
            )}
          </div>
        </div>
      </div>

      <header className="header">
        <div className="container">
          <a href="#/" className="brand" onClick={refresh}>
            <img src={settings.logo_url} alt="logo" />
            <span>{t('site.short')}</span>
          </a>
          <nav className="nav">
            {menu.map((m, i) => <MenuLink key={i} m={m} label={labelOf(m)} />)}
            <Link to="/admission" className="btn small pink nav-cta">{t('apply.btn')}</Link>
          </nav>
          <button className={`menu-btn ${open ? 'x' : ''}`} aria-label="menu" onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
        <div className={`mobile-nav ${open ? 'open' : ''}`}>
          <div className="mobile-nav-in">
            {menu.map((m, i) => <MenuLink key={i} m={m} label={labelOf(m)} onClick={() => setOpen(false)} />)}
            <Link to="/admission" className="btn pink" onClick={() => setOpen(false)}>{t('apply.btn')}</Link>
          </div>
        </div>
      </header>

      <main key={pathname} className="page-in">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="cols">
            <div>
              <a href="#/" className="brand f-brand" onClick={refresh}>
                <img src={settings.logo_url} alt="" />
                <span>{t('site.name')}</span>
              </a>
              <p>{t('footer.about')}</p>
              <Socials items={[...(settings.facebook ? [{ type: 'facebook', url: settings.facebook }] : []), ...(settings.youtube ? [{ type: 'youtube', url: settings.youtube }] : []), ...(settings.socials || [])]} size={19} cls="foot-soc" />
            </div>
            <div>
              <h4>{t('footer.links')}</h4>
              <ul>
                {footLinks.map((m, i) => <li key={i}><MenuLink m={m} label={labelOf(m)} /></li>)}
              </ul>
            </div>
            <div>
              <h4>{t('footer.contact')}</h4>
              <ul>
                <li><Icon name="pin" size={16} cls="cur" /><span className="ft">{t('site.address')}</span></li>
                {settings.phone && <li><Icon name="phone" size={16} cls="cur" /><span className="ft"><a href={`tel:${settings.phone}`}>{settings.phone}</a></span></li>}
                {settings.email && <li><Icon name="mail" size={16} cls="cur" /><span className="ft"><a href={`mailto:${settings.email}`}>{settings.email}</a></span></li>}
              </ul>
            </div>
          </div>
          <div className="copy">
            <div className="copy-l">
              <span>© {new Date().getFullYear()} {t('site.name')}. {t('footer.rights')}</span>
              <span className="legal"><Link to="/privacy">{t('nav.privacy')}</Link><i /><Link to="/terms">{t('nav.terms')}</Link></span>
            </div>
            {settings.dev_show !== false && settings.dev_name && (
              <div className="dev">
                {settings.dev_photo && <img src={settings.dev_photo} alt="" />}
                <div className="dev-t"><small>{t('footer.dev')}</small><b>{settings.dev_name}</b>{settings.dev_role && <em>{settings.dev_role}</em>}</div>
                <Socials items={settings.dev_socials} size={15} cls="dev-soc" />
              </div>
            )}
          </div>
        </div>
      </footer>
      <BackToTop />
    </>
  )
}
