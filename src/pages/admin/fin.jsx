import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth, useSite } from '../../lib/store'
import { Modal } from '../../components/Ui'
import Icon from '../../components/Icon'
import { useConfig, RECEIPT_DEFAULTS } from '../../lib/config'
import { Design, defaultLayout } from '../../lib/layout'

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

// একটি অংশ আলাদা করে ঠিক একটি পাতায় প্রিন্ট (A5 রসিদ / A4 রিপোর্ট)
export function printNode(node, size = 'A5', margin = '8mm', orient = 'portrait') {
  if (!node) return
  let root = document.getElementById('print-root')
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root) }
  root.innerHTML = node.outerHTML
  let st = document.getElementById('print-page')
  if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st) }
  st.textContent = `@page { size: ${size} ${orient}; margin: ${margin}; }`
  document.body.classList.add('printing')
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  setTimeout(() => window.print(), 60)
}

export const printedAt = () => new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })

// প্রিন্টযোগ্য রসিদ / পে-স্লিপ (A5)। শিরোনাম রসিদের ধরন (kind) অনুযায়ী নিজে বসে; লেখা ও লে-আউট "রসিদের লেখা ও ডিজাইন" থেকে বদলানো যায়।
// দুই মোড: online = ওয়েবসাইটের পূর্ণ ডিজাইন; pad = প্রেসের ছাপানো A5 প্যাডে শুধু তথ্য।
// প্যাড-নকশার জন্য তথ্য: নকশার প্রতিটি ঘরে কী বসবে
export const bnNum = (n) => Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })
export function padData({ cfg, kind = 'fee', titleSuffix, title, no, date, rows = [], total, meta = [], footNote, by }) {
  const L = cfg.labels
  const d = {
    title: title || `${cfg.titles[kind] || cfg.titles.fee}${titleSuffix ? ` — ${titleSuffix}` : ''}`,
    no: no || '', date: date ? dateBn(date) : '',
    meta: meta.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'),
    items_desc: rows.map(([a]) => a).join('\n'), items_amt: rows.map(([, b]) => bnNum(b)).join('\n'),
    total: bnNum(total), note: footNote || cfg.note || '', printed_by: `${L.printed_by}: ${by || ''} · ${printedAt()}`,
  }
  meta.forEach(([k, v]) => { if (v) d[`meta_${k}`] = v })
  return d
}

