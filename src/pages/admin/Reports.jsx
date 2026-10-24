import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select } from '../../components/Ui'
import Icon from '../../components/Icon'
import { downloadCsv } from './Crud'
import { PrintDoc, addDays, dateBn, monthName, monthStr, nm, num, taka, todayStr, useMethods } from './fin'

const all = (t, order) => fetchAll((a, b) => supabase.from(t).select('*').order(order || 'created_at', { ascending: true }).range(a, b)).then((r) => r.data || [])
const Tile = ({ label, value, tone }) => <div className="card stat"><b style={tone ? { color: tone } : undefined}>{value}</b><span className="muted">{label}</span></div>

// সব আর্থিক লেনদেন এক তালিকায় (আয় = in, ব্যয় = out)
function useMoney() {
  const [d, setD] = useState({ pay: [], led: [], sal: [], adv: [], ready: false })
  useEffect(() => {
    Promise.all([all('payments'), all('ledger'), all('salary_payments'), all('staff_advances')]).then(([pay, led, sal, adv]) => setD({ pay, led, sal, adv, ready: true }))
  }, [])
  const tx = useMemo(() => {
    const t = []
    d.pay.filter((x) => !x.void).forEach((x) => t.push({ date: x.paid_at, method: x.method, in: num(x.amount), out: 0, cat: 'ছাত্র ফি', desc: `রসিদ ${x.receipt_no || ''}`, group: 'fee' }))
    d.led.filter((x) => !x.void).forEach((x) => t.push({ date: x.date, method: x.method, in: x.kind === 'income' ? num(x.amount) : 0, out: x.kind === 'expense' ? num(x.amount) : 0, cat: x.category_name || (x.kind === 'income' ? 'আয়' : 'ব্যয়'), desc: [x.party, x.note].filter(Boolean).join(' — '), group: x.kind }))
    d.sal.filter((x) => !x.void).forEach((x) => t.push({ date: x.paid_at, method: x.method, in: 0, out: num(x.net), cat: 'বেতন (শিক্ষক-কর্মচারী)', desc: monthName(x.period), group: 'salary' }))
    d.adv.filter((x) => !x.void).forEach((x) => t.push({ date: x.date, method: x.method, in: 0, out: num(x.amount), cat: 'অগ্রিম প্রদান', desc: '', group: 'advance' }))
    return t.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
  }, [d])
  return { ...d, tx }
}

