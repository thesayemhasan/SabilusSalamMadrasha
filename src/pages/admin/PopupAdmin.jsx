import { useEffect, useState } from 'react'
import { supabase, uploadImage } from '../../lib/supabase'
import { Select, Switch } from '../../components/Ui'
import { packDesign } from '../../lib/photocard'

const BLANK = { enabled: false, image_url: '', alt: '', link_kind: '', link_url: '', button_text: '', start: '', end: '', frequency: 'session' }

// সাইট খুললে ছবির পপআপ: ছবি আপলোড, কবে থেকে কবে, কতবার দেখাবে
export default function PopupAdmin() {
  const [v, setV] = useState(BLANK)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [prev, setPrev] = useState(false)
  const set = (p) => setV((x) => ({ ...x, ...p }))

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'popup').maybeSingle().then(({ data }) => setV({ ...BLANK, ...(data?.value || {}) }))
  }, [])

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true); setMsg('')
    try {
      const pk = await packDesign(f, 1400)
      set({ image_url: await uploadImage(pk.file, 'popup') })
    } catch (er) { setMsg(`আপলোড হয়নি: ${er.message}`) }
    setBusy(false)
  }
  async function save(next = v) {
    setBusy(true); setMsg('')
    const { error } = await supabase.from('site_settings').upsert({ key: 'popup', value: next, updated_at: new Date().toISOString() })
    setBusy(false)
    setMsg(error ? `সংরক্ষণ হয়নি: ${error.message}` : 'সংরক্ষিত হয়েছে। পপআপ এখন সাইটে এই সেটিং অনুযায়ী দেখাবে।')
  }

  return (
    <>
      <h2>সাইট পপআপ</h2>
      <div className="card form" style={{ display: 'grid', gap: 12 }}>
        <p className="muted" style={{ margin: 0 }}>সাইট খুললে এই ছবিটি পপআপ হিসেবে আসবে। ক্রস (✕) চিহ্নে বা ছবির বাইরে চাপলে সাইট দেখা যাবে। যেমন মাহফিলের পোস্টার।</p>
        <div className="mod-row" style={{ borderBottom: 0 }}>
          <b>পপআপ {v.enabled ? 'চালু' : 'বন্ধ'} আছে</b>
          <Switch checked={!!v.enabled} onChange={(x) => { const n = { ...v, enabled: x }; setV(n); save(n) }} />
        </div>
        <div className="field">
          <label>পপআপের ছবি</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={busy} />
          <p className="muted" style={{ fontSize: '.85rem', margin: '4px 0 0' }}>চৌকো বা লম্বা পোস্টার ভালো। ছবি নিজে থেকে হালকা করে রাখা হয়।</p>
        </div>
        {v.image_url && <img src={v.image_url} alt="" style={{ maxWidth: 260, maxHeight: 300, borderRadius: 10, objectFit: 'contain' }} />}
        <div className="grid g2">
          <div className="field"><label>ছবিতে চাপলে কোথায় যাবে</label><Select value={v.link_kind} onChange={(x) => set({ link_kind: x })} options={[['', 'কোথাও নয় (শুধু ছবি)'], ['photocard', 'ফটোকার্ড বানানোর পাতা (ফটোকার্ড চালু থাকলে)'], ['link', 'অন্য লিংক']]} /></div>
          {v.link_kind === 'link' && <div className="field"><label>লিংক (https://… বা /events)</label><input value={v.link_url} onChange={(e) => set({ link_url: e.target.value })} /></div>}
        </div>
        {v.link_kind && <div className="field"><label>ছবির নিচের বাটনের লেখা (ফাঁকা রাখলে নিজে বসবে)</label><input value={v.button_text} onChange={(e) => set({ button_text: e.target.value })} /></div>}
        <div className="grid g3">
          <div className="field"><label>শুরুর তারিখ (ঐচ্ছিক)</label><input type="date" value={v.start} onChange={(e) => set({ start: e.target.value })} /></div>
          <div className="field"><label>শেষ তারিখ (ঐচ্ছিক, এরপর আর আসবে না)</label><input type="date" value={v.end} onChange={(e) => set({ end: e.target.value })} /></div>
          <div className="field"><label>কতবার দেখাবে</label><Select value={v.frequency} onChange={(x) => set({ frequency: x })} options={[['session', 'প্রতি দর্শকের একবার (ব্রাউজার বন্ধ করলে আবার)'], ['daily', 'দিনে একবার'], ['always', 'সাইট খুললেই প্রতিবার']]} /></div>
        </div>
        <div className="field"><label>ছবির বিবরণ (দৃষ্টিহীনদের জন্য, ঐচ্ছিক)</label><input value={v.alt} onChange={(e) => set({ alt: e.target.value })} /></div>
        {msg && <div className={`alert ${/হয়নি/.test(msg) ? 'err' : 'ok'}`}>{msg}</div>}
        <div className="row-actions">
          <button className="btn" disabled={busy} onClick={() => save()}>সংরক্ষণ</button>
          <button className="btn outline" disabled={!v.image_url} onClick={() => setPrev(true)}>প্রিভিউ</button>
        </div>
        <p className="muted" style={{ fontSize: '.85rem', margin: 0 }}>পপআপ বন্ধ করতে উপরের সুইচ বন্ধ করুন। সুইচে এক চাপেই সংরক্ষণ হয়ে যায়।</p>
      </div>
      {prev && (
        <div role="dialog" onClick={() => setPrev(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,12,30,.72)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ position: 'relative', maxWidth: 'min(92vw, 640px)' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="বন্ধ" onClick={() => setPrev(false)} style={{ position: 'absolute', top: -14, right: -14, width: 38, height: 38, borderRadius: 19, border: '2px solid #fff', background: '#e5007d', color: '#fff', cursor: 'pointer', zIndex: 2, fontSize: 18 }}>✕</button>
            <img src={v.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 14, background: '#fff' }} />
          </div>
        </div>
      )}
    </>
  )
}
