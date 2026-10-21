import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LANGS } from '../lib/texts'
import { useSite } from '../lib/store'

const NAV = [
  ['/', 'nav.home'],
  ['/about', 'nav.about'],
  ['/departments', 'nav.departments'],
  ['/admission', 'nav.admission'],
  ['/notices', 'nav.notices'],
  ['/events', 'nav.events'],
  ['/gallery', 'nav.gallery'],
  ['/teachers', 'nav.teachers'],
  ['/donate', 'nav.donate'],
  ['/contact', 'nav.contact'],
]

export default function PublicLayout() {
  const { t, lang, setLang, settings } = useSite()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <>
      <div className="topbar">
        <div className="container">
          <div className="top-info">
            {settings.phone && <a href={`tel:${settings.phone}`}>☎ {settings.phone}</a>}
            {settings.email && <a href={`mailto:${settings.email}`}>✉ {settings.email}</a>}
            {!settings.phone && !settings.email && <span>{t('site.tagline')}</span>}
          </div>
          <div className="top-right">
            {settings.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a>}
            {settings.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer">YouTube</a>}
            <Link to="/admin">{t('nav.login')}</Link>
            <div className="langs">
              {LANGS.map((l) => (
                <button key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <header className="header">
        <div className="container">
          <Link to="/" className="brand" onClick={() => setOpen(false)}>
            <img src={settings.logo_url} alt="logo" />
            <span>{t('site.short')}</span>
          </Link>
          <nav className="nav">
            {NAV.map(([to, key]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {t(key)}
              </NavLink>
            ))}
            <Link to="/admission" className="btn small pink nav-cta">{t('apply.btn')}</Link>
          </nav>
          <button className="menu-btn" aria-label="menu" onClick={() => setOpen(!open)}>
            {open ? '✕' : '☰'}
          </button>
        </div>
        {open && (
          <nav className="mobile-nav">
            {NAV.map(([to, key]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
                {t(key)}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main key={pathname} className="page-in">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="cols">
            <div>
              <div className="brand" style={{ color: '#fff', marginBottom: 10 }}>
                <img src={settings.logo_url} alt="" style={{ background: '#fff', borderRadius: '50%', padding: 3 }} />
                <span>{t('site.name')}</span>
              </div>
              <p>{t('footer.about')}</p>
            </div>
            <div>
              <h4>{t('footer.links')}</h4>
              <ul>
                {NAV.slice(1, 6).map(([to, key]) => (
                  <li key={to}><Link to={to}>{t(key)}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{t('footer.contact')}</h4>
              <ul>
                <li>📍 {t('site.address')}</li>
                {settings.phone && <li>☎ {settings.phone}</li>}
                {settings.email && <li>✉ {settings.email}</li>}
                {settings.facebook && <li><a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a></li>}
                {settings.youtube && <li><a href={settings.youtube} target="_blank" rel="noreferrer">YouTube</a></li>}
              </ul>
            </div>
          </div>
          <div className="copy">
            © {new Date().getFullYear()} {t('site.name')}. {t('footer.rights')}{' '}
            <Link to="/admin" style={{ opacity: 0.6 }}>· {t('nav.login')}</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
