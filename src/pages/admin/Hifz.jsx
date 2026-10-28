import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm } from '../../components/Ui'
import { downloadCsv } from './Crud'
import { monthStr, nm, num, todayStr } from './fin'
import { useClassList } from './Exams'

const KINDS = [['sabaq', 'সবক'], ['sabaqi', 'সাত সবক'], ['manzil', 'আমুখতা / শবিনা']]
const KL = Object.fromEntries(KINDS)
const QUAL = [['excellent', 'অতি উত্তম'], ['good', 'ভালো'], ['average', 'মোটামুটি'], ['weak', 'দুর্বল']]
const QL = Object.fromEntries(QUAL)
const bn = (n, d = 0) => Number(n).toLocaleString('bn-BD', { maximumFractionDigits: d })

function useStudents(cls) {
  const [list, setList] = useState([])
  useEffect(() => {
    fetchAll((a, b) => {
      let q = supabase.from('students').select('*').eq('status', 'active').order('student_no').order('id').range(a, b)
      if (cls) q = q.eq('class_id', cls)
      return q
    }).then(({ data }) => setList(data || []))
  }, [cls])
  return list
}

function Daily({ classes }) {
  const confirm = useConfirm()
  const [date, setDate] = useState(todayStr())
  const [cls, setCls] = useState('')
  const students = useStudents(cls)
  const [stu, setStu] = useState('')
  const [f, setF] = useState({ kind: 'sabaq', para: '', detail: '', pages: '', quality: 'good', note: '' })
  const [logs, setLogs] = useState([])
  const [names, setNames] = useState({})
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('hifz_logs').select('*').eq('log_date', date).order('created_at', { ascending: false })
    setLogs(data || [])
    const ids = [...new Set((data || []).map((l) => l.student_id))]
    if (ids.length) {
      const { data: st } = await supabase.from('students').select('*').in('id', ids)
      setNames(Object.fromEntries((st || []).map((x) => [x.id, x])))
    }
  }, [date])
  useEffect(() => { load() }, [load])
  async function add(e) {
    e.preventDefault()
    setErr('')
    if (!stu) return setErr('আগে ছাত্র বাছুন')
    const { error } = await supabase.from('hifz_logs').insert({ student_id: stu, log_date: date, kind: f.kind, para: f.para ? Number(f.para) : null, detail: f.detail || null, pages: num(f.pages), quality: f.quality || null, note: f.note || null })
    if (error) return setErr(error.message)
    setF({ ...f, detail: '', pages: '', note: '' })
    load()
  }
  async function del(l) {
    if (!(await confirm({ name: nm(names[l.student_id]), text: 'এই এন্ট্রি মুছবেন?', ok: 'হ্যাঁ, মুছুন' }))) return
    await supabase.from('hifz_logs').delete().eq('id', l.id)
    load()
  }
  return (
    <>
      <form onSubmit={add} className="card form" style={{ marginBottom: 16 }}>
        <div className="grid g3">
          <div className="field"><label>তারিখ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>শ্রেণি / হালকা (ফিল্টার)</label><Select placeholder="সব" value={cls} onChange={(v) => { setCls(v); setStu('') }} options={[['', 'সব'], ...classes.map((c) => [c.id, nm(c)])]} /></div>
          <div className="field"><label>ছাত্র</label><Select placeholder="ছাত্র বাছুন" value={stu} onChange={setStu} options={students.map((s) => [s.id, `${s.student_no} — ${nm(s)}`])} /></div>
          <div className="field"><label>ধরন</label><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={KINDS} /></div>
          <div className="field"><label>পারা (১–৩০)</label><input type="number" min="1" max="30" value={f.para} onChange={(e) => setF({ ...f, para: e.target.value })} /></div>
          <div className="field"><label>পৃষ্ঠা / পরিমাণ</label><input type="number" min="0" step="0.5" value={f.pages} onChange={(e) => setF({ ...f, pages: e.target.value })} /></div>
          <div className="field"><label>সূরা / রুকু / বিবরণ</label><input value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></div>
          <div className="field"><label>মান</label><Select value={f.quality} onChange={(v) => setF({ ...f, quality: v })} options={QUAL} /></div>
          <div className="field"><label>মন্তব্য</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div>
        {err && <div className="alert err">{err}</div>}
        <button className="btn">এন্ট্রি যোগ করুন</button>
      </form>
      <h3>{date} এর এন্ট্রি ({bn(logs.length)})</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>ছাত্র</th><th>ধরন</th><th>পারা</th><th>বিবরণ</th><th>পৃষ্ঠা</th><th>মান</th><th></th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{nm(names[l.student_id])}</td><td>{KL[l.kind]}</td><td>{l.para ? bn(l.para) : '—'}</td><td>{l.detail || '—'}</td><td>{bn(l.pages, 1)}</td><td>{QL[l.quality] || '—'}</td>
              <td><button className="btn small danger" onClick={() => del(l)}>মুছুন</button></td>
            </tr>
          ))}
          {!logs.length && <tr><td colSpan={7} className="muted">এই তারিখে কোনো এন্ট্রি নেই</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

function Progress({ classes }) {
  const [month, setMonth] = useState(monthStr())
  const [cls, setCls] = useState('')
  const students = useStudents(cls)
  const [logs, setLogs] = useState([])
  const [all, setAll] = useState([])
  useEffect(() => {
    const from = `${month}-01`
    const to = `${month}-31`
    fetchAll((a, b) => supabase.from('hifz_logs').select('*').gte('log_date', from).lte('log_date', to).order('id').range(a, b)).then(({ data }) => setLogs(data || []))
    fetchAll((a, b) => supabase.from('hifz_logs').select('student_id,kind,pages,para,log_date').eq('kind', 'sabaq').order('id').range(a, b)).then(({ data }) => setAll(data || []))
  }, [month])
  const rows = useMemo(() => students.map((s) => {
    const mine = logs.filter((l) => l.student_id === s.id)
    const sum = (k) => mine.filter((l) => l.kind === k).reduce((a, l) => a + num(l.pages), 0)
    const life = all.filter((l) => l.student_id === s.id)
    const last = life.sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
    return { s, sabaq: sum('sabaq'), sabaqi: sum('sabaqi'), manzil: sum('manzil'), days: new Set(mine.map((l) => l.log_date)).size, total: life.reduce((a, l) => a + num(l.pages), 0), lastPara: last?.para }
  }), [students, logs, all])
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }} />
        <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি / হালকা" value={cls} onChange={setCls} options={[['', 'সব'], ...classes.map((c) => [c.id, nm(c)])]} /></div>
        <button className="btn outline" onClick={() => downloadCsv(`হিফজ-${month}.csv`, ['আইডি', 'নাম', 'সবক (পৃষ্ঠা)', 'সাত সবক', 'আমুখতা', 'সক্রিয় দিন', 'মোট সবক', 'সর্বশেষ পারা'], rows.map((r) => [r.s.student_no, nm(r.s), r.sabaq, r.sabaqi, r.manzil, r.days, r.total, r.lastPara || '']))}>CSV</button>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>ছাত্র</th><th>সবক</th><th>সাত সবক</th><th>আমুখতা</th><th>দিন</th><th>মোট সবক</th><th>সর্বশেষ পারা</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.s.id}><td>{r.s.student_no} — {nm(r.s)}</td><td>{bn(r.sabaq, 1)}</td><td>{bn(r.sabaqi, 1)}</td><td>{bn(r.manzil, 1)}</td><td>{bn(r.days)}</td><td>{bn(r.total, 1)}</td><td>{r.lastPara ? bn(r.lastPara) : '—'}</td></tr>)}
          {!rows.length && <tr><td colSpan={7} className="muted">কোনো ছাত্র নেই</td></tr>}
        </tbody>
      </table></div>
      <p className="muted" style={{ marginTop: 8 }}>সংখ্যাগুলো পৃষ্ঠার হিসাবে। “মোট সবক” শুরু থেকে এখন পর্যন্ত।</p>
    </>
  )
}

export default function Hifz() {
  const [tab, setTab] = useState('daily')
  const classes = useClassList()
  return (
    <>
      <h2>হিফজ ট্র্যাকিং</h2>
      <div className="tabs">
        <button className={tab === 'daily' ? 'on' : ''} onClick={() => setTab('daily')}>দৈনিক এন্ট্রি</button>
        <button className={tab === 'progress' ? 'on' : ''} onClick={() => setTab('progress')}>মাসিক অগ্রগতি</button>
      </div>
      {tab === 'daily' ? <Daily classes={classes} /> : <Progress classes={classes} />}
    </>
  )
}
