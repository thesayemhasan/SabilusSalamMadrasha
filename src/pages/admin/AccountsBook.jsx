import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { Modal, Select } from '../../components/Ui'
import { downloadCsv } from './Crud'
import { dateBn, nm, num, taka, todayStr, addDays, printNode, printedAt } from './fin'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const METHOD = { cash: 'নগদ', bank: 'ব্যাংক', bkash: 'বিকাশ', nagad: 'নগদ (মোবাইল)', mobile: 'মোবাইল ব্যাংকিং' }
const mt = (m) => METHOD[m] || m || ''
const th = { border: '1px solid #444', padding: '4px 6px', textAlign: 'start', background: '#eee' }
const td = { border: '1px solid #444', padding: '4px 6px' }

// সব উৎস থেকে একই ছাঁচের লেনদেন: { key, date, no, kind: 'in'|'out', head, who, note, amount, method, type }
async function loadEntries(from, to) {
  const rng = (q, col) => q.gte(col, from).lte(col, to)
  const [led, pay, sal, adv, stf] = await Promise.all([
    fetchAll((a, b) => rng(supabase.from('ledger').select('*'), 'date').order('date').order('id').range(a, b)),
    fetchAll((a, b) => rng(supabase.from('payments').select('*'), 'paid_at').order('paid_at').order('id').range(a, b)),
    fetchAll((a, b) => rng(supabase.from('salary_payments').select('*'), 'paid_at').order('paid_at').order('id').range(a, b)),
    fetchAll((a, b) => rng(supabase.from('staff_advances').select('*'), 'date').order('date').order('id').range(a, b)),
    fetchAll((a, b) => supabase.from('staff').select('id,name_bn,name_en').order('id').range(a, b)),
  ])
  const sn = Object.fromEntries((stf.data || []).map((s) => [s.id, nm(s)]))
  const out = []
  ;(led.data || []).filter((r) => !r.void).forEach((r) => out.push({
    key: `l${r.id}`, src: 'ledger', row: r, date: r.date, no: `${r.kind === 'income' ? 'প্রা' : 'প'}-${r.voucher_serial}`, kind: r.kind === 'income' ? 'in' : 'out',
    head: r.category_name || (r.kind === 'income' ? 'আয়' : 'ব্যয়'), who: r.party || '', note: r.note || '', amount: num(r.amount), method: r.method,
  }))
  ;(pay.data || []).filter((r) => !r.void).forEach((r) => out.push({
    key: `p${r.id}`, src: 'fee', row: r, date: r.paid_at, no: `রসিদ ${r.receipt_no || ''}`.trim(), kind: 'in', head: 'ফি আদায়', who: r.payer || '', note: r.note || '', amount: num(r.amount), method: r.method,
  }))
  ;(sal.data || []).filter((r) => !r.void).forEach((r) => out.push({
    key: `s${r.id}`, src: 'salary', row: r, date: r.paid_at, no: `প-বে-${r.voucher_serial}`, kind: 'out', head: 'বেতন', who: sn[r.staff_id] || '', note: `মাস ${r.period}${r.note ? ` — ${r.note}` : ''}`, amount: num(r.net), method: r.method,
  }))
  ;(adv.data || []).filter((r) => !r.void).forEach((r) => out.push({
    key: `a${r.id}`, src: 'advance', row: r, date: r.date, no: `প-অ-${r.voucher_serial}`, kind: 'out', head: 'কর্মচারী অগ্রিম', who: sn[r.staff_id] || '', note: r.note || '', amount: num(r.amount), method: r.method,
  }))
  out.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.key).localeCompare(String(b.key)))
  return out
}

