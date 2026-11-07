import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm } from '../../components/Ui'
import { PrintDoc, dateBn, nm, num, taka, todayStr, printNode } from './fin'

const KIND = { deposit: 'জমা', withdraw: 'উত্তোলন' }
const sum = (rows) => rows.reduce((a, r) => a + (r.kind === 'deposit' ? num(r.amount) : -num(r.amount)), 0)

// শিক্ষার্থী সঞ্চয়: জমা/উত্তোলনের খাতা, ব্যালেন্স ও রসিদ
export default function Savings() {
  const confirm = useConfirm()
  const [tab, setTab] = useState('tx')
  const [students, setStudents] = useState([])
  const [all, setAll] = useState([])
  const [sid, setSid] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ kind: 'deposit', amount: '', tx_date: todayStr(), note: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [doc, setDoc] = useState(null)
  const ref = useRef(null)

  const load = useCallback(async () => {
    const s = await fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,status').order('student_no').order('id').range(a, b))
    setStudents(s.data || [])
    const t = await fetchAll((a, b) => supabase.from('student_savings_tx').select('*').order('tx_date').order('serial').order('id').range(a, b))
    setAll(t.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const st = students.find((s) => s.id === sid)
  const mine = useMemo(() => all.filter((r) => r.student_id === sid), [all, sid])
  const balance = sum(mine)
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const list = k ? students.filter((s) => `${s.student_no || ''} ${s.name_bn || ''} ${s.name_en || ''}`.toLowerCase().includes(k)) : students.filter((s) => s.status === 'active')
    return list.slice(0, 200).map((s) => [s.id, `${s.student_no || ''} — ${nm(s)}`])
  }, [students, q])
  const balances = useMemo(() => {
    const m = {}
    all.forEach((r) => { m[r.student_id] = (m[r.student_id] || 0) + (r.kind === 'deposit' ? num(r.amount) : -num(r.amount)) })
    return students.filter((s) => m[s.id]).map((s) => ({ s, bal: m[s.id] })).sort((a, b) => String(a.s.student_no || '').localeCompare(String(b.s.student_no || ''), undefined, { numeric: true }))
  }, [all, students])

  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const receipt = (r, running) => setDoc({
    no: `সঞ্চয়-${r.serial}`, date: r.tx_date, total: r.amount,
    title: r.kind === 'deposit' ? 'সঞ্চয় জমার রসিদ' : 'সঞ্চয় উত্তোলনের রসিদ',
    rows: [[`${KIND[r.kind]}${r.note ? ` — ${r.note}` : ''}`, r.amount]],
    meta: [['শিক্ষার্থী', nm(st)], ['আইডি', st?.student_no], ['বর্তমান ব্যালেন্স', running === undefined ? '' : taka(running)]],
  })

  async function save() {
    const amount = num(form.amount)
    if (!st || amount <= 0) return setMsg('শিক্ষার্থী বাছুন এবং সঠিক টাকার পরিমাণ লিখুন।')
    if (form.kind === 'withdraw' && amount > balance) return setMsg(`উত্তোলন হয়নি: ব্যালেন্স ${taka(balance)}, এর বেশি তোলা যাবে না।`)
    setBusy(true); setMsg('')
    const { data, error } = await supabase.from('student_savings_tx').insert({ student_id: st.id, kind: form.kind, amount, tx_date: form.tx_date || todayStr(), note: form.note.trim() || null }).select().single()
    setBusy(false)
    if (error) return setMsg(`সংরক্ষণ হয়নি: ${error.message}`)
    setForm({ ...form, amount: '', note: '' })
    setMsg(`${KIND[data.kind]} সংরক্ষিত হয়েছে।`)
    await load()
    receipt(data, balance + (data.kind === 'deposit' ? amount : -amount))
  }
  async function del(r) {
    if (!(await confirm({ name: `${KIND[r.kind]} ${taka(r.amount)}`, text: 'এই লেনদেন মুছবেন? ব্যালেন্স বদলে যাবে।' }))) return
    const { error } = await supabase.from('student_savings_tx').delete().eq('id', r.id)
    if (error) return setMsg(error.message)
    load()
  }

  // প্রতিটি লেনদেনের পর ব্যালেন্স
  let run = 0
  const hist = mine.map((r) => { run += r.kind === 'deposit' ? num(r.amount) : -num(r.amount); return { ...r, run } })
  const totalAll = balances.reduce((a, b) => a + b.bal, 0)

  return (
    <>
      <h2>শিক্ষার্থী সঞ্চয়</h2>
      <div className="tabs">
        <button className={tab === 'tx' ? 'on' : ''} onClick={() => setTab('tx')}>জমা / উত্তোলন</button>
        <button className={tab === 'bal' ? 'on' : ''} onClick={() => setTab('bal')}>সবার ব্যালেন্স ({balances.length.toLocaleString('bn-BD')})</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|সঠিক/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'tx' && (
        <>
          <div className="card form" style={{ marginBottom: 14 }}>
            <div className="grid g2">
              <div className="field"><label>শিক্ষার্থী খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
              <div className="field"><label>শিক্ষার্থী বাছুন</label><Select value={sid} onChange={setSid} options={options} placeholder="শিক্ষার্থী বাছুন" /></div>
            </div>
            {st && (
              <>
                <p style={{ margin: '4px 0 12px' }}>বর্তমান ব্যালেন্স: <b style={{ fontSize: '1.2rem' }}>{taka(balance)}</b></p>
                <div className="grid g3">
                  <div className="field"><label>ধরন</label><Select value={form.kind} onChange={(v) => up('kind', v)} options={[['deposit', 'জমা'], ['withdraw', 'উত্তোলন']]} /></div>
                  <div className="field"><label>টাকার পরিমাণ</label><input type="number" min="1" value={form.amount} onChange={(e) => up('amount', e.target.value)} /></div>
                  <div className="field"><label>তারিখ</label><input type="date" value={form.tx_date} onChange={(e) => up('tx_date', e.target.value)} /></div>
                </div>
                <div className="field"><label>নোট (ঐচ্ছিক)</label><input value={form.note} onChange={(e) => up('note', e.target.value)} /></div>
                <button className="btn" disabled={busy} onClick={save}>সংরক্ষণ ও রসিদ</button>
              </>
            )}
          </div>
          {st && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>তারিখ</th><th>ধরন</th><th>টাকা</th><th>নোট</th><th>ব্যালেন্স</th><th></th></tr></thead>
                <tbody>
                  {hist.map((r) => (
                    <tr key={r.id}>
                      <td>{dateBn(r.tx_date)}</td><td>{KIND[r.kind]}</td><td>{r.kind === 'withdraw' ? '−' : '+'}{taka(r.amount)}</td><td>{r.note}</td><td>{taka(r.run)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><button className="btn small outline" onClick={() => receipt(r, r.run)}>রসিদ</button>{' '}<button className="btn small outline" onClick={() => del(r)}>মুছুন</button></td>
                    </tr>
                  ))}
                  {!hist.length && <tr><td colSpan={6} className="muted">এখনো কোনো লেনদেন নেই।</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'bal' && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" disabled={!balances.length} onClick={() => printNode(ref.current, 'A4', '12mm', 'portrait')}>প্রিন্ট (A4)</button>
            <span>মোট জমা: <b>{taka(totalAll)}</b></span>
          </div>
          <div className="adm-scroll"><div ref={ref} style={{ background: '#fff', color: '#000', padding: 16, minWidth: 480 }}>
            <h3 style={{ textAlign: 'center', marginTop: 0 }}>শিক্ষার্থী সঞ্চয় — ব্যালেন্স তালিকা ({dateBn(todayStr())})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['ক্রম', 'আইডি', 'নাম', 'ব্যালেন্স'].map((h) => <th key={h} style={{ border: '1px solid #444', padding: '3px 6px', textAlign: 'start', background: '#eee' }}>{h}</th>)}</tr></thead>
              <tbody>
                {balances.map((b, i) => <tr key={b.s.id}>{[(i + 1).toLocaleString('bn-BD'), b.s.student_no, nm(b.s), taka(b.bal)].map((c, j) => <td key={j} style={{ border: '1px solid #444', padding: '3px 6px' }}>{c}</td>)}</tr>)}
                {!balances.length && <tr><td colSpan={4} style={{ border: '1px solid #444', padding: '3px 6px' }}>কোনো জমা নেই</td></tr>}
                {balances.length > 0 && <tr><td colSpan={3} style={{ border: '1px solid #444', padding: '3px 6px', fontWeight: 700 }}>মোট</td><td style={{ border: '1px solid #444', padding: '3px 6px', fontWeight: 700 }}>{taka(totalAll)}</td></tr>}
              </tbody>
            </table>
          </div></div>
        </>
      )}
      {doc && <PrintDoc kind="fee" title={doc.title} no={doc.no} date={doc.date} rows={doc.rows} total={doc.total} meta={doc.meta} onClose={() => setDoc(null)} />}
    </>
  )
}
