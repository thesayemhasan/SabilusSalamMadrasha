import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Modal, Select, useConfirm } from '../../components/Ui'
import Icon from '../../components/Icon'
import { downloadCsv } from './Crud'
import { PrintDoc, VoidDialog, dateBn, monthName, monthStr, nm, num, taka, todayStr, useMethods, voidPatch } from './fin'

function usePeople() {
  const [staff, setStaff] = useState([])
  const [adv, setAdv] = useState([])
  const [sal, setSal] = useState([])
  const load = useCallback(async () => {
    const s = await fetchAll((a, b) => supabase.from('staff').select('*').order('created_at', { ascending: true }).range(a, b))
    const a = await fetchAll((x, y) => supabase.from('staff_advances').select('*').order('date', { ascending: false }).range(x, y))
    const p = await fetchAll((x, y) => supabase.from('salary_payments').select('*').order('paid_at', { ascending: false }).range(x, y))
    setStaff(s.data || []); setAdv(a.data || []); setSal(p.data || [])
  }, [])
  useEffect(() => { load() }, [load])
  // অগ্রিমের বাকি = মোট অগ্রিম − বেতন থেকে কাটা
  const balance = (id) => adv.filter((x) => x.staff_id === id && !x.void).reduce((a, x) => a + num(x.amount), 0) - sal.filter((x) => x.staff_id === id && !x.void).reduce((a, x) => a + num(x.advance_deduct), 0)
  return { staff, adv, sal, balance, load }
}