function Summary({ M }) {
  const [mode, setMode] = useState('month')
  const [month, setMonth] = useState(monthStr())
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const from = mode === 'month' ? `${month}-01` : `${year}-01-01`
  const to = mode === 'month' ? `${month}-31` : `${year}-12-31`
  const rows = M.tx.filter((t) => t.date >= from && t.date <= to)
  const inc = rows.reduce((a, t) => a + t.in, 0)
  const exp = rows.reduce((a, t) => a + t.out, 0)
  const by = (key) => { const o = {}; rows.forEach((t) => { const k = key(t); o[k] = o[k] || { in: 0, out: 0 }; o[k].in += t.in; o[k].out += t.out }); return Object.entries(o) }
  return (
    <>
      <div className="toolbar">
        <div style={{ minWidth: 150 }}><Select value={mode} onChange={setMode} options={[['month', 'মাসিক'], ['year', 'বার্ষিক']]} /></div>
        {mode === 'month' ? <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 190 }} /> : <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 130 }} />}
        <button className="btn outline" onClick={() => downloadCsv(`সারাংশ-${mode === 'month' ? month : year}.csv`, ['খাত', 'আয়', 'ব্যয়'], [...by((t) => t.cat).map(([k, v]) => [k, v.in, v.out]), ['মোট', inc, exp], ['উদ্বৃত্ত', inc - exp, '']])}><Icon name="upload" size={17} cls="cur" /> Excel</button>
        <button className="btn outline" onClick={() => window.print()}><Icon name="printer" size={17} cls="cur" /> প্রিন্ট</button>
      </div>
      <div className="print-area">
        <div className="grid g4" style={{ marginBottom: 14 }}>
          <Tile label="মোট আয়" value={taka(inc)} /><Tile label="মোট ব্যয়" value={taka(exp)} /><Tile label={inc - exp >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি'} value={taka(Math.abs(inc - exp))} tone={inc - exp >= 0 ? 'var(--primary)' : 'var(--secondary)'} /><Tile label="এন্ট্রি" value={rows.length.toLocaleString('bn-BD')} />
        </div>
        <div className="grid g2">
          <div className="card table-wrap"><h3 style={{ marginTop: 0 }}>খাত অনুযায়ী</h3>
            <table><thead><tr><th>খাত</th><th>আয়</th><th>ব্যয়</th></tr></thead><tbody>
              {by((t) => t.cat).length === 0 && <tr><td colSpan="3" className="muted">কোনো তথ্য নেই।</td></tr>}
              {by((t) => t.cat).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.in ? taka(v.in) : '—'}</td><td>{v.out ? taka(v.out) : '—'}</td></tr>)}
            </tbody></table></div>
          <div className="card table-wrap"><h3 style={{ marginTop: 0 }}>মাধ্যম অনুযায়ী</h3>
            <MethodTable rows={rows} /></div>
        </div>
      </div>
    </>
  )
}
function MethodTable({ rows }) {
  const methods = useMethods()
  const o = {}; rows.forEach((t) => { o[t.method] = o[t.method] || { in: 0, out: 0 }; o[t.method].in += t.in; o[t.method].out += t.out })
  return <table><thead><tr><th>মাধ্যম</th><th>আয়</th><th>ব্যয়</th></tr></thead><tbody>{Object.entries(o).length === 0 && <tr><td colSpan="3" className="muted">কোনো তথ্য নেই।</td></tr>}{Object.entries(o).map(([k, v]) => <tr key={k}><td>{methods.label(k)}</td><td>{taka(v.in)}</td><td>{taka(v.out)}</td></tr>)}</tbody></table>
}

