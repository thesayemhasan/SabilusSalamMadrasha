import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { ADMIT_DEFAULTS, useConfig } from '../../lib/config'
import { Select } from '../../components/Ui'
import LayoutDesigner, { useLayout } from '../../components/LayoutDesigner'
import { CardSheets } from '../../lib/layout'
import { instData, studentData } from './IdCards'
import { dateBn, nm, num, printNode, taka } from './fin'
import { useClassList } from './Exams'

const bn = (n) => Number(n).toLocaleString('bn-BD')

export default function Admit() {
  const { settings, t } = useSite()
  const classes = useClassList()
  const { cfg, setCfg, save, ready } = useConfig('admit', ADMIT_DEFAULTS)
  const [tab, setTab] = useState('print')
  const [exams, setExams] = useState([])
  const [heads, setHeads] = useState([])
  const [exam, setExam] = useState('')
  const [cls, setCls] = useState('')
  const [students, setStudents] = useState([])
  const [dues, setDues] = useState([])
  const [routine, setRoutine] = useState([])
  const [pick, setPick] = useState({})
  const [msg, setMsg] = useState('')
  const ref = useRef(null)
  const lay = useLayout('admit')
  const [mode, setMode] = useState('')
  useEffect(() => {
    supabase.from('exams').select('*').order('created_at', { ascending: false }).then(({ data }) => setExams(data || []))
    supabase.from('fee_heads').select('*').then(({ data }) => setHeads(data || []))
    supabase.rpc('student_dues').then(({ data }) => setDues(data || []))
  }, [])
  useEffect(() => {
    if (!cls) { setStudents([]); return }
    supabase.from('students').select('*').eq('class_id', cls).eq('status', 'active').order('student_no').then(({ data }) => setStudents(data || []))
  }, [cls])
  useEffect(() => {
    if (!exam || !cls) { setRoutine([]); return }
    supabase.from('exam_subjects').select('*').eq('exam_id', exam).eq('class_id', cls).order('exam_date', { ascending: true }).then(({ data }) => setRoutine(data || []))
  }, [exam, cls])
  // নির্বাচিত পরীক্ষার নাম ডিজাইনে না বদলে থাকলে স্বয়ংক্রিয়ভাবে নেওয়া যায়
  const ex = exams.find((e) => e.id === exam)

  const dueOf = (id) => {
    const rows = dues.filter((d) => d.student_id === id && (cfg.rule !== 'head' || d.head_id === cfg.head_id))
    return rows.reduce((a, d) => a + num(d.due), 0)
  }
  const eligible = (s) => cfg.rule === 'none' || dueOf(s.id) <= num(cfg.max_due)
  useEffect(() => { setPick(Object.fromEntries(students.filter(eligible).map((s) => [s.id, true]))) }, [students, dues, cfg.rule, cfg.head_id, cfg.max_due]) // eslint-disable-line
  const chosen = students.filter((s) => pick[s.id])
  const clsName = nm(classes.find((c) => c.id === cls))
  const school = t('site.name') || 'সাবিলুস সালাম মাদরাসা'
  const eff = { ...cfg, exam_name: cfg.exam_name || nm(ex), year: cfg.year || ex?.year || '' }
  const up = (k, v) => setCfg((c) => ({ ...c, [k]: v }))
  async function doSave() { const e = await save(cfg); setMsg(e ? `ত্রুটি: ${e.message}` : 'সংরক্ষিত হয়েছে') }
  if (!ready) return <p>লোড হচ্ছে…</p>
  const inst = instData(settings, t)
  const routineText = routine.map((r) => `${nm(r)}${r.exam_date ? ` — ${dateBn(r.exam_date)}` : ''}${r.exam_time ? ` ${r.exam_time}` : ''}`).join('\n')
  const common = { ...inst, ...(cfg.school_title ? { inst_name: cfg.school_title } : {}), doc_title: eff.doc_title, exam_name: eff.exam_name, year: eff.year, instructions: cfg.instructions, sign_left: cfg.sign_left, sign_right: cfg.sign_right }
  const items = chosen.map((s) => ({ ...common, ...studentData(s, clsName), routine: routineText }))
  const sample = { ...common, ...studentData({ name_bn: 'নমুনা ছাত্র', student_no: '260001', father_name: 'নমুনা পিতা' }, 'নমুনা শ্রেণি'), routine: routineText || 'কুরআন — ১ নভেম্বর\nআরবি — ২ নভেম্বর' }
  const eff2 = mode || lay.cfg.print || 'front'
  return (
    <>
      <h2>প্রবেশপত্র</h2>
      <div className="tabs">
        <button className={tab === 'print' ? 'on' : ''} onClick={() => setTab('print')}>প্রিন্ট</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>লেখা ও নিয়ম (একবার সেট করুন)</button>
        <button className={tab === 'layout' ? 'on' : ''} onClick={() => setTab('layout')}>ডিজাইন (নিজের নকশা বসান)</button>
      </div>
      {tab === 'design' && (
        <div>
          <div className="card form">
            <div className="field"><label>প্রতিষ্ঠানের নাম (ফাঁকা রাখলে সাইটের নাম)</label><input value={cfg.school_title} onChange={(e) => up('school_title', e.target.value)} /></div>
            <div className="grid g3">
              <div className="field"><label>কার্ডের শিরোনাম</label><input value={cfg.doc_title} onChange={(e) => up('doc_title', e.target.value)} /></div>
              <div className="field"><label>পরীক্ষার নাম (যেমন: প্রথম সাময়িক)</label><input value={cfg.exam_name} onChange={(e) => up('exam_name', e.target.value)} /></div>
              <div className="field"><label>সাল</label><input value={cfg.year} onChange={(e) => up('year', e.target.value)} /></div>
            </div>
            <div className="field"><label>নির্দেশনা (প্রতি লাইনে একটি; ৩–৪টি রাখলে কার্ডে ঠিকঠাক ধরে)</label><textarea rows={4} value={cfg.instructions} onChange={(e) => up('instructions', e.target.value)} /></div>
            <div className="grid g2">
              <div className="field"><label>বাঁ স্বাক্ষরের লেখা</label><input value={cfg.sign_left} onChange={(e) => up('sign_left', e.target.value)} /></div>
              <div className="field"><label>ডান স্বাক্ষরের লেখা</label><input value={cfg.sign_right} onChange={(e) => up('sign_right', e.target.value)} /></div>
            </div>
            <h3>কারা প্রবেশপত্র পাবে</h3>
            <div className="field"><label>নিয়ম</label><Select value={cfg.rule} onChange={(v) => up('rule', v)} options={[['no_due', 'কোনো বকেয়া না থাকলে'], ['head', 'নির্দিষ্ট ফি (যেমন পরীক্ষা ফি) পরিশোধ থাকলে'], ['none', 'সবাই']]} /></div>
            {cfg.rule === 'head' && <div className="field"><label>কোন ফি</label><Select placeholder="ফি বাছুন" value={cfg.head_id} onChange={(v) => up('head_id', v)} options={heads.map((h) => [h.id, nm(h)])} /></div>}
            {cfg.rule !== 'none' && <div className="field"><label>সর্বোচ্চ কত টাকা বকেয়া থাকলেও চলবে</label><input type="number" min="0" value={cfg.max_due} onChange={(e) => up('max_due', num(e.target.value))} /></div>}
            <button className="btn" onClick={doSave}>সংরক্ষণ</button>
            {msg && <div className="alert info">{msg}</div>}
          </div>
        </div>
      )}
      {tab === 'layout' && <LayoutDesigner type="admit" sample={sample} layoutHook={lay} />}
      {tab === 'print' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 220 }}><Select placeholder="পরীক্ষা (রুটিনের জন্য, ঐচ্ছিক)" value={exam} onChange={setExam} options={[['', '— ছাড়া —'], ...exams.map((e) => [e.id, `${nm(e)}${e.year ? ` (${e.year})` : ''}`])]} /></div>
            <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি বাছুন" value={cls} onChange={setCls} options={classes.map((c) => [c.id, nm(c)])} /></div>
            <div style={{ minWidth: 200 }}><Select value={eff2} onChange={setMode} options={[['front', 'শুধু সামনের পাশ'], ['back', 'শুধু পেছনের পাশ'], ['both', 'দুই পাশ']]} /></div>
            <button className="btn" disabled={!chosen.length} onClick={() => printNode(ref.current, 'A4', '0', 'landscape')}>প্রিন্ট ({bn(chosen.length)}টি, A4 ল্যান্ডস্কেপ)</button>
          </div>
          <p className="muted">নিয়ম: {cfg.rule === 'none' ? 'সবাই' : cfg.rule === 'head' ? 'নির্বাচিত ফি পরিশোধিত' : 'কোনো বকেয়া নেই'}। যোগ্যদের আগে থেকেই টিক দেওয়া থাকে; বকেয়াদারকে অনুমতি দিতে চাইলে নিজে টিক দিন।</p>
          <div className="table-wrap"><table>
            <thead><tr><th></th><th>আইডি</th><th>নাম</th><th>অবস্থা</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td><input type="checkbox" checked={!!pick[s.id]} onChange={(e) => setPick({ ...pick, [s.id]: e.target.checked })} /></td>
                  <td>{s.student_no}</td><td>{nm(s)}</td>
                  <td>{eligible(s) ? <span className="pill ok">যোগ্য</span> : <span className="pill">বকেয়া {taka(dueOf(s.id))}</span>}</td>
                </tr>
              ))}
              {!students.length && <tr><td colSpan={4} className="muted">শ্রেণি বাছুন</td></tr>}
            </tbody>
          </table></div>
          <h3 style={{ marginTop: 18 }}>প্রিভিউ</h3>
          <div className="adm-scroll" ref={ref}>{chosen.length ? <CardSheets layout={lay.cfg} items={items} mode={eff2} page={{ w: 297, h: 210 }} margin={6} pad={1} /> : <p className="muted">ছাত্র বাছুন</p>}</div>
        </>
      )}
    </>
  )
}
