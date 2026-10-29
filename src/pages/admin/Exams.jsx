import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useYear, useEnrolled, examInYear, inYearStudents } from '../../lib/year'
import { useAuth, useSite } from '../../lib/store'
import { Select, useConfirm } from '../../components/Ui'
import { downloadCsv } from './Crud'
import { dateBn, nm, num, printNode, printedAt } from './fin'

// গ্রেড স্কেল (মাদরাসা বোর্ডের প্রচলিত ধাঁচ): শতকরা নম্বর → গ্রেড, পয়েন্ট
export const GRADES = [[80, 'A+', 5], [70, 'A', 4], [60, 'A-', 3.5], [50, 'B', 3], [40, 'C', 2], [33, 'D', 1], [0, 'F', 0]]
const gradeOf = (pct) => GRADES.find(([min]) => pct >= min)
const bn = (n, d = 0) => Number(n).toLocaleString('bn-BD', { maximumFractionDigits: d, minimumFractionDigits: d })

export function useClassList() {
  const [list, setList] = useState([])
  useEffect(() => { supabase.from('classes').select('*').order('sort', { ascending: true }).then(({ data }) => setList(data || [])) }, [])
  return list
}

function useExams() {
  const { year } = useYear()
  const [raw, setRaw] = useState([])
  const load = useCallback(async () => {
    const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false })
    setRaw(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  const list = useMemo(() => raw.filter((x) => examInYear(x, year)), [raw, year])
  return [list, load]
}

/* ---------- পরীক্ষা ---------- */
function ExamList({ exams, reload }) {
  const confirm = useConfirm()
  const { year: ay } = useYear()
  const empty = { name_bn: '', name_en: '', year: ay ? ay.name_bn : String(new Date().getFullYear()), date_from: '', date_to: '' }
  const [f, setF] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [err, setErr] = useState('')
  async function save(e) {
    e.preventDefault()
    setErr('')
    const row = { ...f, date_from: f.date_from || null, date_to: f.date_to || null }
    const { error } = editId ? await supabase.from('exams').update(row).eq('id', editId) : await supabase.from('exams').insert(row)
    if (error) return setErr(error.message)
    setF(empty); setEditId(null); reload()
  }
  async function del(x) {
    if (!(await confirm({ name: nm(x), text: 'পরীক্ষা মুছলে এর বিষয় ও সব নম্বরও মুছে যাবে। নিশ্চিত?', ok: 'হ্যাঁ, মুছুন' }))) return
    await supabase.from('exams').delete().eq('id', x.id)
    reload()
  }
  return (
    <>
      <form onSubmit={save} className="card form" style={{ marginBottom: 16 }}>
        <h3>{editId ? 'পরীক্ষা সম্পাদনা' : 'নতুন পরীক্ষা'}</h3>
        <div className="grid g3">
          <div className="field"><label>নাম (বাংলা)</label><input required value={f.name_bn} onChange={(e) => setF({ ...f, name_bn: e.target.value })} placeholder="প্রথম সাময়িক পরীক্ষা" /></div>
          <div className="field"><label>নাম (ইংরেজি)</label><input value={f.name_en || ''} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
          <div className="field"><label>শিক্ষাবর্ষ</label><input value={f.year || ''} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
          <div className="field"><label>শুরুর তারিখ</label><input type="date" value={f.date_from || ''} onChange={(e) => setF({ ...f, date_from: e.target.value })} /></div>
          <div className="field"><label>শেষের তারিখ</label><input type="date" value={f.date_to || ''} onChange={(e) => setF({ ...f, date_to: e.target.value })} /></div>
        </div>
        {err && <div className="alert err">{err}</div>}
        <div className="row-actions">
          <button className="btn">{editId ? 'সংরক্ষণ' : 'যোগ করুন'}</button>
          {editId && <button type="button" className="btn outline" onClick={() => { setEditId(null); setF(empty) }}>বাতিল</button>}
        </div>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>পরীক্ষা</th><th>শিক্ষাবর্ষ</th><th>তারিখ</th><th></th></tr></thead>
        <tbody>
          {exams.map((x) => (
            <tr key={x.id}>
              <td><b>{nm(x)}</b></td><td>{x.year}</td>
              <td>{x.date_from ? `${dateBn(x.date_from)}${x.date_to ? ` – ${dateBn(x.date_to)}` : ''}` : '—'}</td>
              <td><div className="row-actions">
                <button className="btn small outline" onClick={() => { setEditId(x.id); setF({ name_bn: x.name_bn || '', name_en: x.name_en || '', year: x.year || '', date_from: x.date_from || '', date_to: x.date_to || '' }) }}>সম্পাদনা</button>
                <button className="btn small danger" onClick={() => del(x)}>মুছুন</button>
              </div></td>
            </tr>
          ))}
          {!exams.length && <tr><td colSpan={4} className="muted">এখনো কোনো পরীক্ষা নেই</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

const examOpts = (exams) => exams.map((e) => [e.id, `${nm(e)}${e.year ? ` (${e.year})` : ''}`])
const classOpts = (cl) => cl.map((c) => [c.id, nm(c)])

function Pickers({ exams, classes, exam, setExam, cls, setCls, children }) {
  return (
    <div className="filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ minWidth: 220 }}><Select placeholder="পরীক্ষা বাছুন" value={exam} onChange={setExam} options={examOpts(exams)} /></div>
      <div style={{ minWidth: 180 }}><Select placeholder="শ্রেণি বাছুন" value={cls} onChange={setCls} options={classOpts(classes)} /></div>
      {children}
    </div>
  )
}

function useSubjects(exam, cls) {
  const [list, setList] = useState([])
  const load = useCallback(async () => {
    if (!exam || !cls) return setList([])
    const { data } = await supabase.from('exam_subjects').select('*').eq('exam_id', exam).eq('class_id', cls).order('sort')
    setList(data || [])
  }, [exam, cls])
  useEffect(() => { load() }, [load])
  return [list, load]
}

/* ---------- বিষয় ---------- */
function Subjects({ exams, classes }) {
  const confirm = useConfirm()
  const [exam, setExam] = useState('')
  const [cls, setCls] = useState('')
  const [subs, reload] = useSubjects(exam, cls)
  const [f, setF] = useState({ name_bn: '', full_marks: 100, pass_marks: 33, exam_date: '', exam_time: '' })
  const [err, setErr] = useState('')
  async function add(e) {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.from('exam_subjects').insert({ exam_id: exam, class_id: cls, name_bn: f.name_bn, full_marks: num(f.full_marks), pass_marks: num(f.pass_marks), exam_date: f.exam_date || null, exam_time: f.exam_time || null, sort: subs.length })
    if (error) return setErr(error.message)
    setF({ name_bn: '', full_marks: f.full_marks, pass_marks: f.pass_marks, exam_date: '', exam_time: '' })
    reload()
  }
  async function del(s) {
    if (!(await confirm({ name: nm(s), text: 'বিষয় মুছলে এর নম্বরও মুছে যাবে। নিশ্চিত?', ok: 'হ্যাঁ, মুছুন' }))) return
    await supabase.from('exam_subjects').delete().eq('id', s.id)
    reload()
  }
  async function copyFrom() {
    // একই পরীক্ষার অন্য শ্রেণি থেকে বিষয়ের তালিকা কপি
    const { data } = await supabase.from('exam_subjects').select('*').eq('exam_id', exam).neq('class_id', cls).order('sort')
    const seen = new Set()
    const src = (data || []).filter((x) => { const k = nm(x); if (seen.has(k)) return false; seen.add(k); return true })
    if (!src.length) return setErr('কপি করার মতো অন্য শ্রেণির বিষয় নেই')
    if (!(await confirm({ danger: false, name: `${src.length}টি বিষয়`, text: 'অন্য শ্রেণির বিষয়গুলো এই শ্রেণিতে কপি করবেন?', ok: 'হ্যাঁ, কপি করুন' }))) return
    await supabase.from('exam_subjects').insert(src.map((x, i) => ({ exam_id: exam, class_id: cls, name_bn: x.name_bn, name_en: x.name_en, full_marks: x.full_marks, pass_marks: x.pass_marks, sort: subs.length + i })))
    reload()
  }
  return (
    <>
      <Pickers exams={exams} classes={classes} exam={exam} setExam={setExam} cls={cls} setCls={setCls} />
      {exam && cls && (
        <>
          <form onSubmit={add} className="card form" style={{ marginBottom: 14 }}>
            <div className="grid g3">
              <div className="field"><label>বিষয়ের নাম</label><input required value={f.name_bn} onChange={(e) => setF({ ...f, name_bn: e.target.value })} /></div>
              <div className="field"><label>পূর্ণমান</label><input type="number" min="1" step="any" value={f.full_marks} onChange={(e) => setF({ ...f, full_marks: e.target.value })} /></div>
              <div className="field"><label>পাশ নম্বর</label><input type="number" min="0" step="any" value={f.pass_marks} onChange={(e) => setF({ ...f, pass_marks: e.target.value })} /></div>
              <div className="field"><label>পরীক্ষার তারিখ (প্রবেশপত্রের রুটিনে যাবে)</label><input type="date" value={f.exam_date} onChange={(e) => setF({ ...f, exam_date: e.target.value })} /></div>
              <div className="field"><label>সময়</label><input value={f.exam_time} onChange={(e) => setF({ ...f, exam_time: e.target.value })} placeholder="সকাল ১০টা" /></div>
            </div>
            {err && <div className="alert err">{err}</div>}
            <div className="row-actions"><button className="btn">বিষয় যোগ</button><button type="button" className="btn outline" onClick={copyFrom}>অন্য শ্রেণি থেকে কপি</button></div>
          </form>
          <div className="table-wrap"><table>
            <thead><tr><th>বিষয়</th><th>পূর্ণমান</th><th>পাশ নম্বর</th><th>তারিখ ও সময়</th><th></th></tr></thead>
            <tbody>
              {subs.map((s) => <tr key={s.id}><td>{nm(s)}</td><td>{bn(s.full_marks)}</td><td>{bn(s.pass_marks)}</td><td>{s.exam_date ? `${dateBn(s.exam_date)} ${s.exam_time || ''}` : '—'}</td><td><button className="btn small danger" onClick={() => del(s)}>মুছুন</button></td></tr>)}
              {!subs.length && <tr><td colSpan={5} className="muted">এই শ্রেণির জন্য এখনো বিষয় দেওয়া হয়নি</td></tr>}
            </tbody>
          </table></div>
        </>
      )}
    </>
  )
}

function useClassStudents(cls) {
  const [list, setList] = useState([])
  const en = useEnrolled()
  useEffect(() => {
    if (!cls) return setList([])
    if (en.active && !en.ids) return setList([])
    fetchAll((a, b) => {
      let q = supabase.from('students').select('*').eq('status', 'active').order('student_no').order('id').range(a, b)
      if (!en.active) q = q.eq('class_id', cls)
      return q
    }).then(({ data }) => setList(inYearStudents(data || [], en).filter((s) => s.class_id === cls)))
  }, [cls, en.active, en.ids, en.classOf]) // eslint-disable-line
  return list
}

/* ---------- নম্বর এন্ট্রি ---------- */
function Entry({ exams, classes }) {
  const [exam, setExam] = useState('')
  const [cls, setCls] = useState('')
  const [subj, setSubj] = useState('')
  const [subs] = useSubjects(exam, cls)
  const students = useClassStudents(cls)
  const [vals, setVals] = useState({})
  const [msg, setMsg] = useState('')
  const sub = subs.find((s) => s.id === subj)
  useEffect(() => { setSubj('') }, [exam, cls])
  useEffect(() => {
    if (!subj) return setVals({})
    supabase.from('exam_marks').select('*').eq('subject_id', subj).then(({ data }) => {
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
    setMsg(error ? error.message : `${bn(rows.length)} জনের নম্বর সংরক্ষিত হয়েছে`)
  }
  return (
    <>
      <Pickers exams={exams} classes={classes} exam={exam} setExam={setExam} cls={cls} setCls={setCls}>
        <div style={{ minWidth: 200 }}><Select placeholder="বিষয় বাছুন" value={subj} onChange={setSubj} options={subs.map((s) => [s.id, nm(s)])} /></div>
      </Pickers>
      {exam && cls && !subs.length && <div className="alert info">আগে “বিষয়” ট্যাবে এই শ্রেণির বিষয় যোগ করুন।</div>}
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
              {!students.length && <tr><td colSpan={4} className="muted">এই শ্রেণিতে সক্রিয় ছাত্র নেই</td></tr>}
            </tbody>
          </table></div>
          {msg && <div className="alert info" style={{ marginTop: 10 }}>{msg}</div>}
          <button className="btn" style={{ marginTop: 12 }} onClick={save}>নম্বর সংরক্ষণ</button>
        </>
      )}
    </>
  )
}

/* ---------- ফলাফল ---------- */
function compute(subs, students, marks) {
  const byKey = {}
  marks.forEach((m) => { byKey[`${m.student_id}|${m.subject_id}`] = m })
  const fullTotal = subs.reduce((a, s) => a + num(s.full_marks), 0)
  const rows = students.map((st) => {
    let total = 0
    let fail = false
    let gp = 0
    let entered = 0
    const cells = subs.map((s) => {
      const m = byKey[`${st.id}|${s.id}`]
      if (!m) return { s, none: true }
      entered += 1
      if (m.absent) { fail = true; return { s, absent: true, g: 'F' } }
      const v = num(m.marks)
      total += v
      const g = gradeOf((v / num(s.full_marks)) * 100)
      const failed = v < num(s.pass_marks)
      if (failed) fail = true
      gp += failed ? 0 : g[2]
      return { s, v, g: failed ? 'F' : g[1], failed }
    })
    const gpa = fail ? 0 : subs.length ? gp / subs.length : 0
    const g = fail ? 'F' : gpa >= 5 ? 'A+' : gpa >= 4 ? 'A' : gpa >= 3.5 ? 'A-' : gpa >= 3 ? 'B' : gpa >= 2 ? 'C' : gpa >= 1 ? 'D' : 'F'
    return { st, cells, total, fail, gpa, grade: g, complete: entered === subs.length, pct: fullTotal ? (total / fullTotal) * 100 : 0 }
  })
  const ranked = rows.filter((r) => r.complete).sort((a, b) => (a.fail - b.fail) || (b.total - a.total))
  let pos = 0
  ranked.forEach((r, i) => { if (!r.fail) { pos = i > 0 && !ranked[i - 1].fail && ranked[i - 1].total === r.total ? pos : i + 1; r.pos = pos } })
  return { rows, fullTotal }
}

function Results({ exams, classes }) {
  const { settings, t } = useSite()
  const { profile, session } = useAuth()
  const [exam, setExam] = useState('')
  const [cls, setCls] = useState('')
  const [subs] = useSubjects(exam, cls)
  const students = useClassStudents(cls)
  const [marks, setMarks] = useState([])
  const ref = useRef(null)
  const [mode, setMode] = useState('merit')
  useEffect(() => {
    if (!exam) return setMarks([])
    fetchAll((a, b) => supabase.from('exam_marks').select('*').eq('exam_id', exam).order('id').range(a, b)).then(({ data }) => setMarks(data || []))
  }, [exam, cls])
  const { rows, fullTotal } = useMemo(() => compute(subs, students, marks), [subs, students, marks])
  const ex = exams.find((e) => e.id === exam)
  const cl = classes.find((c) => c.id === cls)
  const sorted = [...rows].sort((a, b) => (a.pos ?? 9999) - (b.pos ?? 9999) || (b.complete - a.complete) || String(a.st.student_no).localeCompare(String(b.st.student_no)))
  const passN = rows.filter((r) => r.complete && !r.fail).length
  const by = (profile && (profile.full_name || profile.email)) || session?.user?.email || ''
  const head = (
    <div className="ms-head">
      <img src={settings.logo_url} alt="" />
      <div><h3>{t('site.name') || 'সাবিলুস সালাম মাদরাসা'}</h3><div>{nm(ex)}{ex?.year ? ` — ${ex.year}` : ''} · {nm(cl)}</div></div>
    </div>
  )
  return (
    <>
      <Pickers exams={exams} classes={classes} exam={exam} setExam={setExam} cls={cls} setCls={setCls} />
      {exam && cls && subs.length > 0 && (
        <>
          <div className="row-actions" style={{ marginBottom: 12 }}>
            <button className={`btn ${mode === 'merit' ? '' : 'outline'}`} onClick={() => setMode('merit')}>মেধাতালিকা</button>
            <button className={`btn ${mode === 'sheet' ? '' : 'outline'}`} onClick={() => setMode('sheet')}>মার্কশিট (প্রতি ছাত্র)</button>
            <button className="btn outline" onClick={() => printNode(ref.current, 'A4')}>প্রিন্ট (A4)</button>
            <button className="btn outline" onClick={() => downloadCsv(`ফলাফল-${nm(cl)}.csv`, ['অবস্থান', 'আইডি', 'নাম', ...subs.map(nm), 'মোট', 'GPA', 'গ্রেড'], sorted.map((r) => [r.pos || '', r.st.student_no, nm(r.st), ...r.cells.map((c) => (c.none ? '' : c.absent ? 'অনুপস্থিত' : c.v)), r.total, r.gpa.toFixed(2), r.grade || '']))}>CSV</button>
          </div>
          <p className="muted">পূর্ণমান {bn(fullTotal)} · মোট {bn(rows.length)} জন · পাশ {bn(passN)} · ফেল/অসম্পূর্ণ {bn(rows.length - passN)}। কোনো একটি বিষয়ে পাশ নম্বরের নিচে বা অনুপস্থিত থাকলে ফেল (F)। সব বিষয়ের নম্বর না থাকলে অবস্থান দেওয়া হয় না।</p>
          <div ref={ref} className="ms-doc">
            {mode === 'merit' ? (
              <>
                {head}
                <h4 style={{ textAlign: 'center' }}>মেধাতালিকা</h4>
                <table>
                  <thead><tr><th>অবস্থান</th><th>আইডি</th><th>নাম</th>{subs.map((s) => <th key={s.id}>{nm(s)}</th>)}<th>মোট</th><th>GPA</th><th>গ্রেড</th></tr></thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.st.id}>
                        <td>{r.pos ? bn(r.pos) : '—'}</td><td>{r.st.student_no}</td><td>{nm(r.st)}</td>
                        {r.cells.map((c) => <td key={c.s.id}>{c.none ? '—' : c.absent ? 'অনু.' : bn(c.v, 1)}</td>)}
                        <td>{bn(r.total, 1)}</td><td>{r.complete ? bn(r.gpa, 2) : '—'}</td><td>{r.complete ? r.grade : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="rc-by">Printed by: <b>{by}</b> · {printedAt()}</div>
              </>
            ) : (
              sorted.filter((r) => r.complete).map((r) => (
                <div key={r.st.id} className="ms-page">
                  {head}
                  <h4 style={{ textAlign: 'center' }}>মার্কশিট</h4>
                  <p><b>নাম:</b> {nm(r.st)} &nbsp; <b>আইডি:</b> {r.st.student_no} &nbsp; <b>পিতা:</b> {r.st.father_name || '—'}</p>
                  <table>
                    <thead><tr><th>বিষয়</th><th>পূর্ণমান</th><th>প্রাপ্ত নম্বর</th><th>গ্রেড</th></tr></thead>
                    <tbody>
                      {r.cells.map((c) => <tr key={c.s.id}><td>{nm(c.s)}</td><td>{bn(c.s.full_marks)}</td><td>{c.absent ? 'অনুপস্থিত' : bn(c.v, 1)}</td><td>{c.g}</td></tr>)}
                      <tr><td><b>মোট</b></td><td><b>{bn(fullTotal)}</b></td><td><b>{bn(r.total, 1)}</b></td><td><b>{r.grade}</b></td></tr>
                    </tbody>
                  </table>
                  <p><b>GPA:</b> {bn(r.gpa, 2)} &nbsp; <b>ফলাফল:</b> {r.fail ? 'অকৃতকার্য' : 'উত্তীর্ণ'} &nbsp; {r.pos ? <><b>অবস্থান:</b> {bn(r.pos)}</> : null}</p>
                  <div className="ms-sign"><span>শ্রেণি শিক্ষক</span><span>অধ্যক্ষ / মুহতামিম</span></div>
                  <div className="rc-by">Printed by: <b>{by}</b> · {printedAt()}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
      {exam && cls && !subs.length && <div className="alert info">এই শ্রেণির বিষয় নেই। আগে “বিষয়” ট্যাবে যোগ করুন।</div>}
    </>
  )
}

export default function Exams() {
  const [tab, setTab] = useState('exams')
  const [exams, reload] = useExams()
  const classes = useClassList()
  const TABS = [['exams', 'পরীক্ষা'], ['subjects', 'বিষয়'], ['entry', 'নম্বর এন্ট্রি'], ['results', 'ফলাফল']]
  return (
    <>
      <h2>পরীক্ষা ও ফলাফল</h2>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'exams' && <ExamList exams={exams} reload={reload} />}
      {tab === 'subjects' && <Subjects exams={exams} classes={classes} />}
      {tab === 'entry' && <Entry exams={exams} classes={classes} />}
      {tab === 'results' && <Results exams={exams} classes={classes} />}
    </>
  )
}
