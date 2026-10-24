import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import { Modal } from '../../components/Ui'
import Icon from '../../components/Icon'

export const num = (n) => Number(n || 0)
export const taka = (n) => `৳ ${Math.round(num(n)).toLocaleString('bn-BD')}`
export const nm = (r) => (r ? r.name_bn || r.name_en || '(নামহীন)' : '—')
export const pad = (n) => String(n).padStart(2, '0')
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const monthStr = () => todayStr().slice(0, 7)
export const monthName = (ym) => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })
}
export const dateBn = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

const FALLBACK = [['cash', 'হাতে নগদ'], ['bkash', 'বিকাশ'], ['nagad', 'নগদ (Nagad)'], ['bank', 'ব্যাংক']]
// পেমেন্ট মাধ্যম (অ্যাডমিন যোগ/বাদ দিতে পারে) + শুরুর জমা
export function useMethods() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    supabase.from('lookups').select('*').eq('kind', 'method').order('sort', { ascending: true }).then(({ data }) => setRows((data || []).filter((r) => r.published !== false)))
  }, [])
  const list = rows.length ? rows.map((r) => [r.code || r.id, nm(r)]) : FALLBACK
  const open = Object.fromEntries(rows.map((r) => [r.code || r.id, num(r.opening)]))
  const label = (c) => (list.find((x) => x[0] === c) || [])[1] || c || '—'
  return { list, open, label }
}

// প্রিন্টযোগ্য রসিদ / পে-স্লিপ
export function PrintDoc({ title, no, date, rows, total, meta = [], footNote, onClose }) {
  const { settings, t } = useSite()
  return (
    <Modal onClose={onClose} wide>
      <div className="print-area receipt">
        <div className="rc-head">
          {settings.logo_url && <img src={settings.logo_url} alt="" />}
          <div>
            <h3>{t('site.name') || 'সাবিলুস সালাম মাদরাসা'}</h3>
            <div className="muted">{t('site.address')}{settings.phone ? ` · ${settings.phone}` : ''}</div>
          </div>
        </div>
        <div className="rc-title"><b>{title}</b>{no && <span>নং: {no}</span>}<span>তারিখ: {dateBn(date)}</span></div>
        {meta.length > 0 && <div className="rc-meta">{meta.map(([k, v]) => v ? <div key={k}><span className="muted">{k}:</span> <b>{v}</b></div> : null)}</div>}
        <table>
          <thead><tr><th>বিবরণ</th><th style={{ textAlign: 'end' }}>টাকা</th></tr></thead>
          <tbody>
            {rows.map(([a, b], i) => <tr key={i}><td>{a}</td><td style={{ textAlign: 'end' }}>{taka(b)}</td></tr>)}
            <tr className="rc-total"><td>মোট</td><td style={{ textAlign: 'end' }}>{taka(total)}</td></tr>
          </tbody>
        </table>
        {footNote && <p className="muted" style={{ marginBottom: 0 }}>{footNote}</p>}
        <div className="rc-sign"><span>গ্রহীতার স্বাক্ষর</span><span>কর্তৃপক্ষের স্বাক্ষর</span></div>
      </div>
      <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn outline" onClick={onClose}>বন্ধ করুন</button>
        <button className="btn" onClick={() => window.print()}><Icon name="printer" size={17} cls="cur" /> প্রিন্ট / PDF</button>
      </div>
    </Modal>
  )
}

// কারণ লিখে বাতিল করার পপআপ
export function VoidDialog({ name, onClose, onDone }) {
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal onClose={onClose}>
      <h3>এন্ট্রি বাতিল</h3>
      <p><b>{name}</b> বাতিল করবেন? বাতিল করলে এটি আর হিসাবে ধরা হবে না এবং ফিরিয়ে আনা যাবে না। এন্ট্রিটি লগে থেকে যাবে।</p>
      <div className="field"><label>বাতিলের কারণ *</label><textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="যেমন: ভুল ছাত্রের নামে ধরা হয়েছিল" /></div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn outline" onClick={onClose}>না, থাক</button>
        <button className="btn danger" disabled={busy || why.trim().length < 3} onClick={async () => { setBusy(true); await onDone(why.trim()); setBusy(false) }}>হ্যাঁ, বাতিল করুন</button>
      </div>
    </Modal>
  )
}

export const voidPatch = (why) => ({ void: true, void_reason: why, voided_at: new Date().toISOString() })
export const addDays = (s, d) => { const x = new Date(`${s}T00:00:00`); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