function VoucherView({ e, onClose }) {
  const { settings, t } = useSite()
  const ref = useRef(null)
  const income = e.kind === 'in'
  const sign = income ? ['প্রস্তুতকারী', 'হিসাবরক্ষক', 'অনুমোদনকারী', 'প্রদানকারী'] : ['প্রস্তুতকারী', 'হিসাবরক্ষক', 'অনুমোদনকারী', 'গ্রহীতা']
  return (
    <Modal onClose={onClose} wide>
      <div className="no-print" style={{ marginBottom: 10 }}><button className="btn" onClick={() => printNode(ref.current, 'A4', '12mm', 'portrait')}>প্রিন্ট (A4)</button></div>
      <div className="adm-scroll"><div ref={ref} style={{ background: '#fff', color: '#000', padding: 18, minWidth: 560, border: '1px solid #999' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', borderBottom: '2px solid #000', paddingBottom: 8 }}>
          {settings.logo_url && <img src={settings.logo_url} alt="" style={{ width: 54, height: 54, objectFit: 'contain' }} />}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{t('site.name') || 'সাবিলুস সালাম মাদরাসা'}</div>
            <div style={{ fontSize: '.85rem' }}>{t('site.address')}</div>
          </div>
        </div>
        <h3 style={{ textAlign: 'center', margin: '12px 0' }}><span style={{ border: '1px solid #000', padding: '3px 18px' }}>{income ? 'প্রাপ্তি ভাউচার' : 'পেমেন্ট ভাউচার'}</span></h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>ভাউচার নং: <b>{e.no}</b></span><span>তারিখ: <b>{dateBn(e.date)}</b></span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ ...td, width: '30%', background: '#f4f4f4' }}>{income ? 'যার কাছ থেকে প্রাপ্ত' : 'যাকে প্রদান'}</td><td style={td}>{e.who || '—'}</td></tr>
            <tr><td style={{ ...td, background: '#f4f4f4' }}>খাত</td><td style={td}>{e.head}</td></tr>
            <tr><td style={{ ...td, background: '#f4f4f4' }}>বিবরণ</td><td style={{ ...td, height: 46, verticalAlign: 'top' }}>{e.note}</td></tr>
            <tr><td style={{ ...td, background: '#f4f4f4' }}>পরিশোধের মাধ্যম</td><td style={td}>{mt(e.method)}</td></tr>
            <tr><td style={{ ...td, background: '#f4f4f4' }}><b>টাকার পরিমাণ</b></td><td style={{ ...td, fontSize: '1.15rem' }}><b>{taka(e.amount)}</b></td></tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 56, gap: 8, fontSize: '.9rem' }}>
          {sign.map((s) => <div key={s} style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #000', paddingTop: 4 }}>{s}</div>)}
        </div>
        <div style={{ marginTop: 12, fontSize: '.75rem', color: '#555' }}>প্রিন্টের সময়: {printedAt()}</div>
      </div></div>
    </Modal>
  )
}