function Pay({ P, methods }) {
  const confirm = useConfirm()
  const [month, setMonth] = useState(monthStr())
  const [method, setMethod] = useState('cash')
  const [cutAbsent, setCutAbsent] = useState(false)
  const [absent, setAbsent] = useState({})
  const [edit, setEdit] = useState({})
  const [doc, setDoc] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      const [y, m] = month.split('-').map(Number)
      const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
      const { data } = await fetchAll((a, b) => supabase.from('attendance').select('person_id,status').eq('person_type', 'staff').eq('status', 'absent').gte('date', `${month}-01`).lte('date', to).range(a, b))
      const o = {}; (data || []).forEach((r) => { o[r.person_id] = (o[r.person_id] || 0) + 1 })
      setAbsent(o); setEdit({})
    })()
  }, [month])

  const active = P.staff.filter((s) => s.status === 'active')
  const paidFor = (id) => P.sal.find((x) => x.staff_id === id && x.period === month && !x.void)
  const calc = (s) => {
    const e = edit[s.id] || {}
    const base = num(s.salary)
    const deduction = e.deduction !== undefined ? num(e.deduction) : cutAbsent ? Math.round((base / 30) * (absent[s.id] || 0)) : 0
    const adv = Math.min(e.adv !== undefined ? num(e.adv) : 0, Math.max(0, P.balance(s.id)))
    const bonus = num(e.bonus)
    return { base, deduction, adv, bonus, net: Math.max(0, base - deduction - adv + bonus) }
  }
  const setE = (id, k, v) => setEdit((o) => ({ ...o, [id]: { ...o[id], [k]: v } }))

  async function pay(s) {
    const c = calc(s)
    if (c.net <= 0 && c.base <= 0) return setMsg(`${nm(s)}-এর বেতন ঠিক করা নেই। "শিক্ষক ও কর্মচারী" পেইজে বেতনের পরিমাণ দিন।`)
    if (!(await confirm({ danger: false, name: `${nm(s)} — ${monthName(month)} — ${taka(c.net)}`, text: 'বেতন দেওয়া হয়েছে হিসেবে সংরক্ষণ করবেন? পরে অঙ্ক বদলানো যাবে না (শুধু বাতিল করা যাবে)।', ok: 'হ্যাঁ, বেতন দিন' }))) return
    const { data, error } = await supabase.from('salary_payments').insert({ staff_id: s.id, period: month, base: c.base, deduction: c.deduction, advance_deduct: c.adv, bonus: c.bonus, net: c.net, method, paid_at: todayStr() }).select().single()
    if (error) return setMsg(error.message)
    setMsg(''); P.load(); slip(s, data || { ...c, period: month, method, paid_at: todayStr() })
  }
  const slip = (s, r) => setDoc({ date: r.paid_at, title: `বেতন স্লিপ — ${monthName(r.period)}`, rows: [['মূল বেতন', r.base], ...(num(r.bonus) ? [['বোনাস', r.bonus]] : []), ...(num(r.deduction) ? [['কর্তন (−)', r.deduction]] : []), ...(num(r.advance_deduct) ? [['অগ্রিম কাটা (−)', r.advance_deduct]] : [])], total: r.net, meta: [['নাম', nm(s)], ['পদবি', s.designation_bn], ['আইডি', s.staff_no], ['মাধ্যম', methods.label(r.method)]] })

  return (
    <>
      <div className="toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 190 }} />
        <div style={{ minWidth: 170 }}><Select value={method} onChange={setMethod} options={methods.list} /></div>
        <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={cutAbsent} onChange={(e) => setCutAbsent(e.target.checked)} /><span>হাজিরার অনুপস্থিতি থেকে কর্তন (বেতন ÷ ৩০ × দিন)</span></label>
      </div>
      {msg && <div className="alert err" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>নাম</th><th>বেতন</th><th>অনুপস্থিত</th><th>কর্তন</th><th>অগ্রিম বাকি / কাটা</th><th>বোনাস</th><th>প্রদেয়</th><th></th></tr></thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan="8" className="muted">কোনো সক্রিয় শিক্ষক/কর্মচারী নেই।</td></tr>}
            {active.map((s) => {
              const done = paidFor(s.id); const c = calc(s); const bal = P.balance(s.id)
              return (
                <tr key={s.id}>
                  <td><b>{nm(s)}</b><div className="muted" style={{ fontSize: '.8rem' }}>{s.designation_bn}</div></td>
                  <td>{taka(s.salary)}</td>
                  <td>{(absent[s.id] || 0).toLocaleString('bn-BD')} দিন</td>
                  {done ? <><td colSpan="3" className="muted">দেওয়া হয়েছে ({dateBn(done.paid_at)})</td><td><b>{taka(done.net)}</b></td><td><button className="btn small outline" onClick={() => slip(s, done)}><Icon name="printer" size={15} cls="cur" /> স্লিপ</button></td></> : (
                    <>
                      <td style={{ minWidth: 90 }}><input type="number" min="0" value={edit[s.id]?.deduction ?? (c.deduction || '')} placeholder="০" onChange={(e) => setE(s.id, 'deduction', e.target.value)} /></td>
                      <td style={{ minWidth: 130 }}>{bal > 0 && <small className="muted">বাকি {taka(bal)}<br /></small>}<input type="number" min="0" max={bal} value={edit[s.id]?.adv ?? ''} placeholder="০" disabled={bal <= 0} onChange={(e) => setE(s.id, 'adv', e.target.value)} /></td>
                      <td style={{ minWidth: 90 }}><input type="number" min="0" value={edit[s.id]?.bonus ?? ''} placeholder="০" onChange={(e) => setE(s.id, 'bonus', e.target.value)} /></td>
                      <td><b>{taka(c.net)}</b></td>
                      <td><button className="btn small" onClick={() => pay(s)}>বেতন দিন</button></td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {doc && <PrintDoc kind="salary" titleSuffix={doc.title.replace(/^[^—]*— ?/, '')} date={doc.date} rows={doc.rows} total={doc.total} meta={doc.meta} onClose={() => setDoc(null)} />}
    </>
  )
}

function Advances({ P, methods }) {
  const confirm = useConfirm()
  const [form, setForm] = useState(null)
  const [vd, setVd] = useState(null)
  const sn = Object.fromEntries(P.staff.map((s) => [s.id, s]))
  async function save() {
    if (!form.staff_id || num(form.amount) <= 0) return
    if (!(await confirm({ danger: false, name: `${nm(sn[form.staff_id])} — ${taka(form.amount)}`, text: 'অগ্রিম দেওয়া হিসেবে সংরক্ষণ করবেন?', ok: 'হ্যাঁ, সংরক্ষণ করুন' }))) return
    const { error } = await supabase.from('staff_advances').insert({ staff_id: form.staff_id, amount: num(form.amount), method: form.method, date: form.date, note: form.note || null })
    if (error) return window.alert(error.message)
    setForm(null); P.load()
  }
  return (
    <>
      <div className="toolbar"><span className="muted" style={{ flex: '1 1 auto' }}>অগ্রিম দিলে পরের বেতন থেকে কাটা যাবে।</span><button className="btn" onClick={() => setForm({ staff_id: '', amount: '', method: 'cash', date: todayStr(), note: '' })}><Icon name="plus" size={18} cls="cur" /> নতুন অগ্রিম</button></div>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        {P.staff.filter((s) => P.balance(s.id) > 0).map((s) => <div className="card stat" key={s.id}><b>{taka(P.balance(s.id))}</b><span className="muted">{nm(s)} — অগ্রিম বাকি</span></div>)}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>তারিখ</th><th>নাম</th><th>টাকা</th><th>নোট</th><th></th></tr></thead>
          <tbody>
            {P.adv.length === 0 && <tr><td colSpan="5" className="muted">কোনো অগ্রিম নেই।</td></tr>}
            {P.adv.map((a) => <tr key={a.id} style={a.void ? { opacity: 0.55 } : undefined}><td>{dateBn(a.date)}</td><td>{nm(sn[a.staff_id])} {a.void && <span className="pill">বাতিল</span>}</td><td>{taka(a.amount)}</td><td>{a.note}</td><td>{!a.void && <button className="btn small danger" onClick={() => setVd(a)}>বাতিল</button>}</td></tr>)}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal onClose={() => setForm(null)}>
          <h3>নতুন অগ্রিম</h3>
          <div className="form">
            <div className="field"><label>কাকে *</label><Select value={form.staff_id} onChange={(v) => setForm({ ...form, staff_id: v })} placeholder="বাছাই করুন" options={P.staff.filter((s) => s.status === 'active').map((s) => [s.id, nm(s)])} /></div>
            <div className="row2">
              <div className="field"><label>টাকা *</label><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="field"><label>মাধ্যম</label><Select value={form.method} onChange={(v) => setForm({ ...form, method: v })} options={methods.list} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>তারিখ</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="field"><label>নোট</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn outline" onClick={() => setForm(null)}>বাতিল</button><button className="btn" onClick={save}>সংরক্ষণ</button></div>
          </div>
        </Modal>
      )}
      {vd && <VoidDialog name={`${nm(sn[vd.staff_id])} এর অগ্রিম (${taka(vd.amount)})`} onClose={() => setVd(null)} onDone={async (why) => { const { error } = await supabase.from('staff_advances').update(voidPatch(why)).eq('id', vd.id); if (error) window.alert(error.message); setVd(null); P.load() }} />}
    </>
  )
}

function History({ P, methods }) {
  const [month, setMonth] = useState('')
  const [vd, setVd] = useState(null)
  const sn = Object.fromEntries(P.staff.map((s) => [s.id, s]))
  const rows = P.sal.filter((x) => !month || x.period === month)
  return (
    <>
      <div className="toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 190 }} />
        {month && <button className="btn small outline" onClick={() => setMonth('')}>সব মাস</button>}
        <button className="btn outline" onClick={() => downloadCsv(`বেতন-${month || 'সব'}.csv`, ['মাস', 'নাম', 'মূল বেতন', 'কর্তন', 'অগ্রিম কাটা', 'বোনাস', 'প্রদত্ত', 'মাধ্যম', 'অবস্থা'], rows.map((r) => [r.period, nm(sn[r.staff_id]), r.base, r.deduction, r.advance_deduct, r.bonus, r.net, methods.label(r.method), r.void ? `বাতিল: ${r.void_reason}` : 'সক্রিয়']))}><Icon name="upload" size={17} cls="cur" /> Excel</button>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>মোট প্রদত্ত (বাতিল বাদে): <b>{taka(rows.filter((r) => !r.void).reduce((a, r) => a + num(r.net), 0))}</b></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>মাস</th><th>নাম</th><th>মূল</th><th>কর্তন</th><th>অগ্রিম</th><th>বোনাস</th><th>প্রদত্ত</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="8" className="muted">কোনো তথ্য নেই।</td></tr>}
            {rows.map((r) => <tr key={r.id} style={r.void ? { opacity: 0.55 } : undefined}><td>{monthName(r.period)}</td><td>{nm(sn[r.staff_id])} {r.void && <span className="pill">বাতিল</span>}</td><td>{taka(r.base)}</td><td>{taka(r.deduction)}</td><td>{taka(r.advance_deduct)}</td><td>{taka(r.bonus)}</td><td><b>{taka(r.net)}</b></td><td>{!r.void && <button className="btn small danger" onClick={() => setVd(r)}>বাতিল</button>}</td></tr>)}
          </tbody>
        </table>
      </div>
      {vd && <VoidDialog name={`${nm(sn[vd.staff_id])} — ${monthName(vd.period)} বেতন`} onClose={() => setVd(null)} onDone={async (why) => { const { error } = await supabase.from('salary_payments').update(voidPatch(why)).eq('id', vd.id); if (error) window.alert(error.message); setVd(null); P.load() }} />}
    </>
  )
}

export default function Salary() {
  const [tab, setTab] = useState('pay')
  const P = usePeople()
  const methods = useMethods()
  return (
    <>
      <h2>শিক্ষক-কর্মচারীর বেতন</h2>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['pay', 'বেতন দিন'], ['adv', 'অগ্রিম'], ['hist', 'বেতনের তালিকা']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'pay' && <Pay P={P} methods={methods} />}
      {tab === 'adv' && <Advances P={P} methods={methods} />}
      {tab === 'hist' && <History P={P} methods={methods} />}
    </>
  )
}
