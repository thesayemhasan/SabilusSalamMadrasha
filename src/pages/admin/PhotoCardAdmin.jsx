import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, uploadImage } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import { Select, useConfirm } from '../../components/Ui'
import { LAYERS, SHAPES, detectHole, packDesign } from '../../lib/photocard'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const BLANK = { title_bn: '', image_url: '', width: 1080, height: 1080, shape: 'rect', layer: 'under', px: 0.2, py: 0.2, pw: 0.6, ph: 0.6, published: true, sort: 0 }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const chess = 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0/16px 16px'

// ছবির জায়গা (বক্স) টেনে ঠিক করার প্রিভিউ
function BoxEditor({ t, set }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const num = { px: Number(t.px), py: Number(t.py), pw: Number(t.pw), ph: Number(t.ph) }
  function start(e, mode) {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { mode, x: e.clientX, y: e.clientY, ...num }
  }
  function move(e) {
    const d = drag.current
    if (!d) return
    const r = ref.current.getBoundingClientRect()
    const dx = (e.clientX - d.x) / r.width, dy = (e.clientY - d.y) / r.height
    if (d.mode === 'move') set({ px: clamp(d.px + dx, 0, 1 - d.pw), py: clamp(d.py + dy, 0, 1 - d.ph) })
    else set({ pw: clamp(d.pw + dx, 0.05, 1 - d.px), ph: clamp(d.ph + dy, 0.05, 1 - d.py) })
  }
  const end = () => { drag.current = null }
  const radius = t.shape === 'circle' ? '50%' : t.shape === 'round' ? '12%' : 0
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', maxWidth: 460, margin: '0 auto', background: chess, lineHeight: 0, touchAction: 'none', userSelect: 'none' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <img src={t.image_url} alt="" draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
      <div onPointerDown={(e) => start(e, 'move')} style={{ position: 'absolute', left: `${num.px * 100}%`, top: `${num.py * 100}%`, width: `${num.pw * 100}%`, height: `${num.ph * 100}%`, border: '2px dashed #e5007d', background: 'rgba(229,0,125,.18)', borderRadius: radius, cursor: 'move', boxSizing: 'border-box' }}>
        <span onPointerDown={(e) => start(e, 'size')} style={{ position: 'absolute', right: -9, bottom: -9, width: 22, height: 22, borderRadius: 11, background: '#e5007d', border: '2px solid #fff', cursor: 'nwse-resize' }} />
      </div>
    </div>
  )
}

