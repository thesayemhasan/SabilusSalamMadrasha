import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useAuth, useSite } from '../../lib/store'
import { Select } from '../../components/Ui'
import { nm, num, todayStr } from './fin'
import DailyLesson from './DailyLesson'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const STATUS = [['present', 'উপস্থিত'], ['absent', 'অনুপস্থিত'], ['late', 'দেরি'], ['leave', 'ছুটি']]

function TLogin() {
  const { signIn } = useAuth()
  const { settings } = useSite()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await signIn(email, pw)
    setBusy(false)
    if (error) setErr(`লগইন হয়নি: ${error.message}`)
  }
  return (
    <div className="login-wrap">
      <form className="card form login-box" onSubmit={submit}>
        <div className="center">
          <img src={settings.logo_url} alt="" style={{ width: 84, height: 84, margin: '0 auto 8px', objectFit: 'contain' }} />
          <h2 style={{ marginBottom: 2 }}>শিক্ষক লগইন</h2>
          <div className="muted">সাবিলুস সালাম মাদরাসা</div>
        </div>
        <div className="field"><label>ইমেইল</label><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>পাসওয়ার্ড</label><input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <div className="alert err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'প্রবেশ করুন'}</button>
        <Link to="/" className="center muted">← ওয়েবসাইটে ফিরুন</Link>
      </form>
    </div>
  )
}

function useClassStudents(cls) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!cls) return setList([])
    fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,class_id,status').eq('class_id', cls).eq('status', 'active').order('student_no').order('id').range(a, b)).then(({ data }) => setList(data || []))
  }, [cls])
  return list
}

function Attend({ classes }) {
  const [cls, setCls] = useState('')
  const [date, setDate] = useState(todayStr())
  const students = useClassStudents(cls)
  const [st, setSt] = useState({})
  const [msg, setMsg] = useState('')
  useEffect(() => {
    setMsg('')
    if (!cls) return setSt({})
    supabase.from('attendance').select('person_id,status').eq('person_type', 'student').eq('date', date).eq('session', 'day').then(({ data }) => {
      const m = {}
      ;(data || []).forEach((r) => { m[r.person_id] = r.status })
      setSt(m)
    })
  }, [cls, date])
  const setAll = (v) => setSt(Object.fromEntries(students.map((s) => [s.id, v])))
  async function save() {
    const rows = students.filter((s) => st[s.id]).map((s) => ({ person_type: 'student', person_id: s.id, date, session: 'day', status: st[s.id], source: 'manual' }))
    if (!rows.length) return setMsg('কারও হাজিরা বাছা হয়নি।')
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'person_type,person_id,date,session' })
    setMsg(error ? `সংরক্ষণ হয়নি: ${error.message}` : `${bn(rows.length)} জনের হাজিরা সংরক্ষিত হয়েছে।`)
  }
  return (
    <>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <div className="field"><label>শ্রেণি</label><Select value={cls} onChange={setCls} options={classes.map((c) => [c.id, nm(c)])} placeholder="শ্রেণি বাছুন" /></div>
        <div className="field"><label>তারিখ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      {cls && (
        <>
          <div className="row-actions" style={{ marginBottom: 10 }}>
            <button className="btn small outline" onClick={() => setAll('present')}>সবাই উপস্থিত</button>
            <button className="btn small outline" onClick={() => setAll('')}>পরিষ্কার</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>আইডি</th><th>নাম</th><th>অবস্থা</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.student_no}</td><td>{nm(s)}</td>
                  <td><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {STATUS.map(([k, l]) => <label key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" name={`a-${s.id}`} checked={st[s.id] === k} onChange={() => setSt((v) => ({ ...v, [s.id]: k }))} />{l}</label>)}
                  </div></td>
                </tr>
              ))}
              {!students.length && <tr><td colSpan={3} className="muted">এই শ্রেণিতে সক্রিয় শিক্ষার্থী নেই</td></tr>}
            </tbody>
          </table></div>
          {msg && <div className={`alert ${/হয়নি|বাছা/.test(msg) ? 'err' : 'ok'}`} style={{ marginTop: 10 }}>{msg}</div>}
          <button className="btn" style={{ marginTop: 12 }} onClick={save}>হাজিরা সংরক্ষণ</button>
        </>
      )}
    </>
  )
}

