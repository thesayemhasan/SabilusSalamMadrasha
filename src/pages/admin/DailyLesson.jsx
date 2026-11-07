import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select } from '../../components/Ui'
import { nm, todayStr, addDays } from './fin'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const RATE = [['excellent', 'খুব ভালো'], ['good', 'ভালো'], ['average', 'মোটামুটি'], ['weak', 'দুর্বল'], ['none', 'পড়া করেনি']]
const RL = Object.fromEntries(RATE)

function useStudents(cls) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!cls) return setList([])
    fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en').eq('class_id', cls).eq('status', 'active').order('student_no').order('id').range(a, b)).then(({ data }) => setList(data || []))
  }, [cls])
  return list
}

// দৈনিক পাঠ মূল্যায়ন: প্রবেশ ও রিপোর্ট (অ্যাডমিন ও শিক্ষক পোর্টাল উভয়ে ব্যবহার করে)
export default function DailyLesson({ classes: given }) {
  const [classes, setClasses] = useState(given || [])
  const [tab, setTab] = useState('entry')
  const [cls, setCls] = useState('')
  const [date, setDate] = useState(todayStr())
  const [subject, setSubject] = useState('')
  const [subjects, setSubjects] = useState([])
  const students = useStudents(cls)
  const [vals, setVals] = useState({})
  const [msg, setMsg] = useState('')
  const [from, setFrom] = useState(addDays(todayStr(), -29))
  const [to, setTo] = useState(todayStr())
  const [rep, setRep] = useState([])

  useEffect(() => {
    if (given) return setClasses(given)
    supabase.from('classes').select('id,name_bn,name_en,sort').order('sort').then(({ data }) => setClasses(data || []))
  }, [given])
  useEffect(() => {
    if (!cls) return setSubjects([])
    supabase.from('teacher_subjects').select('subject').eq('class_id', cls).then(({ data }) => setSubjects([...new Set((data || []).map((r) => r.subject))]))
  }, [cls])
  useEffect(() => {
    setMsg('')
    if (!cls || tab !== 'entry') return setVals({})
    supabase.from('daily_lessons').select('student_id,rating,note').eq('lesson_date', date).eq('subject', subject.trim()).then(({ data }) => {
      const m = {}
      ;(data || []).forEach((r) => { m[r.student_id] = { rating: r.rating, note: r.note || '' } })
      setVals(m)
    })
  }, [cls, date, subject, tab])
  useEffect(() => {
    if (!cls || tab !== 'rep') return
    fetchAll((a, b) => supabase.from('daily_lessons').select('student_id,rating,lesson_date').gte('lesson_date', from).lte('lesson_date', to).order('id').range(a, b)).then(({ data }) => setRep(data || []))
  }, [cls, tab, from, to])

  const set = (id, patch) => setVals((v) => ({ ...v, [id]: { rating: '', note: '', ...v[id], ...patch } }))
  async function save() {
    const rows = students.filter((s) => vals[s.id]?.rating).map((s) => ({ student_id: s.id, lesson_date: date, subject: subject.trim(), rating: vals[s.id].rating, note: vals[s.id].note?.trim() || null }))
    if (!rows.length) return setMsg('কারও মূল্যায়ন বাছা হয়নি।')
    const { error } = await supabase.from('daily_lessons').upsert(rows, { onConflict: 'student_id,lesson_date,subject' })
    setMsg(error ? `সংরক্ষণ হয়নি: ${error.message}` : `${bn(rows.length)} জনের মূল্যায়ন সংরক্ষিত হয়েছে।`)
  }
  const summary = useMemo(() => {
    const ids = new Set(students.map((s) => s.id))
    const m = {}
    rep.filter((r) => ids.has(r.student_id)).forEach((r) => { const o = (m[r.student_id] = m[r.student_id] || { n: 0 }); o.n++; o[r.rating] = (o[r.rating] || 0) + 1 })
    return m
  }, [rep, students])

  return (
    <>
      <div className="tabs">
        <button className={tab === 'entry' ? 'on' : ''} onClick={() => setTab('entry')}>দৈনিক মূল্যায়ন</button>
        <button className={tab === 'rep' ? 'on' : ''} onClick={() => setTab('rep')}>সারসংক্ষেপ</button>
      </div>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        <div className="field"><label>শ্রেণি</label><Select value={cls} onChange={setCls} options={classes.map((c) => [c.id, nm(c)])} placeholder="শ্রেণি বাছুন" /></div>
        {tab === 'entry' ? (
          <>
            <div className="field"><label>তারিখ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label>বিষয় / কিতাব (ঐচ্ছিক)</label><input list="dl-subj" value={subject} onChange={(e) => setSubject(e.target.value)} /><datalist id="dl-subj">{subjects.map((s) => <option key={s} value={s} />)}</datalist></div>
          </>
        ) : (
          <>
            <div className="field"><label>শুরু</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field"><label>শেষ</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
      </div>
      {cls && tab === 'entry' && (
        <>
          <div className="row-actions" style={{ marginBottom: 10 }}>
            <button className="btn small outline" onClick={() => setVals(Object.fromEntries(students.map((s) => [s.id, { note: '', ...vals[s.id], rating: 'good' }])))}>সবাইকে “ভালো”</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>আইডি</th><th>নাম</th><th>মূল্যায়ন</th><th>নোট</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.student_no}</td><td>{nm(s)}</td>
                  <td><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{RATE.map(([k, l]) => <label key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" name={`r-${s.id}`} checked={vals[s.id]?.rating === k} onChange={() => set(s.id, { rating: k })} />{l}</label>)}</div></td>
                  <td><input value={vals[s.id]?.note || ''} onChange={(e) => set(s.id, { note: e.target.value })} style={{ minWidth: 120 }} /></td>
                </tr>
              ))}
              {!students.length && <tr><td colSpan={4} className="muted">এই শ্রেণিতে সক্রিয় শিক্ষার্থী নেই</td></tr>}
            </tbody>
          </table></div>
          {msg && <div className={`alert ${/হয়নি/.test(msg) ? 'err' : 'ok'}`} style={{ marginTop: 10 }}>{msg}</div>}
          <button className="btn" style={{ marginTop: 12 }} onClick={save}>মূল্যায়ন সংরক্ষণ</button>
        </>
      )}
      {cls && tab === 'rep' && (
        <div className="table-wrap"><table>
          <thead><tr><th>আইডি</th><th>নাম</th><th>মোট দিন</th>{RATE.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {students.map((s) => { const o = summary[s.id] || {}; return <tr key={s.id}><td>{s.student_no}</td><td>{nm(s)}</td><td>{bn(o.n || 0)}</td>{RATE.map(([k]) => <td key={k}>{bn(o[k] || 0)}</td>)}</tr> })}
            {!students.length && <tr><td colSpan={8} className="muted">এই শ্রেণিতে সক্রিয় শিক্ষার্থী নেই</td></tr>}
          </tbody>
        </table></div>
      )}
    </>
  )
}
export { RL }
