import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm, Modal } from '../../components/Ui'
import Icon from '../../components/Icon'
import { downloadCsv } from './Crud'
import { PrintDoc, VoidDialog, addDays, dateBn, monthName, monthStr, nm, num, taka, todayStr, useMethods, voidPatch } from './fin'

/* ---------------- বিল তৈরি ---------------- */
function resolveAmount(st, head, rates, sf) {
  const o = sf[`${st.id}|${head.id}`]
  if (o?.exempt) return 0
  const cand = rates.filter((r) => r.head_id === head.id && (!r.class_id || r.class_id === st.class_id) && (!r.department_id || r.department_id === st.department_id) && (!r.residence || r.residence === st.residence))
  cand.sort((a, b) => ['class_id', 'department_id', 'residence'].filter((k) => b[k]).length - ['class_id', 'department_id', 'residence'].filter((k) => a[k]).length)
  const base = o && o.amount != null ? num(o.amount) : cand.length ? num(cand[0].amount) : num(head.default_amount)
  return Math.max(0, base - num(o?.discount))
}

export function Billing() {
  const confirm = useConfirm()
  const [heads, setHeads] = useState([])
  const [classes, setClasses] = useState([])
  const [pick, setPick] = useState({})
  const [month, setMonth] = useState(monthStr())
  const [label, setLabel] = useState('')
  const [cls, setCls] = useState('')
  const [data, setData] = useState({ students: [], rates: [], sf: {}, existing: new Set() })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('fee_heads').select('*').order('sort', { ascending: true }).then(({ data: d }) => { const l = (d || []).filter((h) => h.published !== false); setHeads(l); setPick(Object.fromEntries(l.filter((h) => h.kind === 'monthly').map((h) => [h.id, true]))) })
    supabase.from('classes').select('*').order('sort', { ascending: true }).then(({ data: d }) => setClasses((d || []).map((c) => [c.id, nm(c)])))
  }, [])

  const periodOf = useCallback((h) => (h.kind === 'monthly' ? month : (label.trim() || 'এককালীন')), [month, label])
  const chosen = heads.filter((h) => pick[h.id])

  useEffect(() => {
    (async () => {
      const st = await fetchAll((a, b) => { let q = supabase.from('students').select('*').eq('status', 'active').range(a, b); if (cls) q = q.eq('class_id', cls); return q })
      const rates = await fetchAll((a, b) => supabase.from('fee_rates').select('*').range(a, b))
      const sfr = await fetchAll((a, b) => supabase.from('student_fees').select('*').range(a, b))
      const inv = await fetchAll((a, b) => supabase.from('invoices').select('student_id,head_id,period').range(a, b))
      setData({ students: st.data || [], rates: rates.data || [], sf: Object.fromEntries((sfr.data || []).map((r) => [`${r.student_id}|${r.head_id}`, r])), existing: new Set((inv.data || []).map((r) => `${r.student_id}|${r.head_id}|${r.period}`)) })
    })()
  }, [cls, msg])

  const plan = useMemo(() => {
    const rows = []; let skipped = 0
    data.students.forEach((s) => chosen.forEach((h) => {
      const amt = resolveAmount(s, h, data.rates, data.sf)
      if (amt <= 0) return
      const period = periodOf(h)
      if (data.existing.has(`${s.id}|${h.id}|${period}`)) { skipped += 1; return }
      rows.push({ student_id: s.id, head_id: h.id, period, title: `${nm(h)} — ${h.kind === 'monthly' ? monthName(period) : period}`, amount: amt })
    }))
    return { rows, skipped, total: rows.reduce((a, r) => a + r.amount, 0) }
  }, [data, chosen, periodOf])

  async function generate() {
    if (!plan.rows.length) return
    if (!(await confirm({ danger: false, name: `${plan.rows.length}টি বিল (${taka(plan.total)})`, text: 'এই বিলগুলো তৈরি করবেন? যাদের বিল আগে থেকে আছে তাদের বিল নতুন করে হবে না।', ok: 'হ্যাঁ, বিল তৈরি করুন' }))) return
    setBusy(true); setMsg('')
    for (let i = 0; i < plan.rows.length; i += 400) {
      const { error } = await supabase.from('invoices').upsert(plan.rows.slice(i, i + 400), { onConflict: 'student_id,head_id,period', ignoreDuplicates: true })
      if (error) { setBusy(false); return setMsg(`ত্রুটি: ${error.message}`) }
    }
    setBusy(false)
    setMsg(`${plan.rows.length}টি বিল তৈরি হয়েছে।`)
  }

  return (
    <>
      <h2>বিল তৈরি</h2>
      <p className="muted">মাস, ফি-র ধরন ও শ্রেণি বেছে পুরো মাসের বিল এক ক্লিকে তৈরি করুন। আগে "ফি-র ধরন ও পরিমাণ" পেইজে পরিমাণ ঠিক করে নিন।</p>
      <div className="card form" style={{ marginBottom: 14 }}>
        <div className="row2">
          <div className="field"><label>মাস (মাসিক ফি-র জন্য)</label><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div className="field"><label>শ্রেণি</label><Select value={cls} onChange={setCls} options={[['', 'সব শ্রেণি'], ...classes]} /></div>
        </div>
        <div className="field">
          <label>কোন কোন ফি-র বিল হবে</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {heads.map((h) => (
              <label key={h.id} className="check" style={{ margin: 0 }}>
                <input type="checkbox" checked={!!pick[h.id]} onChange={(e) => setPick((o) => ({ ...o, [h.id]: e.target.checked }))} />
                <span>{nm(h)} <small className="muted">({h.kind === 'monthly' ? 'মাসিক' : 'এককালীন'})</small></span>
              </label>
            ))}
          </div>
        </div>
        {chosen.some((h) => h.kind !== 'monthly') && (
          <div className="field"><label>এককালীন বিলের নাম/লেবেল (যেমন: বার্ষিক পরীক্ষা ২০২৬)</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="এককালীন" /></div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>প্রিভিউ</h3>
        <p style={{ marginBottom: 6 }}>তৈরি হবে: <b>{plan.rows.length}টি</b> বিল, মোট <b>{taka(plan.total)}</b></p>
        {plan.skipped > 0 && <p className="muted" style={{ marginTop: 0 }}>আগে থেকেই বিল আছে বলে বাদ: {plan.skipped}টি</p>}
        {data.students.length === 0 && <p className="muted">কোনো সক্রিয় ছাত্র পাওয়া যায়নি।</p>}
        {plan.rows.length === 0 && data.students.length > 0 && <p className="muted">নতুন কোনো বিল নেই। পরিমাণ ০ হলে বিল তৈরি হয় না, তাই ফি-র পরিমাণ দিয়েছেন কিনা দেখুন।</p>}
        {msg && <div className={`alert ${msg.startsWith('ত্রুটি') ? 'err' : 'ok'}`}>{msg}</div>}
        <button className="btn" disabled={busy || !plan.rows.length} onClick={generate}>{busy ? 'তৈরি হচ্ছে…' : 'বিল তৈরি করুন'}</button>
      </div>
    </>
  )
}

/* ---------------- ফি আদায় ---------------- */
function Collect() {
  const confirm = useConfirm()
  const methods = useMethods()
  const [students, setStudents] = useState([])
  const [q, setQ] = useState('')
  const [st, setSt] = useState(null)
  const [dues, setDues] = useState([])
  const [pay, setPay] = useState({})
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(todayStr())
  const [ref, setRef] = useState('')
  const [payer, setPayer] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [doc, setDoc] = useState(null)
  const [extra, setExtra] = useState(null)

  useEffect(() => { fetchAll((a, b) => supabase.from('students').select('*').range(a, b)).then(({ data }) => setStudents(data || [])) }, [])
  const found = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return []
    return students.filter((s) => [s.name_bn, s.name_en, s.student_no, s.father_name, s.guardian_phone].some((v) => String(v || '').toLowerCase().includes(k))).slice(0, 8)
  }, [q, students])

  const loadDues = useCallback(async (s) => {
    const { data } = await supabase.from('invoices').select('*').eq('student_id', s.id).order('created_at', { ascending: true })
    const l = (data || []).filter((i) => !i.cancelled && num(i.amount) - num(i.paid) > 0)
    setDues(l); setPay({})
  }, [])
  useEffect(() => { if (st) loadDues(st) }, [st, loadDues])

  const total = dues.reduce((a, i) => a + num(pay[i.id]), 0)
  const dueTotal = dues.reduce((a, i) => a + (num(i.amount) - num(i.paid)), 0)

  async function submit() {
    setMsg('')
    const items = dues.filter((i) => num(pay[i.id]) > 0).map((i) => ({ inv: i, amt: num(pay[i.id]) }))
    if (!items.length) return setMsg('কোন বিলের কত টাকা নিচ্ছেন তা দিন।')
    if (items.some((x) => x.amt > num(x.inv.amount) - num(x.inv.paid))) return setMsg('বকেয়ার চেয়ে বেশি টাকা ধরা যাবে না।')
    if (!(await confirm({ danger: false, name: `${nm(st)} থেকে ${taka(total)}`, text: `${methods.label(method)} মাধ্যমে আদায় করবেন? রসিদ তৈরি হবে এবং পরে মোছা যাবে না (শুধু বাতিল করা যাবে)।`, ok: 'হ্যাঁ, আদায় করুন' }))) return
    setBusy(true)
    const { data: p, error } = await supabase.from('payments').insert({ student_id: st.id, payer: payer || st.father_name || null, method, amount: total, txn_ref: ref || null, paid_at: date, note: note || null }).select().single()
    if (error || !p) { setBusy(false); return setMsg(error?.message || 'আদায় হয়নি') }
    const { error: e2 } = await supabase.from('payment_items').insert(items.map((x) => ({ payment_id: p.id, invoice_id: x.inv.id, amount: x.amt })))
    if (e2) {
      await supabase.from('payments').update(voidPatch('স্বয়ংক্রিয় বাতিল: বিলের সাথে যুক্ত করা যায়নি')).eq('id', p.id)
      setBusy(false); return setMsg(`ত্রুটি: ${e2.message}`)
    }
    setBusy(false)
    setDoc({ no: p.receipt_no, date, rows: items.map((x) => [x.inv.title || x.inv.period, x.amt]), total, meta: [['ছাত্র', `${nm(st)} (${st.student_no || ''})`], ['মাধ্যম', methods.label(method)], ['প্রদানকারী', p.payer], ['রেফারেন্স', ref]] })
    setRef(''); setNote(''); loadDues(st)
  }

  async function addExtra() {
    const amt = num(extra.amount)
    if (!extra.title.trim() || amt <= 0) return
    const { error } = await supabase.from('invoices').insert({ student_id: st.id, head_id: null, period: extra.title.trim(), title: extra.title.trim(), amount: amt })
    if (error) return setMsg(error.message)
    setExtra(null); loadDues(st)
  }

  return (
    <>
      <div className="card form" style={{ marginBottom: 14 }}>
        <div className="field" style={{ position: 'relative' }}>
          <label>ছাত্র খুঁজুন (নাম, আইডি, অভিভাবকের নাম বা ফোন)</label>
          <input value={q} onChange={(e) => { setQ(e.target.value); setSt(null) }} placeholder="যেমন: রাকিব বা ২৬০০০১" autoComplete="off" />
          {found.length > 0 && !st && (
            <div className="pick-list">
              {found.map((s) => <button type="button" key={s.id} onClick={() => { setSt(s); setQ(`${nm(s)} (${s.student_no})`) }}><b>{nm(s)}</b> <span className="muted">{s.student_no} · {s.father_name || ''} · {s.guardian_phone || ''}</span></button>)}
            </div>
          )}
        </div>
      </div>
      {st && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><b style={{ fontSize: '1.1rem' }}>{nm(st)}</b> <span className="tag">{st.student_no}</span><div className="muted">পিতা: {st.father_name || '—'} · ফোন: {st.guardian_phone || '—'}</div></div>
              <div style={{ textAlign: 'end' }}><div className="muted">মোট বকেয়া</div><b style={{ fontSize: '1.3rem', color: dueTotal ? 'var(--secondary)' : 'var(--primary)' }}>{taka(dueTotal)}</b></div>
            </div>
          </div>
          <div className="card table-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead><tr><th></th><th>বিল</th><th>পরিমাণ</th><th>জমা</th><th>বকেয়া</th><th>এখন নিচ্ছি</th></tr></thead>
              <tbody>
                {dues.length === 0 && <tr><td colSpan="6" className="muted">কোনো বকেয়া বিল নেই।</td></tr>}
                {dues.map((i) => {
                  const d = num(i.amount) - num(i.paid)
                  return (
                    <tr key={i.id}>
                      <td><input type="checkbox" checked={num(pay[i.id]) > 0} onChange={(e) => setPay((o) => ({ ...o, [i.id]: e.target.checked ? d : 0 }))} /></td>
                      <td>{i.title || i.period}</td><td>{taka(i.amount)}</td><td>{taka(i.paid)}</td><td><b>{taka(d)}</b></td>
                      <td style={{ minWidth: 120 }}><input type="number" min="0" max={d} value={pay[i.id] ?? ''} placeholder="০" onChange={(e) => setPay((o) => ({ ...o, [i.id]: e.target.value === '' ? 0 : Number(e.target.value) }))} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 4px' }}>
              <button type="button" className="btn small outline" onClick={() => setExtra({ title: '', amount: '' })}><Icon name="plus" size={15} cls="cur" /> অতিরিক্ত বিল যোগ (যেমন বিলম্ব ফি, কিতাব)</button>
              {dues.length > 0 && <button type="button" className="btn small outline" style={{ marginInlineStart: 8 }} onClick={() => setPay(Object.fromEntries(dues.map((i) => [i.id, num(i.amount) - num(i.paid)])))}>সব বকেয়া ধরুন</button>}
            </div>
          </div>
          <div className="card form">
            <div className="row2">
              <div className="field"><label>মাধ্যম</label><Select value={method} onChange={setMethod} options={methods.list} /></div>
              <div className="field"><label>তারিখ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>প্রদানকারীর নাম (ফাঁকা = পিতা)</label><input value={payer} onChange={(e) => setPayer(e.target.value)} /></div>
              <div className="field"><label>ট্রানজেকশন আইডি / রেফারেন্স (বিকাশ/নগদ হলে)</label><input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
            </div>
            <div className="field"><label>নোট</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            {msg && <div className="alert err">{msg}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: '1.2rem' }}>মোট আদায়: {taka(total)}</b>
              <button className="btn" disabled={busy || total <= 0} onClick={submit}>{busy ? 'অপেক্ষা করুন…' : 'আদায় করুন ও রসিদ দিন'}</button>
            </div>
          </div>
        </>
      )}
      {doc && <PrintDoc title="ফি আদায়ের রসিদ" no={doc.no} date={doc.date} rows={doc.rows} total={doc.total} meta={doc.meta} onClose={() => setDoc(null)} />}
      {extra && (
        <Modal onClose={() => setExtra(null)}>
          <h3>অতিরিক্ত বিল</h3>
          <div className="field"><label>বিলের নাম</label><input value={extra.title} onChange={(e) => setExtra({ ...extra, title: e.target.value })} placeholder="যেমন: বিলম্ব ফি (জানুয়ারি)" /></div>
          <div className="field"><label>পরিমাণ (টাকা)</label><input type="number" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn outline" onClick={() => setExtra(null)}>বাতিল</button><button className="btn" onClick={addExtra}>যোগ করুন</button></div>
        </Modal>
      )}
    </>
  )
}

/* ---------------- রসিদ তালিকা ---------------- */
function Receipts() {
  const methods = useMethods()
  const [from, setFrom] = useState(`${monthStr()}-01`)
  const [to, setTo] = useState(todayStr())
  const [m, setM] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [stu, setStu] = useState({})
  const [doc, setDoc] = useState(null)
  const [vd, setVd] = useState(null)
  const load = useCallback(async () => {
    const p = await fetchAll((a, b) => supabase.from('payments').select('*').gte('paid_at', from).lte('paid_at', to).order('paid_at', { ascending: false }).range(a, b))
    setRows(p.data || [])
    const s = await fetchAll((a, b) => supabase.from('students').select('id,name_bn,name_en,student_no').range(a, b))
    setStu(Object.fromEntries((s.data || []).map((x) => [x.id, x])))
  }, [from, to])
  useEffect(() => { load() }, [load])

  const shown = rows.filter((r) => (!m || r.method === m) && (!q || `${r.receipt_no} ${nm(stu[r.student_id])} ${stu[r.student_id]?.student_no || ''}`.toLowerCase().includes(q.toLowerCase())))
  const total = shown.filter((r) => !r.void).reduce((a, r) => a + num(r.amount), 0)

  async function view(r) {
    const { data: items } = await supabase.from('payment_items').select('*').eq('payment_id', r.id)
    const ids = (items || []).map((x) => x.invoice_id)
    const { data: inv } = ids.length ? await supabase.from('invoices').select('*').in('id', ids) : { data: [] }
    const im = Object.fromEntries((inv || []).map((x) => [x.id, x]))
    const s = stu[r.student_id]
    setDoc({ no: r.receipt_no, date: r.paid_at, rows: (items || []).map((x) => [im[x.invoice_id]?.title || im[x.invoice_id]?.period || 'ফি', x.amount]), total: r.amount, meta: [['ছাত্র', s ? `${nm(s)} (${s.student_no || ''})` : ''], ['মাধ্যম', methods.label(r.method)], ['প্রদানকারী', r.payer], ['রেফারেন্স', r.txn_ref]], note: r.void ? `বাতিল: ${r.void_reason}` : '' })
  }

  return (
    <>
      <div className="toolbar">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} />
        <div style={{ minWidth: 170 }}><Select value={m} onChange={setM} options={[['', 'সব মাধ্যম'], ...methods.list]} /></div>
        <input className="search-in" placeholder="রসিদ নং বা ছাত্রের নাম" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn outline" onClick={() => downloadCsv(`রসিদ-${from}-${to}.csv`, ['রসিদ নং', 'তারিখ', 'ছাত্র', 'আইডি', 'মাধ্যম', 'টাকা', 'অবস্থা'], shown.map((r) => [r.receipt_no, r.paid_at, nm(stu[r.student_id]), stu[r.student_id]?.student_no, methods.label(r.method), r.amount, r.void ? `বাতিল: ${r.void_reason}` : 'সক্রিয়']))}><Icon name="upload" size={17} cls="cur" /> Excel</button>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>মোট আদায় (বাতিল বাদে): <b>{taka(total)}</b> · রসিদ {shown.length}টি</div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>রসিদ নং</th><th>তারিখ</th><th>ছাত্র</th><th>মাধ্যম</th><th>টাকা</th><th></th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan="6" className="muted">কোনো রসিদ নেই।</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} style={r.void ? { opacity: 0.55 } : undefined}>
                <td>{r.receipt_no} {r.void && <span className="pill">বাতিল</span>}</td><td>{dateBn(r.paid_at)}</td><td>{nm(stu[r.student_id])}</td><td>{methods.label(r.method)}</td>
                <td style={r.void ? { textDecoration: 'line-through' } : undefined}>{taka(r.amount)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small outline" onClick={() => view(r)}><Icon name="printer" size={15} cls="cur" /> রসিদ</button>{' '}
                  {!r.void && <button className="btn small danger" onClick={() => setVd(r)}>বাতিল</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {doc && <PrintDoc title="ফি আদায়ের রসিদ" no={doc.no} date={doc.date} rows={doc.rows} total={doc.total} meta={doc.meta} footNote={doc.note} onClose={() => setDoc(null)} />}
      {vd && <VoidDialog name={`রসিদ ${vd.receipt_no} (${taka(vd.amount)})`} onClose={() => setVd(null)} onDone={async (why) => { const { error } = await supabase.from('payments').update(voidPatch(why)).eq('id', vd.id); if (error) window.alert(error.message); setVd(null); load() }} />}
    </>
  )
}

export default function FeesPage() {
  const [tab, setTab] = useState('collect')
  return (
    <>
      <h2>ফি আদায় ও রসিদ</h2>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['collect', 'ফি আদায়'], ['receipts', 'রসিদ তালিকা']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'collect' ? <Collect /> : <Receipts />}
    </>
  )
}
