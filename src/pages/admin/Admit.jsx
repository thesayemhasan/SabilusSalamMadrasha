import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { ADMIT_DEFAULTS, useConfig } from '../../lib/config'
import { ImageUpload, Select, Switch } from '../../components/Ui'
import { dateBn, nm, num, printNode, taka } from './fin'
import { useClassList } from './Exams'

const bn = (n) => Number(n).toLocaleString('bn-BD')

function AdmitCard({ s, cls, cfg, routine, logo, school }) {
  return (
    <div className="adm-cell">
      <div className="adm-card" style={cfg.bg_url ? { backgroundImage: `url(${cfg.bg_url})` } : undefined}>
        <div className="ac-head">
          {cfg.show_logo && logo && <img src={logo} alt="" />}
          <div>
            <b>{cfg.school_title || school}</b>
            <div className="ac-title">{cfg.doc_title}</div>
            <div className="ac-exam">{cfg.exam_name}{cfg.year ? ` — ${cfg.year}` : ''}</div>
          </div>
        </div>
        <div className="ac-mid">
          <div className="ac-info">
            <div>নাম: <b>{nm(s)}</b></div>
            <div>আইডি: <b>{s.student_no}</b> &nbsp; শ্রেণি: <b>{cls || '—'}</b></div>
            {s.father_name && <div>পিতা: {s.father_name}</div>}
          </div>
          {cfg.show_photo && <div className="ac-photo">{s.photo_url ? <img src={s.photo_url} alt="" /> : <span>ছবি</span>}</div>}
        </div>
        {cfg.show_routine && routine.length > 0 && (
          <div className="ac-routine">{routine.map((r) => <div key={r.id}><b>{nm(r)}</b>{r.exam_date ? ` — ${dateBn(r.exam_date)}` : ''}{r.exam_time ? ` ${r.exam_time}` : ''}</div>)}</div>
        )}
        <div className="ac-inst">{cfg.instructions.split('\n').filter(Boolean).map((l, i) => <div key={i}>• {l}</div>)}</div>
        <div className="ac-sign"><span>{cfg.sign_left}</span><span>{cfg.sign_right}</span></div>
      </div>
    </div>
  )
}

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
  const pages = useMemo(() => { const out = []; for (let i = 0; i < chosen.length; i += 4) out.push(chosen.slice(i, i + 4)); return out }, [chosen])
  const up = (k, v) => setCfg((c) => ({ ...c, [k]: v }))
  async function doSave() { const e = await save(cfg); setMsg(e ? `ত্রুটি: ${e.message}` : 'সংরক্ষিত হয়েছে') }
  if (!ready) return <p>লোড হচ্ছে…</p>
  const sample = { id: 'x', student_no: '260001', name_bn: 'নমুনা ছাত্র', father_name: 'নমুনা পিতা' }
  const doc = (
    <div className="adm-doc" ref={ref}>
      {pages.map((pg, i) => (
        <div className="adm-page" key={i}>{pg.map((s) => <AdmitCard key={s.id} s={s} cls={clsName} cfg={eff} routine={routine} logo={settings.logo_url} school={school} />)}</div>
      ))}
    </div>
  )
  return (
    <>
      <h2>প্রবেশপত্র</h2>
      <div className="tabs">
        <button className={tab === 'print' ? 'on' : ''} onClick={() => setTab('print')}>প্রিন্ট</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>লেখা ও ডিজাইন (একবার সেট করুন)</button>
      </div>
      {tab === 'design' && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
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
            <div className="field"><label>ব্ল্যাংক ডিজাইন / ব্যাকগ্রাউন্ড ছবি (সব কার্ডে বসবে)</label><ImageUpload folder="admit" value={cfg.bg_url} onChange={(v) => up('bg_url', v || '')} /></div>
            <label className="toggle-row"><Switch checked={cfg.show_logo} onChange={(v) => up('show_logo', v)} /><span>লোগো</span></label>
            <label className="toggle-row"><Switch checked={cfg.show_photo} onChange={(v) => up('show_photo', v)} /><span>ছাত্রের ছবি</span></label>
            <label className="toggle-row"><Switch checked={cfg.show_routine} onChange={(v) => up('show_routine', v)} /><span>পরীক্ষার রুটিন (বিষয়ে তারিখ দেওয়া থাকলে)</span></label>
            <h3>কারা প্রবেশপত্র পাবে</h3>
            <div className="field"><label>নিয়ম</label><Select value={cfg.rule} onChange={(v) => up('rule', v)} options={[['no_due', 'কোনো বকেয়া না থাকলে'], ['head', 'নির্দিষ্ট ফি (যেমন পরীক্ষা ফি) পরিশোধ থাকলে'], ['none', 'সবাই']]} /></div>
            {cfg.rule === 'head' && <div className="field"><label>কোন ফি</label><Select placeholder="ফি বাছুন" value={cfg.head_id} onChange={(v) => up('head_id', v)} options={heads.map((h) => [h.id, nm(h)])} /></div>}
            {cfg.rule !== 'none' && <div className="field"><label>সর্বোচ্চ কত টাকা বকেয়া থাকলেও চলবে</label><input type="number" min="0" value={cfg.max_due} onChange={(e) => up('max_due', num(e.target.value))} /></div>}
            <button className="btn" onClick={doSave}>সংরক্ষণ</button>
            {msg && <div className="alert info">{msg}</div>}
          </div>
          <div>
            <h3>প্রিভিউ</h3>
            <div className="adm-preview"><AdmitCard s={sample} cls="নমুনা শ্রেণি" cfg={eff} routine={routine.length ? routine : [{ id: 1, name_bn: 'কুরআন', exam_date: '2026-11-01', exam_time: '১০:০০' }, { id: 2, name_bn: 'আরবি', exam_date: '2026-11-02', exam_time: '১০:০০' }]} logo={settings.logo_url} school={school} /></div>
          </div>
        </div>
      )}
      {tab === 'print' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 220 }}><Select placeholder="পরীক্ষা (রুটিনের জন্য, ঐচ্ছিক)" value={exam} onChange={setExam} options={[['', '— ছাড়া —'], ...exams.map((e) => [e.id, `${nm(e)}${e.year ? ` (${e.year})` : ''}`])]} /></div>
            <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি বাছুন" value={cls} onChange={setCls} options={classes.map((c) => [c.id, nm(c)])} /></div>
            <button className="btn" disabled={!chosen.length} onClick={() => printNode(ref.current, 'A4', '8mm', 'landscape')}>প্রিন্ট ({bn(chosen.length)}টি, A4 ল্যান্ডস্কেপ, পাতায় ৪টি)</button>
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
          <div className="adm-scroll">{doc}</div>
        </>
      )}
    </>
  )
}
