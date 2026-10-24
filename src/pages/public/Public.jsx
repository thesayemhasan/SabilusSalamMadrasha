import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, configured, uploadApplicationFile } from '../../lib/supabase'
import { useSite, useRows, useDepartments, pick } from '../../lib/store'
import { fmtDate, socialHref, youtubeId } from '../../lib/util'
import Icon from '../../components/Icon'
import { Modal, Select } from '../../components/Ui'
import Prose from '../../components/Prose'
import PageHead from '../../components/PageHead'
import Countdown from '../../components/Countdown'
import { isUpcoming } from './Home'

export { Home } from './Home'
export { Account } from './Account'
export { Privacy, Terms } from './Legal'
export { fmtDate }

const Head = ({ title }) => <PageHead title={title} />

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
  const d = useDepartments().list
  return (
    <>
      <Head title={t('departments.title')} />
      <section className="section">
        <div className="container">
          <p className="muted">{t('departments.intro')}</p>
          <div className="grid g3">
            {d.map((x) => (
              <div className="card feature" key={x.id}>
                <div className="ico"><Icon name={x.icon} size={28} /></div>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------------- ভর্তি ---------------- */
const splitOpts = (s = '') => String(s).split(/\n|,/).map((x) => x.trim()).filter(Boolean)

function FileField({ value, onChange, t }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [thumb, setThumb] = useState('')
  async function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setErr('')
    if (!/^(image\/|application\/pdf)/.test(f.type)) return setErr(t('admission.file.hint'))
    if (f.size > 5 * 1024 * 1024) return setErr(t('admission.file.hint'))
    setBusy(true)
    try { onChange(await uploadApplicationFile(f)); setName(f.name); setThumb(f.type.startsWith('image/') ? URL.createObjectURL(f) : '') } catch { setErr(t('form.error')) }
    setBusy(false)
    e.target.value = ''
  }
  return (
    <div>
      <div className="file-pick">
        <label className="btn outline small">
          <input type="file" accept="image/*,application/pdf" hidden onChange={pickFile} />
          <Icon name="upload" size={16} cls="cur" /> {busy ? t('form.sending') : t('admission.file.pick')}
        </label>
        {value && (thumb ? <img className="f-thumb" src={thumb} alt="" /> : <span className="f-name"><Icon name="check" size={16} cls="cur" /> {name || 'PDF'}</span>)}
      </div>
      <small className="muted hint-s">{t('admission.file.hint')}</small>
      {err && <div className="alert err">{err}</div>}
    </div>
  )
}

export function Admission() {
  const { t, lang, settings } = useSite()
  const fields = useRows('admission_fields', { order: 'sort', asc: true })
  const defaults = useMemo(() => [
    { id: 'd1', field_key: 'student_name', map_to: 'student_name', type: 'text', required: true, label: t('form.student') },
    { id: 'd2', field_key: 'father_name', map_to: 'father_name', type: 'text', label: t('form.father'), half: true },
    { id: 'd3', field_key: 'mother_name', map_to: 'mother_name', type: 'text', label: t('form.mother'), half: true },
    { id: 'd4', field_key: 'phone', map_to: 'phone', type: 'phone', required: true, label: t('form.phone'), half: true },
    { id: 'd5', field_key: 'department', map_to: 'department', type: 'select', label: t('form.department'), half: true, opts: ['dept.hifz', 'dept.qawmi', 'dept.women'].map((k) => t(k + '.title')) },
    { id: 'd6', field_key: 'class_name', map_to: 'class_name', type: 'text', label: t('form.class') },
    { id: 'd7', field_key: 'address', map_to: 'address', type: 'text', label: t('form.address') },
    { id: 'd8', field_key: 'note', map_to: 'note', type: 'textarea', label: t('form.note') },
  ], [t])
  const live = fields.rows.filter((f) => f.published !== false)
  const list = live.length
    ? live.map((f) => ({ ...f, label: pick(f, 'label', lang), opts: splitOpts(pick(f, 'options', lang)) }))
    : defaults

  const [v, setV] = useState({})
  const [agree, setAgree] = useState(false)
  const [state, setState] = useState('idle')
  const [msg, setMsg] = useState('')
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }))
  const rules = t('admission.rules.text')
  const needAgree = settings.admission_agree !== false && rules

  async function submit(e) {
    e.preventDefault()
    if (!supabase) return setState('offline')
    setMsg('')
    for (const f of list) {
      if ((f.type === 'file' || f.type === 'select') && f.required && !v[f.field_key]) return setMsg(`${f.label} *`)
    }
    if (needAgree && !agree) return setMsg(t('admission.agree'))
    setState('sending')
    const payload = { status: 'new' }
    const data = {}
    for (const f of list) {
      const val = (v[f.field_key] ?? '').toString().trim()
      if (!val) continue
      if (f.map_to) payload[f.map_to] = val
      data[f.field_key] = { label: f.label, value: val, type: f.type }
    }
    payload.data = data
    const { error } = await supabase.from('admission_applications').insert(payload)
    if (error) { setMsg(error.message || ''); return setState('error') }
    setV({}); setAgree(false)
    setState('ok')
  }

  const render = (f) => {
    const val = v[f.field_key] || ''
    const req = f.required ? ' *' : ''
    return (
      <div className="field" key={f.id}>
        <label>{f.label}{req}</label>
        {f.type === 'textarea' && <textarea required={f.required} value={val} onChange={(e) => set(f.field_key, e.target.value)} />}
        {['text', 'phone', 'email', 'date', 'number'].includes(f.type) && (
          <input required={f.required} type={f.type === 'phone' ? 'tel' : f.type} value={val} onChange={(e) => set(f.field_key, e.target.value)} />
        )}
        {f.type === 'select' && <Select value={val} onChange={(x) => set(f.field_key, x)} placeholder={t('admission.select')} options={f.opts || []} />}
        {f.type === 'file' && <FileField value={val} onChange={(x) => set(f.field_key, x)} t={t} />}
      </div>
    )
  }
  // দুটি ছোট ঘর পাশাপাশি
  const nodes = []
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    const short = (x) => x && (x.half || (!live.length ? false : ['text', 'phone', 'email', 'date', 'number', 'select'].includes(x.type) && x.half !== false && false))
    if (short(f) && short(list[i + 1])) { nodes.push(<div className="row2" key={f.id}>{render(f)}{render(list[i + 1])}</div>); i++ } else nodes.push(render(f))
  }

  return (
    <>
      <Head title={t('admission.title')} />
      <section className="section">
        <div className="container grid g2" style={{ alignItems: 'start' }}>
          <div>
            <p>{t('admission.intro')}</p>
            {rules && (
              <details className="card rules" open>
                <summary><Icon name="shield" size={24} /><h3 style={{ margin: 0 }}>{t('admission.rules.title')}</h3><span className="chev"><Icon name="chevdown" size={20} /></span></summary>
                <Prose text={rules} />
              </details>
            )}
          </div>
          <form className="card form" onSubmit={submit}>
            {nodes}
            {needAgree && (
              <label className="check">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{t('admission.agree')}</span>
              </label>
            )}
            {msg && state !== 'error' && <div className="alert err">{msg}</div>}
            {state === 'ok' && <div className="alert ok">{t('form.success')}</div>}
            {state === 'error' && <div className="alert err">{t('form.error')}{msg && <div className="muted" style={{ fontSize: '.8rem', marginTop: 4, direction: 'ltr', overflowWrap: 'anywhere' }}>{msg}</div>}</div>}
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
  const sorted = [...rows].filter((n) => n.published !== false).sort((a, b) => Number(b.pinned) - Number(a.pinned))
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
  const vis = rows.filter((e) => e.published !== false)
  const up = vis.filter(isUpcoming)
  const past = vis.filter((e) => !isUpcoming(e)).reverse()
  const Item = ({ e }) => (
    <article className="list-item">
      <span className="date-chip">{fmtDate(e.event_date, lang)}</span>
      <h3>{pick(e, 'title', lang)}</h3>
      <p className="pre muted" style={{ margin: 0 }}>{pick(e, 'desc', lang)}</p>
      <Countdown start={e.start_at} end={e.end_at} showStart={e.show_start_timer} showEnd={e.show_end_timer} />
    </article>
  )
  return (
    <>
      <Head title={t('events.title')} />
      <section className="section">
        <div className="container stack" style={{ maxWidth: 820 }}>
          {!loading && vis.length === 0 && <p className="muted">{t('events.empty')}</p>}
          {up.map((e) => <Item e={e} key={e.id} />)}
          {past.length > 0 && <h3 style={{ marginTop: 16 }} className="muted">{t('events.past')}</h3>}
          {past.map((e) => <div style={{ opacity: 0.72 }} key={e.id}><Item e={e} /></div>)}
        </div>
      </section>
    </>
  )
}