export function ReceiptBody({ cfg, mode, kind = 'fee', titleSuffix, title, no, date, rows, total, meta = [], footNote, by, hdr }) {
  const L = cfg.labels
  const ttl = title || `${cfg.titles[kind] || cfg.titles.fee}${titleSuffix ? ` — ${titleSuffix}` : ''}`
  if (mode === 'pad') {
    const mm = Math.round(cfg.margin_in * 25.4 * 10) / 10
    const B = cfg.pad.blocks
    const pos = (k) => ({ position: 'absolute', left: `${B[k].x + cfg.pad.dx}mm`, top: `${B[k].y + cfg.pad.dy}mm`, width: `${B[k].w}mm` })
    return (
      <div className="receipt pad" style={{ position: 'relative', width: `${148 - 2 * mm}mm`, height: `${210 - 2 * mm - 1}mm`, fontSize: `${cfg.font_pt}pt`, overflow: 'hidden' }}>
        {B.title.show && <div style={{ ...pos('title'), fontWeight: 700, fontSize: '1.15em' }}>{ttl}</div>}
        {B.no.show && no && <div style={pos('no')}>{L.no}: <b>{no}</b></div>}
        {B.date.show && <div style={pos('date')}>{L.date}: <b>{dateBn(date)}</b></div>}
        {B.meta.show && meta.length > 0 && <div style={pos('meta')}>{meta.map(([k, v]) => (v ? <div key={k}>{k}: <b>{v}</b></div> : null))}</div>}
        {B.items.show && (
          <div style={pos('items')}>
            {rows.map(([a, b], i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{a}</span><span>{taka(b)}</span></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700, marginTop: 4 }}><span>{L.total}</span><span>{taka(total)}</span></div>
            {(footNote || cfg.note) && <div style={{ marginTop: 6, fontSize: '.85em' }}>{footNote || cfg.note}</div>}
          </div>
        )}
        {B.by.show && cfg.show_printed_by && <div style={{ ...pos('by'), fontSize: '.8em' }}>{L.printed_by}: <b>{by}</b> · {printedAt()}</div>}
      </div>
    )
  }
  return (
    <div className="receipt" style={{ fontSize: `${cfg.font_pt}pt` }}>
      <div className="rc-head">
        {hdr.logo && <img src={hdr.logo} alt="" />}
        <div>
          <h3>{hdr.name}</h3>
          <div className="muted">{hdr.addr}</div>
        </div>
      </div>
      <div className="rc-title"><b>{ttl}</b>{no && <span>{L.no}: {no}</span>}<span>{L.date}: {dateBn(date)}</span></div>
      {meta.length > 0 && <div className="rc-meta">{meta.map(([k, v]) => v ? <div key={k}><span className="muted">{k}:</span> <b>{v}</b></div> : null)}</div>}
      <table>
        <thead><tr><th>{L.desc}</th><th style={{ textAlign: 'end' }}>{L.amount}</th></tr></thead>
        <tbody>
          {rows.map(([a, b], i) => <tr key={i}><td>{a}</td><td style={{ textAlign: 'end' }}>{taka(b)}</td></tr>)}
          <tr className="rc-total"><td>{L.total}</td><td style={{ textAlign: 'end' }}>{taka(total)}</td></tr>
        </tbody>
      </table>
      {(footNote || cfg.note) && <p className="muted" style={{ marginBottom: 0 }}>{footNote || cfg.note}</p>}
      <div className="rc-sign"><span>{L.receiver}</span><span>{L.authority}</span></div>
      {cfg.show_printed_by && <div className="rc-by">{L.printed_by}: <b>{by}</b> · {printedAt()}</div>}
    </div>
  )
}

export function PrintDoc({ kind = 'fee', title, titleSuffix, no, date, rows, total, meta = [], footNote, onClose }) {
  const { settings, t, modules } = useSite()
  const { profile, session } = useAuth()
  const { cfg } = useConfig('receipt', RECEIPT_DEFAULTS)
  const padHook = useConfig('receipt_layout_pad', defaultLayout('receipt_pad'))
  const [nudge, setNudge] = useState(null)
  const [nmsg, setNmsg] = useState('')
  const onlineOn = modules.receipt_online !== false
  const padOn = modules.receipt_pad !== false
  const [mode, setMode] = useState(onlineOn ? 'online' : 'pad')
  const ref = useRef(null)
  const by = (profile && (profile.full_name || profile.email)) || session?.user?.email || ''
  const hdr = { logo: settings.logo_url, name: t('site.name') || 'সাবিলুস সালাম মাদরাসা', addr: `${t('site.address')}${settings.phone ? ` · ${settings.phone}` : ''}` }
  const shown = mode === 'pad' && padOn ? 'pad' : 'online'
  return (
    <Modal onClose={onClose} wide>
      {onlineOn && padOn && (
        <div className="tabs no-print">
          <button className={shown === 'online' ? 'on' : ''} onClick={() => setMode('online')}>অনলাইন রসিদ (পূর্ণ ডিজাইন)</button>
          <button className={shown === 'pad' ? 'on' : ''} onClick={() => setMode('pad')}>প্যাডে প্রিন্ট (শুধু তথ্য)</button>
        </div>
      )}
      <div ref={ref} className={shown === 'pad' ? 'pad-wrap' : ''}>
        {shown === 'pad' ? (
          <div className="pad-sheet" style={{ position: 'relative', width: `${padHook.cfg.size.w}mm`, height: `${padHook.cfg.size.h - 0.6}mm`, overflow: 'hidden', background: '#fff' }}>
            <Design layout={padHook.cfg} side="front" data={padData({ cfg, kind, titleSuffix, title, no, date, rows, total, meta, footNote, by })} shift={nudge || padHook.cfg.nudge} />
          </div>
        ) : <ReceiptBody cfg={cfg} mode={shown} kind={kind} title={title} titleSuffix={titleSuffix} no={no} date={date} rows={rows} total={total} meta={meta} footNote={footNote} by={by} hdr={hdr} />}
      </div>
      {shown === 'pad' && (
        <div className="no-print" style={{ marginTop: 8 }}>
          <p className="muted" style={{ margin: '0 0 8px' }}>প্রেসের ছাপানো A5 প্যাডের কাগজ প্রিন্টারে দিন। লেখা সামান্য উপর-নিচ/ডানে-বামে হলে নিচের ঘরে মিলিমিটার দিয়ে সরান (বামে/উপরে সরাতে মাইনাস লিখুন)। পুরো ডিজাইন বদলাতে “রসিদের লেখা ও ডিজাইন → প্যাড ডিজাইনার”-এ যান।</p>
          <div className="row-actions" style={{ alignItems: 'end' }}>
            {['dx', 'dy'].map((k) => (
              <div className="field" key={k} style={{ margin: 0 }}><label>{k === 'dx' ? 'ডানে সরান (মিমি)' : 'নিচে সরান (মিমি)'}</label>
                <input type="number" step="0.5" style={{ width: 110 }} value={(nudge || padHook.cfg.nudge || {})[k] ?? 0} onChange={(e) => setNudge({ dx: 0, dy: 0, ...(nudge || padHook.cfg.nudge || {}), [k]: e.target.value === '' ? 0 : Number(e.target.value) })} /></div>
            ))}
            <button className="btn small outline" disabled={!nudge} onClick={async () => { const er = await padHook.save({ ...padHook.cfg, nudge }); setNmsg(er ? `সংরক্ষণ হয়নি: ${er.message}` : 'এই মাপ সবসময়ের জন্য সংরক্ষিত হয়েছে') }}>এই মাপ সংরক্ষণ</button>
          </div>
          {nmsg && <div className="alert info" style={{ marginTop: 8 }}>{nmsg}</div>}
        </div>
      )}
      <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn outline" onClick={onClose}>বন্ধ করুন</button>
        <button className="btn" onClick={() => printNode(ref.current.firstElementChild, 'A5', shown === 'pad' ? '0mm' : `${cfg.margin_in}in`)}><Icon name="printer" size={17} cls="cur" /> প্রিন্ট / PDF (A5)</button>
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