function Editor({ init, onDone }) {
  const [t, setT] = useState(init)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (p) => setT((x) => ({ ...x, ...p }))

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true); setMsg('')
    try {
      const pk = await packDesign(f)
      const url = await uploadImage(pk.file, 'photocard')
      const hole = detectHole(pk.canvas)
      set({ image_url: url, width: pk.width, height: pk.height, ...(hole ? { ...hole, layer: 'under' } : { layer: 'over' }) })
      setMsg(hole ? 'ডিজাইনের ফাঁকা জায়গা নিজে থেকেই ধরা হয়েছে। দরকার হলে বক্স টেনে ঠিক করুন।' : 'ডিজাইনে ফাঁকা (স্বচ্ছ) জায়গা পাওয়া যায়নি, তাই ছবি ডিজাইনের ওপরে বসবে। বক্স টেনে জায়গা ঠিক করুন।')
    } catch (er) { setMsg(`আপলোড হয়নি: ${er.message}`) }
    setBusy(false)
  }
  async function save() {
    if (!t.image_url) return setMsg('আগে ডিজাইনের ছবি আপলোড করুন।')
    setBusy(true); setMsg('')
    const row = { title_bn: t.title_bn || '', image_url: t.image_url, width: t.width, height: t.height, shape: t.shape, layer: t.layer, px: Number(t.px), py: Number(t.py), pw: Number(t.pw), ph: Number(t.ph), published: !!t.published, sort: Number(t.sort) || 0 }
    const q = t.id ? supabase.from('photocard_templates').update(row).eq('id', t.id) : supabase.from('photocard_templates').insert(row)
    const { error } = await q
    setBusy(false)
    if (error) return setMsg(`সংরক্ষণ হয়নি: ${error.message}`)
    onDone()
  }
  const pct = (k) => Math.round(Number(t[k]) * 1000) / 10
  return (
    <div className="card form" style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>{t.id ? 'ডিজাইন সম্পাদনা' : 'নতুন ডিজাইন'}</h3>
      <div className="field"><label>ডিজাইনের নাম (শুধু আপনার জন্য, ঐচ্ছিক)</label><input value={t.title_bn} onChange={(e) => set({ title_bn: e.target.value })} /></div>
      <div className="field">
        <label>ডিজাইনের ছবি (PNG — ফটোর জায়গা ফাঁকা/স্বচ্ছ রাখুন)</label>
        <input type="file" accept="image/png,image/webp,image/jpeg" onChange={pick} disabled={busy} />
        <p className="muted" style={{ fontSize: '.85rem', margin: '4px 0 0' }}>১০৮০×১০৮০ (চৌকো) বা ১০৮০×১৩৫০ (ফেসবুক পোস্ট) মাপ ভালো। ছবি নিজে থেকে ছোট ও হালকা করে রাখা হয়।</p>
      </div>
      {t.image_url && (
        <>
          <p className="muted" style={{ margin: 0 }}>গোলাপি বক্সটি টেনে সরান; কোণার বিন্দু টেনে মাপ বদলান। ওখানেই মানুষের ছবি বসবে।</p>
          <BoxEditor t={t} set={set} />
          <div className="grid g2">
            <div className="field"><label>ছবির আকার</label><Select value={t.shape} onChange={(v) => set({ shape: v })} options={SHAPES} /></div>
            <div className="field"><label>ছবি কোথায় বসবে</label><Select value={t.layer} onChange={(v) => set({ layer: v })} options={LAYERS} /></div>
          </div>
          <div className="grid g3">
            {[['px', 'বাম থেকে %'], ['py', 'ওপর থেকে %'], ['pw', 'চওড়া %'], ['ph', 'উচ্চতা %']].map(([k, l]) => (
              <div className="field" key={k}><label>{l}</label><input type="number" min="0" max="100" step="0.5" value={pct(k)} onChange={(e) => set({ [k]: clamp(Number(e.target.value) / 100, 0, 1) })} /></div>
            ))}
          </div>
        </>
      )}
      <div className="grid g2">
        <div className="field"><label>ক্রম (ছোট সংখ্যা আগে)</label><input type="number" value={t.sort} onChange={(e) => set({ sort: e.target.value })} /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'end' }}><input type="checkbox" checked={!!t.published} onChange={(e) => set({ published: e.target.checked })} /> জনসাধারণকে দেখান</label>
      </div>
      {msg && <div className={`alert ${/হয়নি|আগে/.test(msg) ? 'err' : 'info'}`}>{msg}</div>}
      <div className="row-actions">
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'অপেক্ষা করুন…' : 'সংরক্ষণ'}</button>
        <button className="btn outline" onClick={() => onDone(true)}>বাতিল</button>
      </div>
    </div>
  )
}

