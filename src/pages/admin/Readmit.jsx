import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useYear, useEnrolled, inYearStudents, examInYear } from '../../lib/year'
import { useSite } from '../../lib/store'
import { FORM_DEFAULTS, useConfig } from '../../lib/config'
import LayoutDesigner, { useLayout } from '../../components/LayoutDesigner'
import { PageSheets } from '../../lib/layout'
import { instData, studentData } from './IdCards'
import { Modal, Select, Switch, useConfirm } from '../../components/Ui'
import { dateBn, nm, num, printNode, taka, todayStr } from './fin'
import { useClassList } from './Exams'

const bn = (n) => Number(n).toLocaleString('bn-BD')
const DEC = { eligible: 'উপযুক্ত', conditional: 'শর্তসাপেক্ষ', ineligible: 'অনুপযুক্ত' }
const PILL = { eligible: 'pill ok', conditional: 'pill new', ineligible: 'pill' }
const SEV = [[1, 'সাধারণ'], [2, 'মাঝারি'], [3, 'গুরুতর']]

function Incidents({ s, onClose, onChange }) {
  const confirm = useConfirm()
  const [list, setList] = useState([])
  const [f, setF] = useState({ title: '', detail: '', severity: 1, incident_date: todayStr() })
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('student_incidents').select('*').eq('student_id', s.id).order('incident_date', { ascending: false })
    setList(data || [])
  }, [s.id])
  useEffect(() => { load() }, [load])
  async function add(e) {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.from('student_incidents').insert({ student_id: s.id, title: f.title, detail: f.detail || null, severity: Number(f.severity), incident_date: f.incident_date })
    if (error) return setErr(error.message)
    setF({ ...f, title: '', detail: '' })
    load(); onChange()
  }
  async function del(x) {
    if (!(await confirm({ name: x.title, text: 'এই ঘটনা মুছবেন?', ok: 'হ্যাঁ, মুছুন' }))) return
    await supabase.from('student_incidents').delete().eq('id', x.id)
    load(); onChange()
  }
  return (
    <Modal onClose={onClose} wide>
      <h3>{nm(s)} — ঘটনা / আচরণের রেকর্ড</h3>
      <form onSubmit={add} className="form">
        <div className="grid g3">
          <div className="field"><label>তারিখ</label><input type="date" value={f.incident_date} onChange={(e) => setF({ ...f, incident_date: e.target.value })} /></div>
          <div className="field"><label>ঘটনা</label><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="যেমন: অনুমতি ছাড়া অনুপস্থিত" /></div>
          <div className="field"><label>মাত্রা</label><Select value={f.severity} onChange={(v) => setF({ ...f, severity: v })} options={SEV} /></div>
        </div>
        <div className="field"><label>বিবরণ (ঐচ্ছিক)</label><input value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></div>
        {err && <div className="alert err">{err}</div>}
        <button className="btn">যোগ করুন</button>
      </form>
      <div className="table-wrap" style={{ marginTop: 12 }}><table>
        <tbody>
          {list.map((x) => <tr key={x.id}><td>{dateBn(x.incident_date)}</td><td><b>{x.title}</b>{x.detail && <div className="muted">{x.detail}</div>}</td><td>{SEV.find((v) => v[0] === x.severity)?.[1]}</td><td><button className="btn small danger" onClick={() => del(x)}>মুছুন</button></td></tr>)}
          {!list.length && <tr><td className="muted">কোনো রেকর্ড নেই</td></tr>}
        </tbody>
      </table></div>
      <div className="row-actions" style={{ marginTop: 10 }}><button className="btn outline" onClick={onClose}>বন্ধ</button></div>
    </Modal>
  )
}