function Marks({ classes }) {
  const [exams, setExams] = useState([])
  const [exam, setExam] = useState('')
  const [cls, setCls] = useState('')
  const [subs, setSubs] = useState([])
  const [subj, setSubj] = useState('')
  const students = useClassStudents(cls)
  const [vals, setVals] = useState({})
  const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('exams').select('id,name_bn,name_en').order('created_at', { ascending: false }).then(({ data }) => setExams(data || [])) }, [])
  useEffect(() => {
    setSubj('')
    if (!exam || !cls) return setSubs([])
    supabase.from('exam_subjects').select('*').eq('exam_id', exam).eq('class_id', cls).order('sort').then(({ data }) => setSubs(data || []))
  }, [exam, cls])
  const sub = subs.find((s) => s.id === subj)
  useEffect(() => {
    setMsg('')
    if (!subj) return setVals({})
    supabase.from('exam_marks').select('student_id,marks,absent').eq('subject_id', subj).then(({ data }) => {
      const m = {}
      ;(data || []).forEach((r) => { m[r.student_id] = { marks: r.marks ?? '', absent: r.absent } })
      setVals(m)
    })
  }, [subj])
  const set = (id, patch) => setVals((v) => ({ ...v, [id]: { marks: '', absent: false, ...v[id], ...patch } }))
  async function save() {
    setMsg('')
    const rows = []
    for (const s of students) {
      const v = vals[s.id]
      if (!v || (v.marks === '' && !v.absent)) continue
      const n = v.absent ? null : num(v.marks)
      if (n !== null && (n < 0 || n > sub.full_marks)) return setMsg(`${nm(s)}: নম্বর ০ থেকে ${bn(sub.full_marks)} এর মধ্যে হতে হবে`)
      rows.push({ exam_id: exam, subject_id: subj, student_id: s.id, marks: n, absent: !!v.absent, updated_at: new Date().toISOString() })
    }
    if (!rows.length) return setMsg('কোনো নম্বর দেওয়া হয়নি')
    const { error } = await supabase.from('exam_marks').upsert(rows, { onConflict: 'subject_id,student_id' })
    setMsg(error ? `সংরক্ষণ হয়নি: ${error.message}` : `${bn(rows.length)} জনের নম্বর সংরক্ষিত হয়েছে`)
  }
  return (
    <>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        <div className="field"><label>পরীক্ষা</label><Select value={exam} onChange={setExam} options={exams.map((e) => [e.id, nm(e)])} placeholder="পরীক্ষা বাছুন" /></div>
        <div className="field"><label>শ্রেণি</label><Select value={cls} onChange={setCls} options={classes.map((c) => [c.id, nm(c)])} placeholder="শ্রেণি বাছুন" /></div>
        <div className="field"><label>বিষয়</label><Select value={subj} onChange={setSubj} options={subs.map((s) => [s.id, nm(s)])} placeholder="বিষয় বাছুন" /></div>
      </div>
      {exam && cls && !subs.length && <div className="alert info">এই শ্রেণির জন্য এখনো পরীক্ষার বিষয় যোগ হয়নি। অ্যাডমিনকে জানান।</div>}
      {sub && (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th>আইডি</th><th>নাম</th><th>নম্বর (পূর্ণমান {bn(sub.full_marks)})</th><th>অনুপস্থিত</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const v = vals[s.id] || { marks: '', absent: false }
                return (
                  <tr key={s.id}>
                    <td>{s.student_no}</td><td>{nm(s)}</td>
                    <td><input type="number" min="0" max={sub.full_marks} step="0.5" disabled={v.absent} value={v.absent ? '' : v.marks} onChange={(e) => set(s.id, { marks: e.target.value })} style={{ maxWidth: 120 }} /></td>
                    <td><input type="checkbox" checked={!!v.absent} onChange={(e) => set(s.id, { absent: e.target.checked })} /></td>
                  </tr>
                )
              })}
              {!students.length && <tr><td colSpan={4} className="muted">এই শ্রেণিতে সক্রিয় শিক্ষার্থী নেই</td></tr>}
            </tbody>
          </table></div>
          {msg && <div className={`alert ${/হয়নি|হতে/.test(msg) ? 'err' : 'ok'}`} style={{ marginTop: 10 }}>{msg}</div>}
          <button className="btn" style={{ marginTop: 12 }} onClick={save}>নম্বর সংরক্ষণ</button>
        </>
      )}
    </>
  )
}

