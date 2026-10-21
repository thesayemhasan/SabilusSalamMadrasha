import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, configured } from '../../lib/supabase'
import { useSite, useRows, pick } from '../../lib/store'

const LOCALE = { bn: 'bn-BD', ar: 'ar-u-ca-gregory', en: 'en-GB' }
export const fmtDate = (d, lang) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

function Head({ title }) {
  return (
    <div className="page-head">
      <div className="container"><h1>{title}</h1></div>
    </div>
  )
}

/* ---------------- হোম ---------------- */
export function Home() {
  const { t, lang, settings } = useSite()
  const notices = useRows('notices', { order: 'date', limit: 4 })
  const events = useRows('events', { order: 'event_date', asc: true })
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.rows.filter((e) => e.event_date >= today).slice(0, 4)
  const feats = [
    ['📖', 'home.why1'],
    ['🌙', 'home.why2'],
    ['🌸', 'home.why3'],
    ['📱', 'home.why4'],
  ]
  return (
    <>
      <section
        className={`hero ${settings.hero_image ? 'has-img' : ''}`}
        style={settings.hero_image ? { backgroundImage: `url(${settings.hero_image})` } : undefined}
      >
        <div className="container">
          <div>
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
      </section>

      <section className="section">
        <div className="container">
          <h2 className="center">{t('home.why.title')}</h2>
          <div className="grid g4" style={{ marginTop: 20 }}>
            {feats.map(([ico, k]) => (
              <div className="card feature" key={k}>
                <div className="ico">{ico}</div>
                <h3>{t(k + '.title')}</h3>
                <p className="muted">{t(k + '.text')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container grid g2" style={{ alignItems: 'start' }}>
          <div>
            <h2>{t('home.notices.title')}</h2>
            <div className="stack">
              {notices.rows.length === 0 && <p className="muted">{t('notices.empty')}</p>}
              {notices.rows.map((n) => (
                <Link to="/notices" className="list-item" key={n.id}>
                  <span className="date-chip">{fmtDate(n.date, lang)}</span>
                  <h3>{pick(n, 'title', lang)}</h3>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 12 }}><Link to="/notices">{t('common.viewAll')} →</Link></p>
          </div>
          <div>
            <h2>{t('home.events.title')}</h2>
            <div className="stack">
              {upcoming.length === 0 && <p className="muted">{t('events.empty')}</p>}
              {upcoming.map((e) => (
                <Link to="/events" className="list-item" key={e.id}>
                  <span className="date-chip">{fmtDate(e.event_date, lang)}</span>
                  <h3>{pick(e, 'title', lang)}</h3>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 12 }}><Link to="/events">{t('common.viewAll')} →</Link></p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card center" style={{ background: 'linear-gradient(135deg,#e8f6ed,#fdeaf5)' }}>
            <h2>{t('home.cta.title')}</h2>
            <p>{t('home.cta.text')}</p>
            <Link to="/admission" className="btn pink">{t('home.cta.button')}</Link>
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------------- পরিচিতি ---------------- */
export function About() {
  const { t } = useSite()
  return (
    <>
      <Head title={t('about.title')} />
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <div className="grid g2" style={{ marginTop: 20 }}>
            <div className="card"><h3>{t('about.mission.title')}</h3><p>{t('about.mission.text')}</p></div>
            <div className="card"><h3>{t('about.vision.title')}</h3><p>{t('about.vision.text')}</p></div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------------- বিভাগ ---------------- */
export function Departments() {
  const { t } = useSite()
  const d = [['📖', 'dept.hifz'], ['📚', 'dept.qawmi'], ['🌸', 'dept.women']]
  return (
    <>
      <Head title={t('departments.title')} />
      <section className="section">
        <div className="container">
          <p className="muted">{t('departments.intro')}</p>
          <div className="grid g3">
            {d.map(([ico, k]) => (
              <div className="card feature" key={k}>
                <div className="ico">{ico}</div>
                <h3>{t(k + '.title')}</h3>
                <p>{t(k + '.text')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------------- ভর্তি ---------------- */
export function Admission() {
  const { t } = useSite()
  const empty = { student_name: '', father_name: '', mother_name: '', phone: '', department: '', class_name: '', address: '', note: '' }
  const [f, setF] = useState(empty)
  const [state, setState] = useState('idle')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (!supabase) return setState('offline')
    setState('sending')
    const { error } = await supabase.from('admission_applications').insert({ ...f, status: 'new' })
    if (error) return setState('error')
    setF(empty)
    setState('ok')
  }

  return (
    <>
      <Head title={t('admission.title')} />
      <section className="section">
        <div className="container grid g2" style={{ alignItems: 'start' }}>
          <div>
            <p>{t('admission.intro')}</p>
            <div className="card">
              <h3>{t('admission.rules.title')}</h3>
              <p className="muted pre">{t('admission.rules.text')}</p>
            </div>
          </div>
          <form className="card form" onSubmit={submit}>
            <div className="field"><label>{t('form.student')} *</label><input required value={f.student_name} onChange={set('student_name')} /></div>
            <div className="row2">
              <div className="field"><label>{t('form.father')}</label><input value={f.father_name} onChange={set('father_name')} /></div>
              <div className="field"><label>{t('form.mother')}</label><input value={f.mother_name} onChange={set('mother_name')} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>{t('form.phone')} *</label><input required type="tel" value={f.phone} onChange={set('phone')} /></div>
              <div className="field">
                <label>{t('form.department')}</label>
                <select value={f.department} onChange={set('department')}>
                  <option value="">—</option>
                  {['dept.hifz', 'dept.qawmi', 'dept.women'].map((k) => (
                    <option key={k} value={t(k + '.title')}>{t(k + '.title')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field"><label>{t('form.class')}</label><input value={f.class_name} onChange={set('class_name')} /></div>
            <div className="field"><label>{t('form.address')}</label><input value={f.address} onChange={set('address')} /></div>
            <div className="field"><label>{t('form.note')}</label><textarea value={f.note} onChange={set('note')} /></div>
            {state === 'ok' && <div className="alert ok">{t('form.success')}</div>}
            {state === 'error' && <div className="alert err">{t('form.error')}</div>}
            {(state === 'offline' || !configured) && <div className="alert warn">{t('form.offline')}</div>}
            <button className="btn" disabled={state === 'sending'}>
              {state === 'sending' ? t('form.sending') : t('form.submit')}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

/* ---------------- নোটিশ ---------------- */
export function Notices() {
  const { t, lang } = useSite()
  const { rows, loading } = useRows('notices', { order: 'date' })
  const sorted = [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  return (
    <>
      <Head title={t('notices.title')} />
      <section className="section">
        <div className="container stack" style={{ maxWidth: 820 }}>
          {!loading && sorted.length === 0 && <p className="muted">{t('notices.empty')}</p>}
          {sorted.map((n) => (
            <article className="list-item" key={n.id}>
              <span className="date-chip">{fmtDate(n.date, lang)}</span>
              {n.pinned && <span className="date-chip pin">{t('common.pinned')}</span>}
              <h3>{pick(n, 'title', lang)}</h3>
              <p className="pre muted" style={{ margin: 0 }}>{pick(n, 'body', lang)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

/* ---------------- ইভেন্ট ---------------- */
export function Events() {
  const { t, lang } = useSite()
  const { rows, loading } = useRows('events', { order: 'event_date', asc: true })
  const today = new Date().toISOString().slice(0, 10)
  const up = rows.filter((e) => e.event_date >= today)
  const past = rows.filter((e) => e.event_date < today).reverse()
  const Item = ({ e }) => (
    <article className="list-item">
      <span className="date-chip">{fmtDate(e.event_date, lang)}</span>
      <h3>{pick(e, 'title', lang)}</h3>
      <p className="pre muted" style={{ margin: 0 }}>{pick(e, 'desc', lang)}</p>
    </article>
  )
  return (
    <>
      <Head title={t('events.title')} />
      <section className="section">
        <div className="container stack" style={{ maxWidth: 820 }}>
          {!loading && rows.length === 0 && <p className="muted">{t('events.empty')}</p>}
          {up.map((e) => <Item e={e} key={e.id} />)}
          {past.length > 0 && <h3 style={{ marginTop: 16 }} className="muted">…</h3>}
          {past.map((e) => <div style={{ opacity: 0.7 }} key={e.id}><Item e={e} /></div>)}
        </div>
      </section>
    </>
  )
}

/* ---------------- গ্যালারি ---------------- */
export function Gallery() {
  const { t, lang } = useSite()
  const { rows, loading } = useRows('gallery', { order: 'sort', asc: true })
  const [big, setBig] = useState(null)
  return (
    <>
      <Head title={t('gallery.title')} />
      <section className="section">
        <div className="container">
          {!loading && rows.length === 0 && <p className="muted">{t('gallery.empty')}</p>}
          <div className="gallery">
            {rows.map((g) => (
              <figure key={g.id} onClick={() => setBig(g)}>
                <img loading="lazy" src={g.image_url} alt={pick(g, 'caption', lang)} />
                {pick(g, 'caption', lang) && <figcaption>{pick(g, 'caption', lang)}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      </section>
      {big && (
        <div className="lightbox" onClick={() => setBig(null)}>
          <img src={big.image_url} alt="" />
        </div>
      )}
    </>
  )
}

/* ---------------- শিক্ষক ---------------- */
export function Teachers() {
  const { t, lang } = useSite()
  const { rows, loading } = useRows('public_teachers', { order: 'sort', asc: true })
  return (
    <>
      <Head title={t('teachers.title')} />
      <section className="section">
        <div className="container">
          {!loading && rows.length === 0 && <p className="muted">{t('teachers.empty')}</p>}
          <div className="grid g4">
            {rows.map((x) => (
              <div className="card teacher" key={x.id}>
                {x.photo_url ? <img src={x.photo_url} alt="" /> : <div className="ph">👤</div>}
                <h3>{pick(x, 'name', lang)}</h3>
                <p className="muted" style={{ margin: 0 }}>{pick(x, 'designation', lang)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------------- দান ---------------- */
export function Donate() {
  const { t } = useSite()
  return (
    <>
      <Head title={t('donate.title')} />
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <p>{t('donate.intro')}</p>
          <div className="card">
            <h3>{t('donate.methods.title')}</h3>
            <p className="pre" style={{ margin: 0 }}>{t('donate.methods.text')}</p>
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------------- যোগাযোগ ---------------- */
export function Contact() {
  const { t, settings } = useSite()
  const [f, setF] = useState({ name: '', phone: '', message: '' })
  const [state, setState] = useState('idle')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (!supabase) return setState('offline')
    setState('sending')
    const { error } = await supabase.from('contact_messages').insert({ ...f, is_read: false })
    if (error) return setState('error')
    setF({ name: '', phone: '', message: '' })
    setState('ok')
  }

  return (
    <>
      <Head title={t('contact.title')} />
      <section className="section">
        <div className="container grid g2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <p>{t('contact.intro')}</p>
            <div className="card">
              <p><b>📍 {t('contact.address.label')}</b><br />{t('site.address')}</p>
              {settings.phone && <p><b>☎ {t('contact.phone.label')}</b><br /><a href={`tel:${settings.phone}`}>{settings.phone}</a></p>}
              {settings.email && <p><b>✉ {t('contact.email.label')}</b><br /><a href={`mailto:${settings.email}`}>{settings.email}</a></p>}
              {settings.whatsapp && <p><b>WhatsApp</b><br /><a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{settings.whatsapp}</a></p>}
              <p style={{ margin: 0 }}><b>🕘 {t('contact.hours.label')}</b><br />{t('contact.hours.text')}</p>
            </div>
            {settings.map_embed && <iframe className="map" title="map" loading="lazy" src={settings.map_embed} />}
          </div>
          <form className="card form" onSubmit={submit}>
            <div className="field"><label>{t('contact.form.name')} *</label><input required value={f.name} onChange={set('name')} /></div>
            <div className="field"><label>{t('contact.form.phone')}</label><input type="tel" value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label>{t('contact.form.message')} *</label><textarea required value={f.message} onChange={set('message')} /></div>
            {state === 'ok' && <div className="alert ok">{t('contact.form.success')}</div>}
            {state === 'error' && <div className="alert err">{t('form.error')}</div>}
            {(state === 'offline' || !configured) && <div className="alert warn">{t('form.offline')}</div>}
            <button className="btn" disabled={state === 'sending'}>
              {state === 'sending' ? t('form.sending') : t('contact.form.send')}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
