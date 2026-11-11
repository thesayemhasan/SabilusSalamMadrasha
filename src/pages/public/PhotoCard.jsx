import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import PageHead from '../../components/PageHead'
import { clampTf, drawCard, loadImage, loadUserPhoto } from '../../lib/photocard'

const ymd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// ফটোকার্ড: সবাই নিজের ছবি দিয়ে মাহফিলের কার্ড বানায়। ছবি ব্রাউজারেই থাকে, সার্ভারে যায় না।
export default function PhotoCard() {
  const { t, modules } = useSite()
  const [tpls, setTpls] = useState(null)
  const [win, setWin] = useState({})
  const [sel, setSel] = useState(null)
  const [frame, setFrame] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [tf, setTf] = useState({ z: 1, fx: 0, fy: 0 })
  const [err, setErr] = useState('')
  const [out, setOut] = useState('')
  const cv = useRef(null)
  const pts = useRef(new Map())
  const pinch = useRef(0)

  useEffect(() => {
    if (!supabase) return setTpls([])
    supabase.from('photocard_templates').select('*').eq('published', true).order('sort').order('created_at').then(({ data }) => { setTpls(data || []); if (data?.[0]) setSel(data[0].id) }, () => setTpls([]))
    supabase.from('site_settings').select('value').eq('key', 'photocard').maybeSingle().then(({ data }) => setWin(data?.value || {}), () => {})
  }, [])
  const tpl = useMemo(() => (tpls || []).find((x) => x.id === sel), [tpls, sel])
  const num = (x) => Number(x)
  const T = useMemo(() => (tpl ? { ...tpl, px: num(tpl.px), py: num(tpl.py), pw: num(tpl.pw), ph: num(tpl.ph) } : null), [tpl])

  useEffect(() => {
    setFrame(null)
    if (!tpl) return
    let live = true
    loadImage(tpl.image_url).then((im) => { if (live) setFrame(im) }, () => { if (live) setErr(t('pc.error')) })
    return () => { live = false }
  }, [tpl?.id]) // eslint-disable-line

  const render = useCallback(() => {
    const c = cv.current
    if (!c || !T || !frame) return
    c.width = T.width; c.height = T.height
    drawCard(c.getContext('2d'), T.width, T.height, T, frame, photo, tf)
  }, [T, frame, photo, tf])
  useEffect(() => { render() }, [render])

  async function pickFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErr(''); setOut('')
    try { setPhoto(await loadUserPhoto(f)); setTf({ z: 1, fx: 0, fy: 0 }) } catch { setErr(t('pc.error')) }
  }
  const setT = (n) => setTf((p) => (photo && T ? clampTf(n(p), photo, T, T.width, T.height) : p))

  // টেনে সরানো ও দুই আঙুলে বড়-ছোট
  function onDown(e) { if (!photo) return; e.currentTarget.setPointerCapture?.(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch.current = 0 }
  function onMove(e) {
    const m = pts.current
    if (!photo || !T || !m.has(e.pointerId)) return
    const rect = e.currentTarget.getBoundingClientRect()
    const prev = m.get(e.pointerId)
    m.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (m.size === 1) {
      const bw = T.pw * rect.width, bh = T.ph * rect.height
      setT((p) => ({ ...p, fx: p.fx + (e.clientX - prev.x) / bw, fy: p.fy + (e.clientY - prev.y) / bh }))
    } else if (m.size === 2) {
      const [a, b] = [...m.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current) setT((p) => ({ ...p, z: p.z * (d / pinch.current) }))
      pinch.current = d
    }
  }
  const onUp = (e) => { pts.current.delete(e.pointerId); pinch.current = 0 }
  function onWheel(e) { if (!photo) return; setT((p) => ({ ...p, z: p.z * (e.deltaY < 0 ? 1.06 : 0.94) })) }

  const counted = useRef(false)
  const countOnce = () => { if (!counted.current && tpl) { counted.current = true; supabase?.rpc('photocard_made', { p_id: tpl.id }).then(() => {}, () => {}) } }
  function blobOf() { return new Promise((res) => cv.current.toBlob(res, 'image/png')) }
  async function download() {
    const b = await blobOf()
    if (!b) return setErr(t('pc.error'))
    const url = URL.createObjectURL(b)
    setOut(url)
    const a = document.createElement('a'); a.href = url; a.download = 'photocard.png'; document.body.appendChild(a); a.click(); a.remove()
    countOnce()
  }
  async function share() {
    const b = await blobOf()
    if (!b) return setErr(t('pc.error'))
    setOut(URL.createObjectURL(b))
    const file = new File([b], 'photocard.png', { type: 'image/png' })
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); countOnce() } else await download() } catch { /* বাতিল */ }
  }

  const today = ymd()
  const open = modules.photocard === true && (!win.start || today >= win.start) && (!win.end || today <= win.end)

  return (
    <>
      <PageHead title={t('pc.title')} sub={t('pc.sub')} />
      <section className="section">
        <div className="container stack" style={{ maxWidth: 860 }}>
          {tpls === null && <p className="muted">{t('common.loading')}</p>}
          {tpls && !open && <div className="card center"><b>{t('pc.closed')}</b></div>}
          {tpls && open && tpls.length === 0 && <p className="muted">{t('pc.none')}</p>}
          {tpls && open && tpls.length > 0 && (
            <>
              {tpls.length > 1 && (
                <div>
                  <b>{t('pc.step1')}</b>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                    {tpls.map((x) => (
                      <button type="button" key={x.id} onClick={() => { setSel(x.id); setOut('') }} style={{ padding: 3, borderRadius: 12, border: `2px solid ${x.id === sel ? 'var(--primary)' : 'var(--line)'}`, background: 'var(--glass-2)', cursor: 'pointer' }} title={x.title_bn}>
                        <img src={x.image_url} alt={x.title_bn} style={{ height: 96, width: 'auto', maxWidth: 140, objectFit: 'contain', borderRadius: 9, display: 'block', background: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/14px 14px' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="card" style={{ display: 'grid', gap: 12 }}>
                <b>{tpls.length > 1 ? t('pc.step2') : t('pc.step1')}</b>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    {photo ? t('pc.change') : t('pc.choose')}
                    <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
                  </label>
                  <span className="muted" style={{ fontSize: '.88rem' }}>{t('pc.privacy')}</span>
                </div>
                {err && <div className="alert err">{err}</div>}
                <div style={{ display: 'grid', placeItems: 'center' }}>
                  <canvas
                    ref={cv}
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
                    style={{ width: '100%', maxWidth: 520, height: 'auto', touchAction: 'none', cursor: photo ? 'grab' : 'default', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.18)', background: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/16px 16px' }}
                  />
                </div>
                {photo && (
                  <>
                    <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: '.88rem' }}>{t('pc.hint')}</p>
                    <label style={{ display: 'grid', gap: 4, maxWidth: 520, margin: '0 auto', width: '100%' }}>
                      <span>{t('pc.zoom')}</span>
                      <input type="range" min="1" max="4" step="0.01" value={Math.min(4, tf.z)} onChange={(e) => setT((p) => ({ ...p, z: Number(e.target.value) }))} />
                    </label>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn" onClick={download}>{t('pc.download')}</button>
                      <button className="btn outline" onClick={share}>{t('pc.share')}</button>
                    </div>
                  </>
                )}
                {out && (
                  <div style={{ textAlign: 'center' }}>
                    <p className="muted" style={{ fontSize: '.88rem' }}>{t('pc.saveHint')}</p>
                    <img src={out} alt="photo card" style={{ width: '100%', maxWidth: 420, borderRadius: 10 }} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}