export default function PhotoCardAdmin() {
  const confirm = useConfirm()
  const { modules } = useSite()
  const [rows, setRows] = useState([])
  const [edit, setEdit] = useState(null)
  const [win, setWin] = useState({ start: '', end: '' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('photocard_templates').select('*').order('sort').order('created_at')
    setRows(data || [])
    const { data: s } = await supabase.from('site_settings').select('value').eq('key', 'photocard').maybeSingle()
    setWin({ start: s?.value?.start || '', end: s?.value?.end || '' })
  }, [])
  useEffect(() => { load() }, [load])

  const link = useMemo(() => `${window.location.origin}${window.location.pathname}#/photocard`, [])
  async function saveWin() {
    const { error } = await supabase.from('site_settings').upsert({ key: 'photocard', value: { start: win.start || '', end: win.end || '' }, updated_at: new Date().toISOString() })
    setMsg(error ? `হয়নি: ${error.message}` : 'তারিখ সংরক্ষিত হয়েছে।')
  }
  async function toggle(r) { await supabase.from('photocard_templates').update({ published: !r.published }).eq('id', r.id); load() }
  async function del(r) {
    if (!(await confirm({ name: r.title_bn || 'এই ডিজাইন', text: 'ডিজাইনটি মুছে ফেলবেন?' }))) return
    const { error } = await supabase.from('photocard_templates').delete().eq('id', r.id)
    if (error) return setMsg(`হয়নি: ${error.message}`)
    load()
  }
  const total = rows.reduce((a, r) => a + (r.made_count || 0), 0)

  if (edit) return <Editor init={edit} onDone={(cancel) => { setEdit(null); if (!cancel) load() }} />
  return (
    <>
      <h2>ফটোকার্ড (মাহফিল)</h2>
      <div className="card" style={{ marginBottom: 14, display: 'grid', gap: 10 }}>
        <div>
          <b>অবস্থা: </b>{modules.photocard === true ? <span className="tag">চালু</span> : <span className="tag">বন্ধ</span>}
          <span className="muted"> — চালু বা বন্ধ করতে "মডিউল সুইচ" পেজে "ফটোকার্ড (মাহফিল)" ব্যবহার করুন।</span>
        </div>
        <div className="grid g3">
          <div className="field"><label>স্বয়ংক্রিয় শুরু (ঐচ্ছিক)</label><input type="date" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} /></div>
          <div className="field"><label>স্বয়ংক্রিয় শেষ (ঐচ্ছিক, এই তারিখের পর বন্ধ)</label><input type="date" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} /></div>
        </div>
        <div className="row-actions"><button className="btn small" onClick={saveWin}>তারিখ সংরক্ষণ</button></div>
        {msg && <div className={`alert ${/হয়নি/.test(msg) ? 'err' : 'ok'}`}>{msg}</div>}
        <div className="field"><label>জনসাধারণের লিংক (শেয়ার করুন)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input readOnly value={link} style={{ flex: 1, minWidth: 200 }} onFocus={(e) => e.target.select()} /><button className="btn small outline" onClick={() => navigator.clipboard?.writeText(link)}>কপি</button></div>
        </div>
        <div className="muted">মোট কার্ড বানানো হয়েছে: <b>{bn(total)}</b> টি (নামহীন গণনা — কারও ছবি বা তথ্য জমা হয় না)</div>
        <div className="muted">পাতার লেখা বদলাতে "সাইটের লেখা" পেজের "ফটোকার্ড পাতা" অংশ দেখুন।</div>
      </div>
      <div className="row-actions" style={{ marginBottom: 12 }}><button className="btn" onClick={() => setEdit({ ...BLANK, sort: rows.length })}>+ নতুন ডিজাইন</button></div>
      <div className="grid g3">
        {rows.map((r) => (
          <div className="card" key={r.id} style={{ display: 'grid', gap: 8, opacity: r.published ? 1 : 0.6 }}>
            <div style={{ background: chess, lineHeight: 0, borderRadius: 8, overflow: 'hidden' }}><img src={r.image_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }} /></div>
            <div><b>{r.title_bn || 'নামহীন ডিজাইন'}</b> <span className="muted">· {r.width}×{r.height}</span></div>
            <div className="muted" style={{ fontSize: '.88rem' }}>বানানো হয়েছে: {bn(r.made_count)} টি {r.published ? '' : '· লুকানো'}</div>
            <div className="row-actions">
              <button className="btn small" onClick={() => setEdit(r)}>সম্পাদনা</button>
              <button className="btn small outline" onClick={() => toggle(r)}>{r.published ? 'লুকান' : 'দেখান'}</button>
              <button className="btn small outline" onClick={() => del(r)}>মুছুন</button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="muted">এখনো কোনো ডিজাইন নেই। "নতুন ডিজাইন" চেপে আপনার Photoshop-এর PNG আপলোড করুন।</div>}
      </div>
    </>
  )
}