/* ---------------- গ্যালারি (ছবি + ইউটিউব ভিডিও) ---------------- */
export function Gallery() {
  const { t, lang } = useSite()
  const { rows, loading } = useRows('gallery', { order: 'sort', asc: true })
  const [tab, setTab] = useState('all')
  const [big, setBig] = useState(null)
  const vis = rows.filter((g) => g.published !== false)
  const kind = (g) => (g.kind === 'video' ? 'video' : 'image')
  const shown = vis.filter((g) => tab === 'all' || kind(g) === (tab === 'photos' ? 'image' : 'video'))
  const hasVideo = vis.some((g) => kind(g) === 'video')
  const thumb = (g) => (kind(g) === 'video' ? (g.image_url || `https://img.youtube.com/vi/${youtubeId(g.video_url)}/hqdefault.jpg`) : g.image_url)

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && setBig(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <>
      <Head title={t('gallery.title')} />
      <section className="section">
        <div className="container">
          {hasVideo && (
            <div className="seg">
              {[['all', 'gallery.all'], ['photos', 'gallery.photos'], ['videos', 'gallery.videos']].map(([k, l]) => (
                <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
              ))}
            </div>
          )}
          {!loading && shown.length === 0 && <p className="muted">{t('gallery.empty')}</p>}
          <div className="gallery">
            {shown.map((g) => (
              <figure key={g.id} className={kind(g) === 'video' ? 'vid' : ''} onClick={() => setBig(g)}>
                <div>
                  <img loading="lazy" src={thumb(g)} alt={pick(g, 'caption', lang)} />
                  {kind(g) === 'video' && <span className="play"><Icon name="play" size={24} cls="cur" /></span>}
                </div>
                {pick(g, 'caption', lang) && <figcaption>{pick(g, 'caption', lang)}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      </section>
      {big && (
        <div className="lightbox" onClick={() => setBig(null)}>
          <button type="button" className="lb-x" aria-label="close"><Icon name="close" size={24} cls="cur" /></button>
          {kind(big) === 'video' && youtubeId(big.video_url) ? (
            <div className="lb-video" onClick={(e) => e.stopPropagation()}>
              <iframe title="video" src={`https://www.youtube-nocookie.com/embed/${youtubeId(big.video_url)}?autoplay=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
          ) : kind(big) === 'video' ? (
            <a className="btn" href={big.video_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>YouTube</a>
          ) : (
            <img src={big.image_url} alt="" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </>
  )
}

/* ---------------- শিক্ষক ---------------- */
export function Teachers() {
  const { t, lang, settings } = useSite()
  const { rows, loading } = useRows('public_teachers', { order: 'sort', asc: true })
  const [call, setCall] = useState(null)
  const vis = rows.filter((x) => x.published !== false)
  const phone = (x) => x.phone || settings.phone
  return (
    <>
      <Head title={t('teachers.title')} />
      <section className="section">
        <div className="container">
          {!loading && vis.length === 0 && <p className="muted">{t('teachers.empty')}</p>}
          <div className="grid teachers">
            {vis.map((x) => (
              <div className="card teacher" key={x.id}>
                <div className="t-photo">
                  {x.photo_url ? <img src={x.photo_url} alt="" loading="lazy" /> : <div className="ph"><Icon name="user" size={52} /></div>}
                </div>
                <h3>{pick(x, 'name', lang)}</h3>
                <p className="muted" style={{ margin: 0 }}>{pick(x, 'designation', lang)}</p>
                <div className="t-soc">
                  {x.facebook && <a className="fb" href={socialHref('facebook', x.facebook)} target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook"><Icon name="facebook" size={19} cls="cur" /></a>}
                  {x.whatsapp && <a className="wa" href={socialHref('whatsapp', x.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp"><Icon name="whatsapp" size={19} cls="cur" /></a>}
                  <button className="cl" type="button" aria-label="Call" title="Call" onClick={() => setCall(x)}><Icon name="phone" size={19} cls="cur" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {call && (
        <Modal onClose={() => setCall(null)}>
          <div className="confirm">
            <div className="confirm-ic"><Icon name="phone" size={30} cls="cur" /></div>
            <h3>{t('teachers.call.title')}</h3>
            <div className="confirm-name">{pick(call, 'name', lang)}</div>
            <p className="muted pre">{pick(call, 'call_msg', lang) || t('teachers.call.default')}</p>
            <div className="confirm-actions">
              <button type="button" className="btn outline" onClick={() => setCall(null)}>{t('teachers.call.close')}</button>
              {phone(call) && <a className="btn" href={`tel:${phone(call)}`}><Icon name="phone" size={17} cls="cur" /> {t('teachers.call.btn')}</a>}
            </div>
          </div>
        </Modal>
      )}
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
              <p><b><Icon name="pin" size={18} /> {t('contact.address.label')}</b><br />{t('site.address')}</p>
              {settings.phone && <p><b><Icon name="phone" size={18} /> {t('contact.phone.label')}</b><br /><a href={`tel:${settings.phone}`}>{settings.phone}</a></p>}
              {settings.email && <p><b><Icon name="mail" size={18} /> {t('contact.email.label')}</b><br /><a href={`mailto:${settings.email}`}>{settings.email}</a></p>}
              {settings.whatsapp && <p><b><Icon name="whatsapp" size={18} /> WhatsApp</b><br /><a href={socialHref('whatsapp', settings.whatsapp)} target="_blank" rel="noreferrer">{settings.whatsapp}</a></p>}
              <p style={{ margin: 0 }}><b><Icon name="clock" size={18} /> {t('contact.hours.label')}</b><br />{t('contact.hours.text')}</p>
            </div>
            {settings.map_embed && <iframe className="map" title="map" loading="lazy" src={settings.map_embed} />}
          </div>
          <form className="card form" onSubmit={submit}>
            <div className="field"><label>{t('contact.form.name')} *</label><input required value={f.name} onChange={set('name')} /></div>
            <div className="field"><label>{t('contact.form.phone')}</label><input type="tel" value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label>{t('contact.form.message')} *</label><textarea required value={f.message} onChange={set('message')} /></div>
            {state === 'ok' && <div className="alert ok">{t('contact.form.success')}</div>}
            {state === 'error' && <div className="alert err">{t('form.error')}{msg && <div className="muted" style={{ fontSize: '.8rem', marginTop: 4, direction: 'ltr', overflowWrap: 'anywhere' }}>{msg}</div>}</div>}
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
