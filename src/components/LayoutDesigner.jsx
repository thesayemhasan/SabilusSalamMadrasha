import { useEffect, useRef, useState } from 'react'
import { useConfig } from '../lib/config'
import { Design, FIELD_SETS, TYPE_TITLE, defaultLayout, fieldKind, fieldLabel } from '../lib/layout'
import { ImageUpload, Select, Switch, useConfirm } from './Ui'

const snap = (v) => Math.round(v * 2) / 2
const uid = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const num = (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

// props: type = idcard_student | idcard_staff | admit | form; sample = পূর্বরূপের নমুনা তথ্য
export default function LayoutDesigner({ type, sample, layoutHook }) {
  const confirm = useConfirm()
  const { cfg: layout, setCfg: setLayout, save, ready } = layoutHook
  const [side, setSide] = useState('front')
  const [sel, setSel] = useState(null)
  const [px, setPx] = useState(0)
  const [msg, setMsg] = useState('')
  const drag = useRef(null)
  const box = useRef(null)
  const S = layout.sides[side] || { bg_url: '', els: [] }
  const el = S.els.find((e) => e.id === sel)

  useEffect(() => { if (!px && layout) setPx(Math.max(2, Math.min(9, Math.floor(560 / layout.size.w * 10) / 10))) }, [layout, px])
  useEffect(() => { setSel(null) }, [side, type])

  const patchSide = (fn) => setLayout((l) => {
    const n = JSON.parse(JSON.stringify(l))
    n.sides[side] = n.sides[side] || { bg_url: '', els: [] }
    fn(n.sides[side], n)
    return n
  })
  const patchEl = (id, p) => patchSide((s) => { const e = s.els.find((x) => x.id === id); if (e) Object.assign(e, p) })

  function onElDown(e, elm, mode) {
    e.preventDefault()
    e.stopPropagation()
    setSel(elm.id)
    drag.current = { id: elm.id, mode, sx: e.clientX, sy: e.clientY, ox: elm.x, oy: elm.y, ow: elm.w, oh: elm.h }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  function move(e) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / pxRef.current
    const dy = (e.clientY - d.sy) / pxRef.current
    if (d.mode === 'move') patchEl(d.id, { x: snap(d.ox + dx), y: snap(d.oy + dy) })
    else patchEl(d.id, { w: Math.max(1, snap(d.ow + dx)), h: Math.max(0.5, snap(d.oh + dy)) })
  }
  function up() {
    drag.current = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  const pxRef = useRef(px)
  pxRef.current = px
  useEffect(() => () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }, []) // eslint-disable-line

  function addField(key) {
    if (!key) return
    const k = fieldKind(type, key)
    const e = k === 'image'
      ? { id: uid(), kind: 'field', key, x: 5, y: 5, w: key === 'logo' ? 12 : 22, h: key === 'logo' ? 12 : 27, border: key !== 'logo' }
      : { id: uid(), kind: 'field', key, x: 5, y: 5, w: Math.min(60, layout.size.w - 10), h: k === 'multi' ? 20 : 6, size: 10, bold: false, align: 'left', color: '#000000', prefix: `${fieldLabel(type, key)}: `, underline: false, multi: k === 'multi' }
    patchSide((s) => s.els.push(e))
    setSel(e.id)
  }
  const addText = () => { const e = { id: uid(), kind: 'text', text: 'নতুন লেখা', x: 5, y: 5, w: 50, h: 6, size: 10, bold: false, align: 'left', color: '#000000' }; patchSide((s) => s.els.push(e)); setSel(e.id) }
  const addBox = () => { const e = { id: uid(), kind: 'box', x: 5, y: 5, w: 40, h: 0.3, border: 0, fill: '#000000', color: '#000000' }; patchSide((s) => s.els.push(e)); setSel(e.id) }
  const addImage = () => { const e = { id: uid(), kind: 'image', src: '', x: 5, y: 5, w: 20, h: 20 }; patchSide((s) => s.els.push(e)); setSel(e.id) }
  const del = () => { patchSide((s) => { s.els = s.els.filter((x) => x.id !== sel) }); setSel(null) }
  const dup = () => { if (!el) return; const c = { ...el, id: uid(), x: el.x + 3, y: el.y + 3 }; patchSide((s) => s.els.push(c)); setSel(c.id) }
  const order = (dir) => patchSide((s) => { const i = s.els.findIndex((x) => x.id === sel); const j = i + dir; if (i < 0 || j < 0 || j >= s.els.length) return; [s.els[i], s.els[j]] = [s.els[j], s.els[i]] })
  async function reset() {
    if (!(await confirm({ name: TYPE_TITLE[type], text: 'নকশা ডিফল্টে ফিরবে (আপনার সাজানো সব মুছে যাবে)। নিশ্চিত?', ok: 'হ্যাঁ, ডিফল্টে ফিরুন' }))) return
    setLayout(defaultLayout(type)); setSel(null)
  }
  async function doSave() { const e = await save(layout); setMsg(e ? `ত্রুটি: ${e.message}` : 'নকশা সংরক্ষিত হয়েছে') }
  if (!ready || !px) return <p>লোড হচ্ছে…</p>

  const kind = el?.kind === 'field' ? fieldKind(type, el.key) : null
  const isImgField = kind === 'image'
  return (
    <div>
      <div className="alert info" style={{ marginBottom: 12 }}>
        {type === 'receipt_pad'
          ? 'প্রেসের ছাপানো রসিদ-প্যাডের একটি পাতার স্ক্যান বা ফটো (A5) নিচের ব্যাকগ্রাউন্ডে দিন — এটি শুধু মেলানোর জন্য, প্রিন্টে আসবে না। তারপর নাম, তারিখ, টাকা ইত্যাদির বাক্স টেনে প্যাডের ঘরের ঠিক ওপরে বসান। যা ছাপতে চান না তা মুছে দিন, যা চান তা “তথ্য যোগ করুন” থেকে যোগ করুন। এখানে শুধু একটি (সামনের) পাশ।'
          : <>আপনার নিজের ব্ল্যাংক ডিজাইন ছবি আপলোড করুন, তারপর তথ্যের বাক্সগুলো মাউস/আঙুল দিয়ে টেনে ঠিক জায়গায় বসান। বাক্সের নিচের ডান কোণ টেনে মাপ বদলান। সামনে ও পেছন আলাদা সাজানো যায়। ছবির মাপ নকশার মাপের সাথে মিল রাখলে (যেমন {layout.size.w}×{layout.size.h} মিমি অনুপাত) সবচেয়ে ভালো আসে।</>}
      </div>
      <div className="ld-bar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={side === 'front' ? 'on' : ''} onClick={() => setSide('front')}>সামনের পাশ</button>
          {type !== 'receipt_pad' && <button className={side === 'back' ? 'on' : ''} onClick={() => setSide('back')}>পেছনের পাশ</button>}
        </div>
        <label className="ld-inline">মাপ (মিমি) প্রস্থ <input type="number" step="0.1" value={layout.size.w} onChange={(e) => setLayout({ ...layout, size: { ...layout.size, w: num(e.target.value) } })} style={{ width: 80 }} /> উচ্চতা <input type="number" step="0.1" value={layout.size.h} onChange={(e) => setLayout({ ...layout, size: { ...layout.size, h: num(e.target.value) } })} style={{ width: 80 }} /></label>
        <label className="ld-inline">জুম <input type="range" min="2" max="10" step="0.5" value={px} onChange={(e) => setPx(Number(e.target.value))} /></label>
      </div>
      <div className="ld-bar">
        <div style={{ minWidth: 220 }}><Select placeholder="+ তথ্য যোগ করুন" value="" onChange={addField} options={FIELD_SETS[type].map((f) => [f[0], f[1]])} /></div>
        <button className="btn small outline" onClick={addText}>+ নিজের লেখা</button>
        <button className="btn small outline" onClick={addImage}>+ ছবি (সিল/লোগো)</button>
        <button className="btn small outline" onClick={addBox}>+ রেখা / বাক্স</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
        <div className="ld-canvas" ref={box} onPointerDown={() => setSel(null)}>
          <Design layout={layout} side={side} data={sample} px={px} select={sel} onElDown={onElDown} />
        </div>
        <div className="card form ld-insp">
          <div className="field"><label>{type === 'receipt_pad' ? 'প্যাডের স্ক্যান/ছবি (মেলানোর জন্য)' : `${side === 'front' ? 'সামনের' : 'পেছনের'} ব্যাকগ্রাউন্ড (আপনার ব্ল্যাংক ডিজাইন)`}</label>
            <ImageUpload folder="designs" value={S.bg_url} onChange={(v) => patchSide((s) => { s.bg_url = v || '' })} />
          </div>
          {type === 'receipt_pad' && <label className="toggle-row"><Switch checked={layout.bg_noprint !== false} onChange={(v) => setLayout({ ...layout, bg_noprint: v })} /><span>প্রিন্টে ব্যাকগ্রাউন্ড ছাপবে না (প্যাডে আগে থেকেই ছাপা আছে)</span></label>}
          {!el && <p className="muted" style={{ margin: 0 }}>কোনো বাক্সে চাপুন ও টানুন। এখানে তার সেটিং আসবে।</p>}
          {el && (
            <>
              <h4 style={{ margin: 0 }}>{el.kind === 'field' ? fieldLabel(type, el.key) : el.kind === 'text' ? 'নিজের লেখা' : el.kind === 'image' ? 'ছবি' : 'রেখা / বাক্স'}</h4>
              {el.kind === 'text' && <div className="field"><label>লেখা</label><textarea rows={2} value={el.text} onChange={(e) => patchEl(el.id, { text: e.target.value })} /></div>}
              {el.kind === 'image' && <div className="field"><label>ছবি</label><ImageUpload folder="designs" value={el.src} onChange={(v) => patchEl(el.id, { src: v || '' })} /></div>}
              {el.kind === 'field' && !isImgField && <div className="field"><label>তথ্যের আগে যে লেখা বসবে</label><input value={el.prefix || ''} onChange={(e) => patchEl(el.id, { prefix: e.target.value })} /></div>}
              <div className="grid g2">
                {['x', 'y', 'w', 'h'].map((k) => <div className="field" key={k}><label>{{ x: 'বাঁ থেকে', y: 'উপর থেকে', w: 'প্রস্থ', h: 'উচ্চতা' }[k]} (মিমি)</label><input type="number" step="0.5" value={el[k]} onChange={(e) => patchEl(el.id, { [k]: num(e.target.value) })} /></div>)}
              </div>
              {(el.kind === 'field' && !isImgField || el.kind === 'text') && (
                <>
                  <div className="grid g2">
                    <div className="field"><label>লেখার মাপ (pt)</label><input type="number" step="0.5" min="4" value={el.size || 9} onChange={(e) => patchEl(el.id, { size: num(e.target.value) })} /></div>
                    <div className="field"><label>রং</label><input type="color" value={el.color || '#000000'} onChange={(e) => patchEl(el.id, { color: e.target.value })} /></div>
                  </div>
                  <div className="field"><label>সাজানো</label><Select value={el.align || 'left'} onChange={(v) => patchEl(el.id, { align: v })} options={[['left', 'বামে'], ['center', 'মাঝে'], ['right', 'ডানে']]} /></div>
                  <label className="toggle-row"><Switch checked={!!el.bold} onChange={(v) => patchEl(el.id, { bold: v })} /><span>বোল্ড</span></label>
                  {el.kind === 'field' && <label className="toggle-row"><Switch checked={!!el.underline} onChange={(v) => patchEl(el.id, { underline: v })} /><span>নিচে ডটেড লাইন (হাতে লেখার ফাঁকা ঘর)</span></label>}
                  {el.multi && <div className="field"><label>লাইনের ফাঁক (মিমি) — প্যাডের ঘরের মাপ অনুযায়ী</label><input type="number" step="0.1" min="0" value={el.lh || ''} placeholder="অটো" onChange={(e) => patchEl(el.id, { lh: num(e.target.value) || undefined })} /></div>}
                  {el.kind === 'field' && <label className="toggle-row"><Switch checked={!!el.multi} onChange={(v) => patchEl(el.id, { multi: v })} /><span>একাধিক লাইন</span></label>}
                </>
              )}
              {el.kind === 'field' && isImgField && <label className="toggle-row"><Switch checked={!!el.border} onChange={(v) => patchEl(el.id, { border: v })} /><span>বর্ডার</span></label>}
              {el.kind === 'box' && (
                <>
                  <div className="grid g2">
                    <div className="field"><label>ভরাট রং</label><input type="color" value={el.fill || '#ffffff'} onChange={(e) => patchEl(el.id, { fill: e.target.value })} /></div>
                    <div className="field"><label>বর্ডার (মিমি)</label><input type="number" step="0.1" min="0" value={el.border || 0} onChange={(e) => patchEl(el.id, { border: num(e.target.value) })} /></div>
                  </div>
                  <button className="btn small outline" onClick={() => patchEl(el.id, { fill: '' })}>ভরাট ছাড়া (শুধু বর্ডার)</button>
                </>
              )}
              <div className="row-actions">
                <button className="btn small outline" onClick={dup}>কপি</button>
                <button className="btn small outline" onClick={() => order(1)}>উপরে আনুন</button>
                <button className="btn small outline" onClick={() => order(-1)}>নিচে নিন</button>
                <button className="btn small danger" onClick={del}>মুছুন</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="row-actions" style={{ marginTop: 14 }}>
        <button className="btn" onClick={doSave}>নকশা সংরক্ষণ</button>
        <button className="btn outline" onClick={reset}>ডিফল্টে ফিরুন</button>
      </div>
      {msg && <div className="alert info" style={{ marginTop: 10 }}>{msg}</div>}
      {type !== 'receipt_pad' && <p className="muted">প্রিন্টের পাশ (সামনে/পেছনে/দুই পাশ) প্রিন্টের ট্যাবে বেছে নেওয়া যায়।</p>}
    </div>
  )
}

export function useLayout(type) {
  return useConfig(`layout_${type}`, defaultLayout(type))
}