function Dues() {
  const [inv, setInv] = useState([])
  const [stu, setStu] = useState({})
  const [classes, setClasses] = useState([])
  const [cls, setCls] = useState('')
  const [month, setMonth] = useState('')
  useEffect(() => {
    all('invoices').then(setInv)
    all('students').then((s) => setStu(Object.fromEntries(s.map((x) => [x.id, x]))))
    all('classes', 'sort').then((c) => setClasses(c.map((x) => [x.id, nm(x)])))
  }, [])
  const rows = useMemo(() => {
    const o = {}
    inv.filter((i) => !i.cancelled && num(i.amount) - num(i.paid) > 0 && (!month || i.period === month)).forEach((i) => {
      const s = stu[i.student_id]
      if (!s || (cls && s.class_id !== cls)) return
      o[s.id] = o[s.id] || { s, due: 0, items: [] }
      o[s.id].due += num(i.amount) - num(i.paid); o[s.id].items.push(i.title || i.period)
    })
    return Object.values(o).sort((a, b) => b.due - a.due)
  }, [inv, stu, cls, month])
  const cname = Object.fromEntries(classes)
  return (
    <>
      <div className="toolbar">
        <div style={{ minWidth: 200 }}><Select value={cls} onChange={setCls} options={[['', 'সব শ্রেণি'], ...classes]} /></div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 190 }} />
        {month && <button className="btn small outline" onClick={() => setMonth('')}>সব মাস</button>}
        <button className="btn outline" onClick={() => downloadCsv('বকেয়া-তালিকা.csv', ['আইডি', 'নাম', 'শ্রেণি', 'অভিভাবকের ফোন', 'বকেয়া বিল', 'মোট বকেয়া'], rows.map((r) => [r.s.student_no, nm(r.s), cname[r.s.class_id], r.s.guardian_phone, r.items.join('; '), r.due]))}><Icon name="upload" size={17} cls="cur" /> Excel</button>
        <button className="btn outline" onClick={() => window.print()}><Icon name="printer" size={17} cls="cur" /> প্রিন্ট</button>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>বকেয়া আছে এমন ছাত্র: <b>{rows.length.toLocaleString('bn-BD')}</b> জন · মোট বকেয়া: <b>{taka(rows.reduce((a, r) => a + r.due, 0))}</b></div>
      <div className="card table-wrap print-area">
        <table>
          <thead><tr><th>আইডি</th><th>নাম</th><th>শ্রেণি</th><th>ফোন</th><th>বকেয়া বিল</th><th>মোট</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="6" className="muted">কোনো বকেয়া নেই।</td></tr>}
            {rows.map((r) => <tr key={r.s.id}><td>{r.s.student_no}</td><td>{nm(r.s)}</td><td>{cname[r.s.class_id] || '—'}</td><td>{r.s.guardian_phone || '—'}</td><td style={{ fontSize: '.85rem' }}>{r.items.join(', ')}</td><td><b>{taka(r.due)}</b></td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CashBook({ M }) {
  const methods = useMethods()
  const [from, setFrom] = useState(`${monthStr()}-01`)
  const [to, setTo] = useState(todayStr())
  const before = M.tx.filter((t) => t.date < from)
  const rows = M.tx.filter((t) => t.date >= from && t.date <= to)
  const codes = methods.list.map((x) => x[0])
  const sumBy = (arr, m, k) => arr.filter((t) => t.method === m).reduce((a, t) => a + t[k], 0)
  const lines = codes.map((m) => { const open = (methods.open[m] || 0) + sumBy(before, m, 'in') - sumBy(before, m, 'out'); const i = sumBy(rows, m, 'in'); const o = sumBy(rows, m, 'out'); return { m, open, i, o, close: open + i - o } })
  const tot = lines.reduce((a, l) => ({ open: a.open + l.open, i: a.i + l.i, o: a.o + l.o, close: a.close + l.close }), { open: 0, i: 0, o: 0, close: 0 })
  return (
    <>
      <div className="toolbar">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} />
        <button className="btn outline" onClick={() => downloadCsv(`ক্যাশবই-${from}-${to}.csv`, ['তারিখ', 'মাধ্যম', 'খাত', 'বিবরণ', 'জমা', 'খরচ'], rows.map((t) => [t.date, methods.label(t.method), t.cat, t.desc, t.in || '', t.out || '']))}><Icon name="upload" size={17} cls="cur" /> Excel</button>
        <button className="btn outline" onClick={() => window.print()}><Icon name="printer" size={17} cls="cur" /> প্রিন্ট</button>
      </div>
      <div className="print-area">
        <div className="card table-wrap" style={{ marginBottom: 14 }}>
          <table>
            <thead><tr><th>মাধ্যম</th><th>শুরুর ব্যালেন্স</th><th>জমা</th><th>খরচ</th><th>শেষ ব্যালেন্স</th></tr></thead>
            <tbody>
              {lines.map((l) => <tr key={l.m}><td>{methods.label(l.m)}</td><td>{taka(l.open)}</td><td>{taka(l.i)}</td><td>{taka(l.o)}</td><td><b>{taka(l.close)}</b></td></tr>)}
              <tr className="rc-total"><td>মোট</td><td>{taka(tot.open)}</td><td>{taka(tot.i)}</td><td>{taka(tot.o)}</td><td>{taka(tot.close)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>তারিখ</th><th>মাধ্যম</th><th>খাত</th><th>বিবরণ</th><th>জমা</th><th>খরচ</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="6" className="muted">এই সময়ে কোনো লেনদেন নেই।</td></tr>}
              {rows.map((t, i) => <tr key={i}><td>{dateBn(t.date)}</td><td>{methods.label(t.method)}</td><td>{t.cat}</td><td>{t.desc}</td><td>{t.in ? taka(t.in) : ''}</td><td>{t.out ? taka(t.out) : ''}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function StudentStatement() {
  const methods = useMethods()
  const [stu, setStu] = useState([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [data, setData] = useState({ inv: [], pay: [] })
  useEffect(() => { all('students').then(setStu) }, [])
  const found = q.trim() && !sel ? stu.filter((s) => [s.name_bn, s.name_en, s.student_no].some((v) => String(v || '').toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 8) : []
  useEffect(() => {
    if (!sel) return
    Promise.all([supabase.from('invoices').select('*').eq('student_id', sel.id).order('created_at', { ascending: true }), supabase.from('payments').select('*').eq('student_id', sel.id).order('paid_at', { ascending: true })]).then(([a, b]) => setData({ inv: a.data || [], pay: b.data || [] }))
  }, [sel])
  const billed = data.inv.filter((i) => !i.cancelled).reduce((a, i) => a + num(i.amount), 0)
  const paid = data.inv.filter((i) => !i.cancelled).reduce((a, i) => a + num(i.paid), 0)
  return (
    <>
      <div className="card form" style={{ marginBottom: 14 }}>
        <div className="field" style={{ position: 'relative' }}>
          <label>ছাত্র খুঁজুন</label>
          <input value={q} onChange={(e) => { setQ(e.target.value); setSel(null) }} placeholder="নাম বা আইডি" autoComplete="off" />
          {found.length > 0 && <div className="pick-list">{found.map((s) => <button type="button" key={s.id} onClick={() => { setSel(s); setQ(`${nm(s)} (${s.student_no})`) }}><b>{nm(s)}</b> <span className="muted">{s.student_no}</span></button>)}</div>}
        </div>
      </div>
      {sel && (
        <div className="print-area">
          <div className="grid g3" style={{ marginBottom: 14 }}><Tile label="মোট বিল" value={taka(billed)} /><Tile label="মোট জমা" value={taka(paid)} /><Tile label="বকেয়া" value={taka(billed - paid)} tone={billed - paid > 0 ? 'var(--secondary)' : 'var(--primary)'} /></div>
          <div className="grid g2">
            <div className="card table-wrap"><h3 style={{ marginTop: 0 }}>বিল</h3><table><thead><tr><th>বিল</th><th>পরিমাণ</th><th>জমা</th></tr></thead><tbody>{data.inv.length === 0 && <tr><td colSpan="3" className="muted">কোনো বিল নেই।</td></tr>}{data.inv.map((i) => <tr key={i.id} style={i.cancelled ? { opacity: .5 } : undefined}><td>{i.title || i.period}</td><td>{taka(i.amount)}</td><td>{taka(i.paid)}</td></tr>)}</tbody></table></div>
            <div className="card table-wrap"><h3 style={{ marginTop: 0 }}>আদায়ের ইতিহাস</h3><table><thead><tr><th>রসিদ</th><th>তারিখ</th><th>মাধ্যম</th><th>টাকা</th></tr></thead><tbody>{data.pay.length === 0 && <tr><td colSpan="4" className="muted">কোনো আদায় নেই।</td></tr>}{data.pay.map((p) => <tr key={p.id} style={p.void ? { opacity: .5, textDecoration: 'line-through' } : undefined}><td>{p.receipt_no}</td><td>{dateBn(p.paid_at)}</td><td>{methods.label(p.method)}</td><td>{taka(p.amount)}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Reports() {
  const [tab, setTab] = useState('sum')
  const M = useMoney()
  return (
    <>
      <h2>হিসাব ও রিপোর্ট</h2>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['sum', 'আয়-ব্যয় সারাংশ'], ['dues', 'বকেয়া'], ['cash', 'ক্যাশবই'], ['stu', 'ছাত্রের হিসাব']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'sum' && <Summary M={M} />}
      {tab === 'dues' && <Dues />}
      {tab === 'cash' && <CashBook M={M} />}
      {tab === 'stu' && <StudentStatement />}
    </>
  )
}