export default function AccountsBook() {
  const [tab, setTab] = useState('voucher')
  const [from, setFrom] = useState(addDays(todayStr(), -29))
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [before, setBefore] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [head, setHead] = useState('')
  const [view, setView] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    loadEntries(from, to).then((r) => { if (live) { setRows(r); setLoading(false) } })
    // খতিয়ানের শুরুর জের: নির্বাচিত সময়ের আগের সব লেনদেন
    if (tab === 'ledger') loadEntries('2000-01-01', addDays(from, -1)).then((r) => { if (live) setBefore(r) })
    return () => { live = false }
  }, [from, to, tab])

  const heads = useMemo(() => [...new Set(rows.map((r) => r.head))].sort(), [rows])
  const vouchers = useMemo(() => {
    const k = q.trim().toLowerCase()
    return rows.filter((r) => r.src !== 'fee' && (!kind || r.kind === kind) && (!k || `${r.who} ${r.head} ${r.note} ${r.no}`.toLowerCase().includes(k)))
  }, [rows, kind, q])

  // খতিয়ান: নির্বাচিত খাত (ফাঁকা = ক্যাশ বই, সব খাত)
  const led = useMemo(() => {
    const pick = (r) => !head || r.head === head
    const open = before.filter(pick).reduce((a, r) => a + (r.kind === 'in' ? r.amount : -r.amount), 0)
    let run = open
    const list = rows.filter(pick).map((r) => { run += r.kind === 'in' ? r.amount : -r.amount; return { ...r, run } })
    return { open, list, close: run, inn: list.filter((r) => r.kind === 'in').reduce((a, r) => a + r.amount, 0), outt: list.filter((r) => r.kind === 'out').reduce((a, r) => a + r.amount, 0) }
  }, [rows, before, head])

  const dateBox = (
    <div className="grid g3" style={{ marginBottom: 12 }}>
      <div className="field"><label>শুরুর তারিখ</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="field"><label>শেষ তারিখ</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    </div>
  )

  return (
    <>
      <h2>ভাউচার ও খতিয়ান</h2>
      <div className="tabs">
        <button className={tab === 'voucher' ? 'on' : ''} onClick={() => setTab('voucher')}>ভাউচার</button>
        <button className={tab === 'ledger' ? 'on' : ''} onClick={() => setTab('ledger')}>খতিয়ান / ক্যাশ বই</button>
      </div>
      {dateBox}
      {loading && <p className="muted">লোড হচ্ছে…</p>}

      {tab === 'voucher' && (
        <>
          <div className="grid g3" style={{ marginBottom: 12 }}>
            <div className="field"><label>খুঁজুন</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম, খাত বা নোট" /></div>
            <div className="field"><label>ধরন</label><Select value={kind} onChange={setKind} options={[['', 'সব'], ['in', 'প্রাপ্তি (আয়)'], ['out', 'পেমেন্ট (ব্যয়)']]} /></div>
          </div>
          <p className="muted" style={{ marginTop: -4 }}>আয়-ব্যয়, বেতন ও অগ্রিমের প্রতিটি লেনদেনের ভাউচার এখানে প্রিন্ট করা যায়। ফি আদায়ের জন্য রসিদ আলাদাভাবে ফি পেজ থেকে হয়।</p>
          <div className="table-wrap"><table>
            <thead><tr><th>নং</th><th>তারিখ</th><th>খাত</th><th>নাম</th><th>টাকা</th><th></th></tr></thead>
            <tbody>
              {vouchers.map((r) => (
                <tr key={r.key}>
                  <td>{r.no}</td><td>{dateBn(r.date)}</td><td>{r.head}</td><td>{r.who}</td>
                  <td style={{ color: r.kind === 'in' ? 'var(--primary)' : undefined }}>{r.kind === 'in' ? '+' : '−'}{taka(r.amount)}</td>
                  <td><button className="btn small outline" onClick={() => setView(r)}>ভাউচার</button></td>
                </tr>
              ))}
              {!vouchers.length && <tr><td colSpan={6} className="muted">এই সময়ে কোনো লেনদেন নেই।</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'ledger' && (
        <>
          <div className="field" style={{ maxWidth: 320 }}><label>খাত (ফাঁকা = সব খাত মিলিয়ে ক্যাশ বই)</label><Select value={head} onChange={setHead} options={[['', 'সব খাত — ক্যাশ বই'], ...heads.map((h) => [h, h])]} /></div>
          <div className="row-actions" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => printNode(ref.current, 'A4', '12mm', 'portrait')}>প্রিন্ট (A4)</button>
            <button className="btn outline" onClick={() => downloadCsv(`খতিয়ান-${from}-${to}.csv`, ['তারিখ', 'নং', 'খাত', 'নাম', 'বিবরণ', 'জমা', 'খরচ', 'জের'], led.list.map((r) => [r.date, r.no, r.head, r.who, r.note, r.kind === 'in' ? r.amount : '', r.kind === 'out' ? r.amount : '', r.run]))}>CSV</button>
          </div>
          <div className="adm-scroll"><div ref={ref} style={{ background: '#fff', color: '#000', padding: 16, minWidth: 640 }}>
            <h3 style={{ textAlign: 'center', marginTop: 0 }}>{head ? `খতিয়ান — ${head}` : 'ক্যাশ বই (সব খাত)'}</h3>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>{dateBn(from)} থেকে {dateBn(to)}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
              <thead><tr>{['তারিখ', 'নং', 'খাত', 'নাম / বিবরণ', 'জমা', 'খরচ', 'জের'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                <tr><td style={td} colSpan={6}><b>পূর্বের জের</b></td><td style={td}><b>{taka(led.open)}</b></td></tr>
                {led.list.map((r) => (
                  <tr key={r.key}>
                    <td style={td}>{dateBn(r.date)}</td><td style={td}>{r.no}</td><td style={td}>{r.head}</td><td style={td}>{[r.who, r.note].filter(Boolean).join(' — ')}</td>
                    <td style={td}>{r.kind === 'in' ? taka(r.amount) : ''}</td><td style={td}>{r.kind === 'out' ? taka(r.amount) : ''}</td><td style={td}>{taka(r.run)}</td>
                  </tr>
                ))}
                {!led.list.length && <tr><td style={td} colSpan={7}>এই সময়ে কোনো লেনদেন নেই</td></tr>}
                <tr><td style={td} colSpan={4}><b>মোট</b></td><td style={td}><b>{taka(led.inn)}</b></td><td style={td}><b>{taka(led.outt)}</b></td><td style={td}><b>{taka(led.close)}</b></td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: '.75rem', color: '#555' }}>প্রিন্টের সময়: {printedAt()} · লেনদেন {bn(led.list.length)} টি</div>
          </div></div>
        </>
      )}
      {view && <VoucherView e={view} onClose={() => setView(null)} />}
    </>
  )
}
