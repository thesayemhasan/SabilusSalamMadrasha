import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Ui'
import { fill, normPhone, segments, sendBatch } from '../lib/sms'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')

// rows: [{ student_id, name, phone, vars }] — পাঠানোর আগে প্রিভিউ ও খরচ দেখিয়ে নিশ্চিত করায়
export default function SmsSend({ kind, rows, onClose, title }) {
  const [tpl, setTpl] = useState(null)
  const [rate, setRate] = useState(0.5)
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState(null)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.from('sms_templates').select('*').eq('key', kind).maybeSingle().then(({ data }) => setTpl(data || false))
    supabase.from('sms_config').select('*').eq('key', 'rate').maybeSingle().then(({ data }) => { if (data) setRate(Number(data.value) || 0.5) })
  }, [kind])

  const withPhone = rows.filter((r) => normPhone(r.phone))
  const noPhone = rows.filter((r) => !normPhone(r.phone))
  const texts = tpl ? withPhone.map((r) => fill(tpl.body_bn, { name: r.name, ...(r.vars || {}) })) : []
  const segs = texts.reduce((a, t) => a + segments(t), 0)

  async function go() {
    setBusy(true); setErr(''); setRes(null)
    try {
      const r = await sendBatch(kind, withPhone.map((x) => ({ student_id: x.student_id, vars: x.vars || {} })), (a, b) => setProg(`${bn(a)} / ${bn(b)}`))
      setRes(r)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Modal onClose={busy ? () => {} : onClose} wide>
      <h3>{title}</h3>
      {tpl === null && <p>লোড হচ্ছে…</p>}
      {tpl === false && <div className="alert err">এই বার্তার টেমপ্লেট পাওয়া যায়নি। schema.sql চালানো হয়েছে কিনা দেখুন।</div>}
      {tpl && !tpl.enabled && <div className="alert err">এই বার্তাটি "এসএমএস" পাতায় বন্ধ আছে।</div>}
      {tpl && tpl.enabled && !res && (
        <>
          <p>
            <b>{bn(withPhone.length)}</b> জন অভিভাবককে পাঠানো হবে।
            {noPhone.length > 0 && <> <span style={{ color: 'var(--secondary)' }}>{bn(noPhone.length)} জনের মোবাইল নম্বর নেই বা ঠিক নয়, তাদের বাদ যাবে{noPhone.length <= 5 ? `: ${noPhone.map((r) => r.name).join(', ')}` : ''}।</span></>}
          </p>
          {texts[0] && (
            <div className="card" style={{ margin: '8px 0' }}>
              <div className="muted" style={{ fontSize: '.85rem' }}>নমুনা বার্তা ({withPhone[0].name}-এর জন্য):</div>
              <div style={{ marginTop: 4 }}>{texts[0]}</div>
            </div>
          )}
          {withPhone.length > 0 && <p>মোট প্রায় <b>{bn(segs)}</b> টি SMS (বাংলায় ৭০ অক্ষরে ১টি), আনুমানিক খরচ <b>৳ {(segs * rate).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}</b> (প্রতি SMS {bn(rate)} টাকা ধরে)। আগে পাঠানো হয়ে থাকলে ওই শিক্ষার্থীকে আবার যাবে না।</p>}
          {err && <div className="alert err">{err}</div>}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy || withPhone.length === 0} onClick={go}>{busy ? `পাঠানো হচ্ছে… ${prog || ''}` : `${bn(withPhone.length)} জনকে SMS পাঠান`}</button>
            <button className="btn outline" disabled={busy} onClick={onClose}>বাতিল</button>
          </div>
        </>
      )}
      {res && (
        <>
          <div className={`alert ${res.failed ? 'err' : 'ok'}`}>
            পাঠানো হয়েছে: <b>{bn(res.sent)}</b> · ব্যর্থ: <b>{bn(res.failed)}</b> · বাদ (আগে পাঠানো/নম্বর নেই): <b>{bn(res.skipped)}</b> · মোট SMS: <b>{bn(res.segments)}</b>
          </div>
          {res.failed > 0 && <p className="muted">ব্যর্থ বার্তার কারণ "এসএমএস" পাতার রেকর্ডে দেখুন।</p>}
          <button className="btn" onClick={onClose}>বন্ধ করুন</button>
        </>
      )}
    </Modal>
  )
}