export default function Readmit() {
  const { settings, t } = useSite()
  const classes = useClassList()
  const { cfg, setCfg, save, ready } = useConfig('admit_form', FORM_DEFAULTS)
  const [tab, setTab] = useState('list')
  const [cls, setCls] = useState('')
  const [exams, setExams] = useState([])
  const [exam, setExam] = useState('')
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [marks, setMarks] = useState([])
  const [dues, setDues] = useState([])
  const [att, setAtt] = useState([])
  const [inc, setInc] = useState([])
  const [dec, setDec] = useState([])
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(todayStr())
  const [pick, setPick] = useState({})
  const [incOf, setIncOf] = useState(null)
  const [blank, setBlank] = useState(0)
  const [msg, setMsg] = useState('')
  const ref = useRef(null)
  const lay = useLayout('form')
  const [pmode, setPmode] = useState('')
  const year = cfg.year
  const ay = useYear().year
  const en = useEnrolled()

  useEffect(() => { supabase.from('exams').select('*').order('created_at', { ascending: false }).then(({ data }) => { const d = (data || []).filter((x) => examInYear(x, ay)); setExams(d); setExam(d[0] ? d[0].id : '') }) }, [ay?.id]) // eslint-disable-line
  const loadStatic = useCallback(async () => {
    supabase.rpc('student_dues').then(({ data }) => setDues(data || []))
    const i = await fetchAll((a, b) => supabase.from('student_incidents').select('*').order('id').range(a, b)); setInc(i.data || [])
    const d = await supabase.from('readmissions').select('*').eq('year', year); setDec(d.data || [])
  }, [year])
  useEffect(() => { loadStatic() }, [loadStatic])
  useEffect(() => { if (ay) { const t = todayStr(); setFrom(ay.start_date); setTo(t > ay.end_date ? ay.end_date : t < ay.start_date ? ay.start_date : t) } }, [ay?.id]) // eslint-disable-line
  useEffect(() => { supabase.rpc('student_attendance_stats', { p_from: from, p_to: to }).then(({ data }) => setAtt(data || [])) }, [from, to])
  useEffect(() => {
    fetchAll((a, b) => {
      let q = supabase.from('students').select('*').eq('status', 'active').order('student_no').order('id').range(a, b)
      if (cls && !en.active) q = q.eq('class_id', cls)
      return q
    }).then(({ data }) => setStudents(inYearStudents(data || [], en).filter((s) => !cls || s.class_id === cls)))
  }, [cls, en.active, en.ids, en.classOf]) // eslint-disable-line
  useEffect(() => {
    if (!exam) { setSubjects([]); setMarks([]); return }
    supabase.from('exam_subjects').select('*').eq('exam_id', exam).then(({ data }) => setSubjects(data || []))
    fetchAll((a, b) => supabase.from('exam_marks').select('*').eq('exam_id', exam).order('id').range(a, b)).then(({ data }) => setMarks(data || []))
  }, [exam])

  const clsById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes])
  const nextClass = (id) => { const i = classes.findIndex((c) => c.id === id); return i >= 0 && classes[i + 1] ? nm(classes[i + 1]) : '' }
  const rules = cfg.rules

  const rows = useMemo(() => students.map((s) => {
    const subs = subjects.filter((x) => x.class_id === s.class_id)
    const mine = marks.filter((m) => m.student_id === s.id)
    let result = 'none'
    if (subs.length && mine.length) {
      const failed = subs.some((x) => { const m = mine.find((y) => y.subject_id === x.id); return !m || m.absent || num(m.marks) < num(x.pass_marks) })
      result = mine.length < subs.length ? 'none' : failed ? 'fail' : 'pass'
    }
    const due = dues.filter((d) => d.student_id === s.id).reduce((a, d) => a + num(d.due), 0)
    const a = att.find((x) => x.student_id === s.id)
    const pct = a && num(a.total) ? Math.round((num(a.present) / num(a.total)) * 100) : null
    const incs = inc.filter((x) => x.student_id === s.id)
    const reasons = []
    let auto = 'eligible'
    if (rules.need_pass) {
      if (result === 'fail') { auto = 'ineligible'; reasons.push('পরীক্ষায় অকৃতকার্য') }
      else if (result === 'none') { auto = 'conditional'; reasons.push('ফলাফল পাওয়া যায়নি') }
    }
    if (incs.length > num(rules.max_incidents)) { auto = 'ineligible'; reasons.push(`${bn(incs.length)}টি আচরণগত ঘটনা`) }
    if (due > num(rules.max_due)) { if (auto === 'eligible') auto = 'conditional'; reasons.push(`বকেয়া ${taka(due)}`) }
    if (pct !== null && pct < num(rules.min_attendance)) { if (auto === 'eligible') auto = 'conditional'; reasons.push(`উপস্থিতি ${bn(pct)}%`) }
    const o = dec.find((x) => x.student_id === s.id)
    return { s, result, due, pct, incs, reasons, auto, override: o, decision: o?.decision || auto }
  }), [students, subjects, marks, dues, att, inc, dec, rules])

  async function setDecision(r, decision) {
    if (!decision) { if (r.override) await supabase.from('readmissions').delete().eq('id', r.override.id) }
    else await supabase.from('readmissions').upsert({ student_id: r.s.id, year, decision, note: r.override?.note || null, updated_at: new Date().toISOString() }, { onConflict: 'student_id,year' })
    loadStatic()
  }
  const up = (k, v) => setCfg((c) => ({ ...c, [k]: v }))
  const upF = (k, v) => setCfg((c) => ({ ...c, fields: { ...c.fields, [k]: v } }))
  const upR = (k, v) => setCfg((c) => ({ ...c, rules: { ...c.rules, [k]: v } }))
  async function doSave() { const e = await save(cfg); setMsg(e ? `ত্রুটি: ${e.message}` : 'সংরক্ষিত হয়েছে'); loadStatic() }
  if (!ready) return <p>লোড হচ্ছে…</p>
  const inst = instData(settings, t)
  const chosen = rows.filter((r) => pick[r.s.id])
  const RES = { pass: 'উত্তীর্ণ', fail: 'অকৃতকার্য', none: '' }
  const policy = cfg.policy.split('\n').filter(Boolean).map((l, i) => `${(i + 1).toLocaleString('bn-BD')}. ${l}`).join('\n')
  const common = { ...inst, form_heading: `${cfg.title} — শিক্ষাবর্ষ ${cfg.year}`, form_year: cfg.year, policy_title: cfg.policy_title, policy, declaration: cfg.declaration, sign_guardian: cfg.sign_guardian, sign_authority: cfg.sign_authority }
  const dataOf = (r) => ({ ...common, ...studentData(r.s, nm(clsById[r.s.class_id])), prev_class: nm(clsById[r.s.class_id]), prev_result: RES[r.result], next_class: nextClass(r.s.class_id), decision: DEC[r.decision], reasons: [...r.reasons, r.override?.note].filter(Boolean).join('; ') })
  const items = [...chosen.map(dataOf), ...Array.from({ length: blank }, () => ({ ...common }))]
  const sample = { ...common, ...studentData({ name_bn: 'নমুনা ছাত্র', father_name: 'নমুনা পিতা', mother_name: 'নমুনা মাতা', guardian_phone: '01700000000', blood_group: 'A+', address: 'ঢাকা', gender: 'male', dob: '2015-01-01' }, 'নমুনা শ্রেণি'), prev_class: 'নমুনা শ্রেণি', prev_result: 'উত্তীর্ণ', next_class: 'পরবর্তী শ্রেণি', decision: 'উপযুক্ত', reasons: '' }
  const pm = pmode || lay.cfg.print || 'both'
  return (
    <>
      <h2>পুনঃভর্তি ও ভর্তি ফরম</h2>
      <div className="tabs">
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>যোগ্যতা তালিকা ও ফরম প্রিন্ট</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>লেখা ও যোগ্যতার শর্ত</button>
        <button className={tab === 'layout' ? 'on' : ''} onClick={() => setTab('layout')}>ফরমের ডিজাইন (নিজের নকশা বসান)</button>
      </div>

      {tab === 'design' && (
        <div className="card form">
          <div className="grid g2">
            <div className="field"><label>ভর্তির শিক্ষাবর্ষ</label><input value={cfg.year} onChange={(e) => up('year', e.target.value)} /></div>
            <div className="field"><label>ফরমের শিরোনাম</label><input value={cfg.title} onChange={(e) => up('title', e.target.value)} /></div>
          </div>
          <h3>নীতিমালা ও স্বাক্ষর</h3>
          <div className="field"><label>নীতিমালার শিরোনাম</label><input value={cfg.policy_title} onChange={(e) => up('policy_title', e.target.value)} /></div>
          <div className="field"><label>নীতিমালা (প্রতি লাইনে একটি)</label><textarea rows={5} value={cfg.policy} onChange={(e) => up('policy', e.target.value)} /></div>
          <div className="field"><label>অঙ্গীকার</label><textarea rows={2} value={cfg.declaration} onChange={(e) => up('declaration', e.target.value)} /></div>
          <div className="grid g2">
            <div className="field"><label>বাঁ স্বাক্ষর</label><input value={cfg.sign_guardian} onChange={(e) => up('sign_guardian', e.target.value)} /></div>
            <div className="field"><label>ডান স্বাক্ষর</label><input value={cfg.sign_authority} onChange={(e) => up('sign_authority', e.target.value)} /></div>
          </div>
          <h3>আগামী বছরের জন্য যোগ্যতার শর্ত</h3>
          <label className="toggle-row"><Switch checked={rules.need_pass} onChange={(v) => upR('need_pass', v)} /><span>পরীক্ষায় উত্তীর্ণ হতে হবে</span></label>
          <div className="grid g3">
            <div className="field"><label>সর্বোচ্চ বকেয়া (টাকা)</label><input type="number" min="0" value={rules.max_due} onChange={(e) => upR('max_due', num(e.target.value))} /></div>
            <div className="field"><label>ন্যূনতম উপস্থিতি (%)</label><input type="number" min="0" max="100" value={rules.min_attendance} onChange={(e) => upR('min_attendance', num(e.target.value))} /></div>
            <div className="field"><label>সর্বোচ্চ আচরণগত ঘটনা (এর বেশি হলে অনুপযুক্ত)</label><input type="number" min="0" value={rules.max_incidents} onChange={(e) => upR('max_incidents', num(e.target.value))} /></div>
          </div>
          <button className="btn" onClick={doSave}>সংরক্ষণ</button>
          {msg && <div className="alert info">{msg}</div>}
        </div>
      )}

      {tab === 'layout' && <LayoutDesigner type="form" sample={sample} layoutHook={lay} />}

      {tab === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি (সব)" value={cls} onChange={setCls} options={[['', 'সব শ্রেণি'], ...classes.map((c) => [c.id, nm(c)])]} /></div>
            <div style={{ minWidth: 220 }}><Select placeholder="ফলাফলের পরীক্ষা (পাশ-ফেল দেখতে)" value={exam} onChange={setExam} options={exams.map((e) => [e.id, `${nm(e)}${e.year ? ` (${e.year})` : ''}`])} /></div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} title="উপস্থিতি গণনার শুরু" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} title="উপস্থিতি গণনার শেষ" />
          </div>
          <div className="row-actions" style={{ marginBottom: 12 }}>
            <div style={{ minWidth: 200 }}><Select value={pm} onChange={setPmode} options={[['front', 'শুধু সামনের পাশ'], ['back', 'শুধু পেছনের পাশ'], ['both', 'দুই পাশ (সামনে-পেছনে পরপর)']]} /></div>
            <button className="btn outline" onClick={() => setPick(Object.fromEntries(rows.filter((r) => r.decision !== 'ineligible').map((r) => [r.s.id, true])))}>যোগ্য/শর্তসাপেক্ষ সবাইকে বাছুন</button>
            <button className="btn outline" onClick={() => setPick({})}>বাছাই বাদ</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>ফাঁকা (নতুন) ফরম <input type="number" min="0" max="200" value={blank} onChange={(e) => setBlank(Number(e.target.value) || 0)} style={{ width: 80 }} /></label>
            <button className="btn" disabled={!items.length} onClick={() => printNode(ref.current, 'A4', '0')}>ফরম প্রিন্ট ({bn(items.length)}টি, A4)</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th></th><th>ছাত্র</th><th>ফল</th><th>উপস্থিতি</th><th>বকেয়া</th><th>ঘটনা</th><th>অবস্থা</th><th>সিদ্ধান্ত বদলান</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.id}>
                  <td><input type="checkbox" checked={!!pick[r.s.id]} onChange={(e) => setPick({ ...pick, [r.s.id]: e.target.checked })} /></td>
                  <td><b>{nm(r.s)}</b><div className="muted">{r.s.student_no} · {nm(clsById[r.s.class_id])}</div></td>
                  <td>{RES[r.result] || '—'}</td>
                  <td>{r.pct === null ? '—' : `${bn(r.pct)}%`}</td>
                  <td>{r.due ? taka(r.due) : '—'}</td>
                  <td><button className="btn small outline" onClick={() => setIncOf(r.s)}>{bn(r.incs.length)}টি · দেখুন/যোগ</button></td>
                  <td><span className={PILL[r.decision]}>{DEC[r.decision]}</span>{r.override && <small className="muted"> (হাতে ঠিক করা)</small>}{r.reasons.length > 0 && <div className="muted" style={{ fontSize: '.8rem' }}>{r.reasons.join('; ')}</div>}</td>
                  <td style={{ minWidth: 150 }}><Select small placeholder="স্বয়ংক্রিয়" value={r.override?.decision || ''} onChange={(v) => setDecision(r, v)} options={[['', 'স্বয়ংক্রিয়'], ...Object.entries(DEC)]} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="muted">কোনো ছাত্র নেই</td></tr>}
            </tbody>
          </table></div>
          <p className="muted">শর্ত বদলাতে “ফরমের ডিজাইন ও শর্ত” ট্যাবে যান। ফরমে ছাত্রের আগের তথ্য নিজে থেকে বসে এবং পরবর্তী শ্রেণি শ্রেণির ক্রম অনুযায়ী দেওয়া হয়।</p>
          {items.length > 0 && <><h3>প্রিভিউ</h3><div className="adm-scroll" ref={ref}><PageSheets layout={lay.cfg} items={items} mode={pm} /></div></>}
        </>
      )}
      {incOf && <Incidents s={incOf} onClose={() => setIncOf(null)} onChange={loadStatic} />}
    </>
  )
}
