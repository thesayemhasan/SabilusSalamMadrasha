import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRows, useSite, useDepartments, pick } from '../../lib/store'
import { dig, fmtDate } from '../../lib/util'
import Icon from '../../components/Icon'
import SmartLink from '../../components/SmartLink'
import Countdown from '../../components/Countdown'
import SecTitle from '../../components/SecTitle'

export const eventEnd = (e) => e.end_at || e.start_at || `${e.event_date}T23:59:59`
export const isUpcoming = (e) => new Date(eventEnd(e)).getTime() >= Date.now()

/* ---------- অ্যাডমিনের যোগ করা অতিরিক্ত রো ---------- */
export function Block({ b }) {
  const { lang } = useSite()
  const title = pick(b, 'title', lang)
  const body = pick(b, 'body', lang)
  const btn = pick(b, 'btn', lang)
  if (b.kind === 'announce') {
    return (
      <section className="container block-wrap">
        <div className="apply-bar">
          <div>
            <div className="apply-title"><Icon name="bell" size={22} /> <b>{title}</b></div>
            {body && <div className="muted">{body}</div>}
          </div>
          {btn && b.link && <SmartLink to={b.link} className="btn">{btn} <Icon name="arrowright" size={16} cls="cur" /></SmartLink>}
        </div>
      </section>
    )
  }
  if (b.kind === 'cards') {
    const items = Array.isArray(b.items) ? b.items : []
    return (
      <section className="section">
        <div className="container">
          {title && <SecTitle>{title}</SecTitle>}
          {body && <p className="center muted sec-sub">{body}</p>}
          <div className="grid g3" style={{ marginTop: 22 }}>
            {items.map((it, i) => (
              <div className="card feature" key={i}>
                <div className="ico"><Icon name={it.icon || 'star'} size={28} /></div>
                <h3>{pick(it, 'title', lang)}</h3>
                <p className="muted">{pick(it, 'text', lang)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }
  if (b.kind === 'image_text') {
    return (
      <section className="section">
        <div className="container split">
          {b.image_url && <div className="split-img"><img src={b.image_url} alt="" loading="lazy" /></div>}
          <div className="split-tx">
            {title && <h2>{title}</h2>}
            <p className="pre">{body}</p>
            {btn && b.link && <SmartLink to={b.link} className="btn">{btn}</SmartLink>}
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 820 }}>
        {title && <SecTitle>{title}</SecTitle>}
        <p className="pre" style={{ marginTop: 14 }}>{body}</p>
        {btn && b.link && <p className="center"><SmartLink to={b.link} className="btn">{btn}</SmartLink></p>}
      </div>
    </section>
  )
}

/* ---------- হিরো স্লাইডার (১২০০×৬০০) ---------- */
function Hero({ items }) {
  const { t, lang, settings } = useSite()
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const x0 = useRef(null)
  const moved = useRef(false)
  const n = items.length
  const go = (k) => setI((k + n) % n)
  useEffect(() => { if (i >= n) setI(0) }, [n, i])
  useEffect(() => {
    if (n < 2 || hold) return
    const id = setInterval(() => setI((v) => (v + 1) % n), 6000)
    return () => clearInterval(id)
  }, [n, hold, i])

  const heroStyle = settings.hero_image
    ? { backgroundImage: `linear-gradient(135deg, rgba(14,122,55,.88), rgba(31,42,122,.85)), url(${settings.hero_image})` }
    : undefined

  return (
    <section
      className="hero-slider"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onPointerDown={(e) => { x0.current = e.clientX; moved.current = false; setHold(true) }}
      onPointerUp={(e) => {
        const dx = e.clientX - (x0.current ?? e.clientX)
        if (n > 1 && Math.abs(dx) > 45) { moved.current = true; go(i + (dx < 0 ? 1 : -1)) }
        x0.current = null
        setHold(false)
      }}
      onPointerCancel={() => { x0.current = null; setHold(false) }}
      onClickCapture={(e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false } }}
    >
      {items.map((it, k) => {
        const active = k === i
        if (it.brand) {
          return (
            <div key="brand" className={`hslide brand ${active ? 'active' : ''}`} style={heroStyle} aria-hidden={!active}>
              <div className="container brand-grid">
                <div className="brand-text">
                  <span className="badge">{t('site.established')}</span>
                  <h1>{t('hero.title')}</h1>
                  <p>{t('hero.subtitle')}</p>
                  <div className="actions">
                    <Link to="/admission" className="btn pink">{t('hero.cta1')}</Link>
                    <Link to="/contact" className="btn light">{t('hero.cta2')}</Link>
                  </div>
                </div>
                <img className="logo-big" src={settings.logo_url} alt="" />
              </div>
            </div>
          )
        }
        const cap = pick(it, 'title', lang)
        const sub = pick(it, 'sub', lang)
        const inner = (
          <>
            <img src={it.image_url} alt={cap} loading={k < 2 ? 'eager' : 'lazy'} draggable="false" />
            {(cap || sub) && (
              <div className="cap"><div>
                <b>{cap}</b>
                {sub && <span>{sub}</span>}
              </div></div>
            )}
          </>
        )
        return (
          <div key={it.id || k} className={`hslide img ${active ? 'active' : ''}`} aria-hidden={!active}>
            {it.link ? <SmartLink to={it.link} className="himg-link" tabIndex={active ? 0 : -1}>{inner}</SmartLink> : inner}
          </div>
        )
      })}
      {n > 1 && (
        <>
          <div className="slider-dots">
            {items.map((_, k) => <button type="button" key={k} aria-label={String(k + 1)} className={k === i ? 'on' : ''} onClick={() => go(k)} />)}
          </div>
        </>
      )}
    </section>
  )
}

/* ---------- জরুরি নোটিশ বোর্ড (স্লাইডের নিচে ভাসমান) ---------- */
function Urgent({ notices }) {
  const { t, lang } = useSite()
  const [i, setI] = useState(0)
  const n = notices.length
  useEffect(() => {
    if (n < 2) return
    const id = setInterval(() => setI((v) => (v + 1) % n), 4800)
    return () => clearInterval(id)
  }, [n])
  if (!n) return null
  const cur = notices[i % n]
  return (
    <div className="container urgent-wrap">
      <div className="urgent">
        <span className="u-label"><Icon name="bell" size={18} cls="cur" /> {t('urgent.title')}</span>
        <Link to="/notices" className="u-item" key={cur.id}>
          <small>{fmtDate(cur.date, lang)}</small>
          <b>{pick(cur, 'title', lang)}</b>
        </Link>
        <Link to="/notices" className="u-more">{n > 1 ? `${dig(i % n + 1, lang)}/${dig(n, lang)} · ` : ''}{t('common.viewAll')} <Icon name="arrowright" size={15} cls="cur" /></Link>
      </div>
    </div>
  )
}

export function Home() {
  const { t, lang, settings } = useSite()
  const notices = useRows('notices', { order: 'date', limit: 30 })
  const events = useRows('events', { order: 'event_date', asc: true })
  const gallery = useRows('gallery', { order: 'sort', asc: true, limit: 12 })
  const heroRows = useRows('hero_slides', { order: 'sort', asc: true })
  const teachers = useRows('public_teachers', { order: 'sort', asc: true })
  const blocks = useRows('home_blocks', { order: 'sort', asc: true })

  const at = (place) => blocks.rows.filter((b) => b.published !== false && b.place === place).map((b) => <Block b={b} key={b.id} />)
  const upcoming = events.rows.filter((e) => e.published !== false && isUpcoming(e)).slice(0, 4)
  const tcount = teachers.rows.length
  const sortedNotices = [...notices.rows].filter((n) => n.published !== false).sort((a, b) => Number(b.pinned) - Number(a.pinned))

  const custom = settings.hero_mode !== 'gallery'
  const picSlides = custom
    ? heroRows.rows.filter((s) => s.published !== false && s.image_url)
    : gallery.rows.filter((g) => g.published !== false && (g.kind || 'image') === 'image' && g.image_url).map((g) => ({ ...g, title_bn: g.caption_bn, title_en: g.caption_en }))
  const items = [...(settings.hero_brand_slide !== false || !picSlides.length ? [{ brand: true }] : []), ...picSlides]

  const feats = [['book', 'home.why1'], ['moon', 'home.why2'], ['lotus', 'home.why3'], ['chat', 'home.why4']]
  const depts = useDepartments()
  const quick = [['/admission', 'apply', 'nav.admission'], ['/notices', 'megaphone', 'nav.notices'], ['/events', 'calendar', 'nav.events'], ['/gallery', 'image', 'nav.gallery'], ['/teachers', 'teacher', 'nav.teachers'], ['/contact', 'phone', 'nav.contact']]

  return (
    <>
      {at('top')}
      {settings.apply_open !== false && (
        <section className="container block-wrap">
          <div className="apply-bar">
            <div>
              <div className="apply-title"><span className="pulse" /> <b>{t('apply.title')}</b></div>
              <div className="muted">{t('apply.text')}</div>
            </div>
            <SmartLink to={settings.apply_link || '/admission'} className="btn">{t('apply.btn')} <Icon name="arrowright" size={16} cls="cur" /></SmartLink>
          </div>
        </section>
      )}

      <Hero items={items} />
      {settings.urgent_show !== false && <Urgent notices={sortedNotices.slice(0, Number(settings.urgent_count) || 6)} />}
      {at('after_slide')}

      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div className="quick-links">
            {quick.map(([to, ic, k]) => (
              <Link to={to} className="quick-link" key={to}>
                <span className="q-ic"><Icon name={ic} size={30} /></span>
                <span>{t(k)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="stats">
            <div className="stat-item"><b className="count">{t('stat.year.num')}</b><span>{t('stat.year.label')}</span></div>
            <div className="stat-item"><b className="count">{depts.fromDb ? dig(depts.list.length, lang) : t('stat.depts.num')}</b><span>{t('stat.depts.label')}</span></div>
            {tcount > 0 && <div className="stat-item"><b className="count">{dig(tcount, lang)}</b><span>{t('stat.teachers.label')}</span></div>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SecTitle>{t('home.why.title')}</SecTitle>
          <div className="grid g4" style={{ marginTop: 22 }}>
            {feats.map(([ico, k]) => (
              <div className="card feature" key={k}>
                <div className="ico"><Icon name={ico} size={28} /></div>
                <h3>{t(k + '.title')}</h3>
                <p className="muted">{t(k + '.text')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {at('after_why')}

      <section className="section alt">
        <div className="container">
          <SecTitle>{t('departments.title')}</SecTitle>
          <div className="grid g3" style={{ marginTop: 22 }}>
            {depts.list.map((d) => (
              <Link to="/departments" className="card feature" key={d.id} style={{ color: 'inherit' }}>
                <div className="ico"><Icon name={d.icon} size={28} /></div>
                <h3>{d.title}</h3>
                <p className="muted">{d.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container grid g2" style={{ alignItems: 'start' }}>
          <div>
            <h2>{t('home.notices.title')}</h2>
            <div className="stack">
              {sortedNotices.length === 0 && <p className="muted">{t('notices.empty')}</p>}
              {sortedNotices.slice(0, 4).map((n) => (
                <Link to="/notices" className="list-item" key={n.id}>
                  <span className="date-chip">{fmtDate(n.date, lang)}</span>
                  <h3>{pick(n, 'title', lang)}</h3>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 12 }}><Link to="/notices" className="more-link">{t('common.viewAll')} <Icon name="arrowright" size={15} cls="cur" /></Link></p>
          </div>
          <div>
            <h2>{t('home.events.title')}</h2>
            <div className="stack">
              {upcoming.length === 0 && <p className="muted">{t('events.empty')}</p>}
              {upcoming.map((e) => (
                <Link to="/events" className="list-item" key={e.id}>
                  <span className="date-chip">{fmtDate(e.event_date, lang)}</span>
                  <h3>{pick(e, 'title', lang)}</h3>
                  <Countdown start={e.start_at} end={e.end_at} showStart={e.show_start_timer} showEnd={e.show_end_timer} />
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 12 }}><Link to="/events" className="more-link">{t('common.viewAll')} <Icon name="arrowright" size={15} cls="cur" /></Link></p>
          </div>
        </div>
      </section>
      {at('after_events')}

      <section className="section">
        <div className="container">
          <SecTitle>{t('contact.cards.title')}</SecTitle>
          <div className="grid g3" style={{ marginTop: 22 }}>
            <div className="card contact-card"><div className="ico"><Icon name="pin" size={28} /></div><h3>{t('contact.address.label')}</h3><p className="muted" style={{ margin: 0 }}>{t('site.address')}</p></div>
            {settings.phone && <a className="card contact-card" href={`tel:${settings.phone}`}><div className="ico"><Icon name="phone" size={28} /></div><h3>{t('contact.phone.label')}</h3><p className="muted" style={{ margin: 0 }}>{settings.phone}</p></a>}
            {settings.email && <a className="card contact-card" href={`mailto:${settings.email}`}><div className="ico"><Icon name="mail" size={28} /></div><h3>{t('contact.email.label')}</h3><p className="muted" style={{ margin: 0 }}>{settings.email}</p></a>}
          </div>
          {settings.map_embed && <iframe className="map" style={{ marginTop: 18 }} title="map" loading="lazy" src={settings.map_embed} />}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card center cta-card">
            <h2>{t('home.cta.title')}</h2>
            <p>{t('home.cta.text')}</p>
            <Link to="/admission" className="btn pink">{t('home.cta.button')}</Link>
          </div>
        </div>
      </section>
      {at('bottom')}
    </>
  )
}