export default function TeacherPortal() {
  const { session, profile, loading, signOut, isStaff } = useAuth()
  const { modules } = useSite()
  const [tab, setTab] = useState('mine')
  const [rows, setRows] = useState([])
  const [classes, setClasses] = useState([])
  const [me, setMe] = useState(null)
  const load = useCallback(async () => {
    const { data: ts } = await supabase.from('teacher_subjects').select('*').order('created_at')
    setRows(ts || [])
    const { data: cl } = await supabase.from('classes').select('id,name_bn,name_en,sort').order('sort')
    setClasses(cl || [])
    if (profile?.staff_id) {
      const { data } = await supabase.from('staff').select('id,name_bn,name_en,designation_bn').eq('id', profile.staff_id).maybeSingle()
      setMe(data)
    }
  }, [profile?.staff_id])
  const isT = profile?.role === 'teacher'
  useEffect(() => { if (isT) load() }, [isT, load])
  const mine = useMemo(() => {
    const ids = new Set(rows.map((r) => r.class_id).filter(Boolean))
    return classes.filter((c) => ids.has(c.id))
  }, [rows, classes])
  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])

  if (loading) return <div className="login-wrap"><p>লোড হচ্ছে…</p></div>
  if (!session) return <TLogin />
  if (isStaff) return <Navigate to="/admin" replace />
  if (modules.teacher_portal === false) return <div className="login-wrap"><div className="card login-box"><h2>শিক্ষক পোর্টাল বন্ধ আছে</h2><button className="btn outline" onClick={signOut}>লগআউট</button></div></div>
  if (!isT || !profile.staff_id) {
    return (
      <div className="login-wrap"><div className="card login-box">
        <h2>অ্যাক্সেস নেই</h2>
        <p>এই অ্যাকাউন্টটি শিক্ষক হিসেবে যুক্ত নয়। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
        <button className="btn outline" onClick={signOut}>লগআউট</button>
      </div></div>
    )
  }
  return (
    <div className="container" style={{ padding: '18px 14px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div><h2 style={{ margin: 0 }}>শিক্ষক পোর্টাল</h2><div className="muted">{nm(me) !== '—' ? nm(me) : profile.full_name}{me?.designation_bn ? ` · ${me.designation_bn}` : ''}</div></div>
        <button className="btn outline" onClick={signOut}>লগআউট</button>
      </div>
      <div className="tabs">
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>আমার ক্লাস</button>
        <button className={tab === 'att' ? 'on' : ''} onClick={() => setTab('att')}>হাজিরা</button>
        <button className={tab === 'marks' ? 'on' : ''} onClick={() => setTab('marks')}>নম্বর এন্ট্রি</button>
        {modules.daily_lesson !== false && <button className={tab === 'lesson' ? 'on' : ''} onClick={() => setTab('lesson')}>দৈনিক পাঠ</button>}
      </div>
      {tab === 'mine' && (
        <div className="table-wrap"><table>
          <thead><tr><th>শ্রেণি</th><th>বিষয়</th><th>সপ্তাহে পিরিয়ড</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td>{cname[r.class_id] || '—'}</td><td>{r.subject}</td><td>{r.periods_per_week ? bn(r.periods_per_week) : ''}</td></tr>)}
            {!rows.length && <tr><td colSpan={3} className="muted">আপনার জন্য এখনো কোনো শ্রেণি/বিষয় নির্ধারিত হয়নি। অ্যাডমিনকে জানান।</td></tr>}
          </tbody>
        </table></div>
      )}
      {tab === 'att' && (mine.length ? <Attend classes={mine} /> : <div className="alert info">কোনো শ্রেণি নির্ধারিত নেই।</div>)}
      {tab === 'marks' && (mine.length ? <Marks classes={mine} /> : <div className="alert info">কোনো শ্রেণি নির্ধারিত নেই।</div>)}
      {tab === 'lesson' && (mine.length ? <DailyLesson classes={mine} /> : <div className="alert info">কোনো শ্রেণি নির্ধারিত নেই।</div>)}
    </div>
  )
}
