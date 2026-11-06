import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { useConfig } from '../../lib/config'
import { useYear } from '../../lib/year'
import { Select, useConfirm } from '../../components/Ui'
import LayoutDesigner, { useLayout } from '../../components/LayoutDesigner'
import { PageSheets } from '../../lib/layout'
import { instData, studentData } from './IdCards'
import { dateBn, nm, printNode } from './fin'
import { useClassList } from './Exams'

const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const today = () => new Date().toLocaleDateString('en-CA')

const KINDS = {
  tc: { type: 'cert_tc', label: 'ছাড়পত্র (টিসি)', pre: 'টিসি', status: 'left', statusLabel: 'ছেড়ে গেছে' },
  testimonial: { type: 'cert_testimonial', label: 'প্রশংসাপত্র', pre: 'প্র', status: null },
  farigh: { type: 'cert_farigh', label: 'ফারেগীন সনদ', pre: 'ফা', status: 'graduated', statusLabel: 'পাশ / ফারেগ' },
}

// লেখার ডিফল্ট; {নাম} ধরনের চিহ্ন ছাপার সময় শিক্ষার্থীর তথ্য দিয়ে বদলে যায়
const DEFAULTS = {
  tc: {
    title: 'ছাড়পত্র (Transfer Certificate)',
    body: 'এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {name}, পিতা: {father}, মাতা: {mother}, আইডি নং {id}, জন্ম তারিখ {dob}, আমাদের মাদরাসায় {admission} তারিখে ভর্তি হয়ে {class} শ্রেণিতে অধ্যয়ন করেছে। তার আচরণ {conduct}। ছাড়ার কারণ: {reason}। সে অত্র মাদরাসা থেকে ছাড়পত্র গ্রহণ করেছে। মাদরাসার প্রতি তার কোনো পাওনা বাকি নেই। আমরা তার উজ্জ্বল ভবিষ্যৎ কামনা করি।',
    remarks: '', sign_left: 'শ্রেণি শিক্ষক', sign_right: 'অধ্যক্ষ / মুহতামিম',
  },
  testimonial: {
    title: 'প্রশংসাপত্র',
    body: 'এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {name}, পিতা: {father}, মাতা: {mother}, আইডি নং {id}, আমাদের মাদরাসার {class} শ্রেণির একজন নিয়মিত শিক্ষার্থী। আমার জানামতে তার চরিত্র ও আচরণ {conduct}। আমি তার সর্বাঙ্গীণ কল্যাণ ও সফলতা কামনা করি।',
    remarks: '', sign_left: 'শ্রেণি শিক্ষক', sign_right: 'অধ্যক্ষ / মুহতামিম',
  },
  farigh: {
    title: 'ফারেগীন সনদ',
    body: 'এই মর্মে সনদ প্রদান করা যাচ্ছে যে, {name}, পিতা: {father}, মাতা: {mother}, আইডি নং {id}, আমাদের মাদরাসায় {year} শিক্ষাবর্ষে {class} শ্রেণির নির্ধারিত পাঠ্যসূচি সফলভাবে সম্পন্ন করেছে এবং {result} ফলাফল অর্জন করেছে। আল্লাহ তাআলা তাকে ইলমে দ্বীনের খেদমতে কবুল করুন। আমীন।',
    remarks: '', sign_left: 'পরীক্ষা নিয়ন্ত্রক', sign_right: 'অধ্যক্ষ / মুহতামিম',
  },
}

const fill = (tpl, v) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined || v[k] === '' ? '………' : v[k]))
const pad = (n, w = 4) => String(n).padStart(w, '0')
const serialText = (kind, n) => `${KINDS[kind].pre}-${Number(pad(n)).toLocaleString('bn-BD', { useGrouping: false, minimumIntegerDigits: 4 })}`

export default function Certificates() {
  const { settings, t } = useSite()
  const classes = useClassList()
  const confirm = useConfirm()
  const ay = useYear().year
  const { cfg, setCfg, save, ready } = useConfig('certs', DEFAULTS)
  const lays = { tc: useLayout('cert_tc'), testimonial: useLayout('cert_testimonial'), farigh: useLayout('cert_farigh') }
  const [kind, setKind] = useState('tc')
  const [tab, setTab] = useState('print')
  const [students, setStudents] = useState([])
  const [q, setQ] = useState('')
  const [sid, setSid] = useState('')
  const [issued, setIssued] = useState([])
  const [form, setForm] = useState({ issue_date: today(), conduct: 'ভালো', reason: 'অভিভাবকের অনুরোধে', result_text: '', pass_year: '', last_class: '' })
  const [changeStatus, setChangeStatus] = useState(false)
  const [reprint, setReprint] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  const loadIssued = () => fetchAll((a, b) => supabase.from('certificates').select('*').order('created_at', { ascending: false }).order('id').range(a, b)).then(({ data }) => setIssued(data || []))
  useEffect(() => {
    fetchAll((a, b) => supabase.from('students').select('*').order('student_no').order('id').range(a, b)).then(({ data }) => setStudents(data || []))
    loadIssued()
  }, [])
  useEffect(() => { setForm((f) => ({ ...f, pass_year: f.pass_year || (ay ? ay.name_bn || '' : '') })) }, [ay?.id]) // eslint-disable-line

  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const st = students.find((s) => s.id === sid)
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const list = k ? students.filter((s) => `${s.student_no || ''} ${s.name_bn || ''} ${s.name_en || ''}`.toLowerCase().includes(k)) : students
    return list.slice(0, 200).map((s) => [s.id, `${s.student_no || ''} — ${nm(s)}${s.status !== 'active' ? ' (সক্রিয় নয়)' : ''}`])
  }, [students, q])

  const nextSerial = useMemo(() => issued.filter((r) => r.kind === kind).reduce((m, r) => Math.max(m, r.serial_no), 0) + 1, [issued, kind])
  const inst = instData(settings, t)
  const kc = cfg[kind] || DEFAULTS[kind]

  // ছাপার ডেটা: শিক্ষার্থীর তথ্য + এই ফর্মের তথ্য + লেখার টেমপ্লেট
  const build = (s, serial) => {
    const sd = studentData(s, cname[s.class_id])
    const vals = {
      name: s.name_bn || '', father: s.father_name || '', mother: s.mother_name || '', id: s.student_no || '', class: form.last_class || sd.class,
      dob: sd.dob, admission: sd.admission_date, conduct: form.conduct, reason: form.reason, result: form.result_text, year: form.pass_year,
    }
    return {
      ...inst, ...sd,
      cert_title: kc.title, cert_no: serialText(kind, serial), issue_date: form.issue_date ? dateBn(form.issue_date) : '',
      body: fill(kc.body, vals), remarks: kc.remarks, sign_left: kc.sign_left, sign_right: kc.sign_right,
      reason: form.reason, conduct: form.conduct, last_class: form.last_class || sd.class, result_text: form.result_text, pass_year: form.pass_year,
    }
  }
  const sampleStu = { name_bn: 'নমুনা শিক্ষার্থী', student_no: '260001', father_name: 'নমুনা পিতা', mother_name: 'নমুনা মাতা', admission_date: '2024-03-01', dob: '2015-05-10' }
  const sample = build(sampleStu, 1)
  const item = reprint ? reprint.data : st ? build(st, nextSerial) : null

  async function doPrint() {
    if (reprint) return printNode(ref.current, 'A4', '0', 'portrait')
    if (!st) return
    setBusy(true); setMsg('')
    const { error } = await supabase.from('certificates').insert({ kind, serial_no: nextSerial, student_id: st.id, student_name: st.name_bn, issued_on: form.issue_date || today(), data: item })
    if (error) { setBusy(false); return setMsg(`সনদ সংরক্ষণ হয়নি: ${error.message}`) }
    let note = ''
    if (changeStatus && KINDS[kind].status) {
      const r = await supabase.from('students').update({ status: KINDS[kind].status }).eq('id', st.id)
      note = r.error ? ` (শিক্ষার্থীর অবস্থা বদলায়নি: ${r.error.message})` : ` শিক্ষার্থীর অবস্থা "${KINDS[kind].statusLabel}" করা হয়েছে।`
      if (!r.error) setStudents((a) => a.map((x) => (x.id === st.id ? { ...x, status: KINDS[kind].status } : x)))
    }
    setBusy(false)
    setMsg(`সনদ নং ${item.cert_no} সংরক্ষিত হয়েছে।${note}`)
    printNode(ref.current, 'A4', '0', 'portrait')
    loadIssued()
  }
  async function del(r) {
    if (!(await confirm({ name: serialText(r.kind, r.serial_no), text: 'এই সনদের রেকর্ড মুছবেন? (শিক্ষার্থীর তথ্য মুছবে না)' }))) return
    const { error } = await supabase.from('certificates').delete().eq('id', r.id)
    if (error) return setMsg(error.message)
    loadIssued()
  }
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const upc = (k, v) => setCfg((c) => ({ ...c, [kind]: { ...(c[kind] || DEFAULTS[kind]), [k]: v } }))
  async function saveTexts() { const e = await save(cfg); setMsg(e ? `ত্রুটি: ${e.message}` : 'লেখা সংরক্ষিত হয়েছে') }
  if (!ready) return <p>লোড হচ্ছে…</p>
  const lay = lays[kind]

  return (
    <>
      <h2>টিসি ও সনদপত্র</h2>
      <div className="tabs">
        <button className={tab === 'print' ? 'on' : ''} onClick={() => setTab('print')}>প্রস্তুত ও প্রিন্ট</button>
        <button className={tab === 'texts' ? 'on' : ''} onClick={() => setTab('texts')}>লেখা (একবার সেট করুন)</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>ডিজাইন (নিজের নকশা বসান)</button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>প্রদত্ত সনদ ({bnum(issued.length)})</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|ত্রুটি/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      {tab !== 'history' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ minWidth: 220 }}><Select value={kind} onChange={(v) => { setKind(v); setReprint(null) }} options={Object.entries(KINDS).map(([k, v]) => [k, v.label])} /></div>
        </div>
      )}

      {tab === 'design' && <LayoutDesigner key={KINDS[kind].type} type={KINDS[kind].type} sample={sample} layoutHook={lay} />}

      {tab === 'texts' && (
        <div className="card form">
          <p className="muted" style={{ marginTop: 0 }}>এখানে লেখা বদলালে ছাপার সময় সব শিক্ষার্থীর সনদে সেটাই আসবে। মূল লেখায় এই চিহ্নগুলো বসালে শিক্ষার্থীর তথ্য নিজে থেকে বসে যাবে: <b>{'{name} {father} {mother} {id} {class} {dob} {admission} {conduct} {reason} {result} {year}'}</b></p>
          <div className="field"><label>শিরোনাম</label><input value={kc.title} onChange={(e) => upc('title', e.target.value)} /></div>
          <div className="field"><label>মূল লেখা</label><textarea rows={7} value={kc.body} onChange={(e) => upc('body', e.target.value)} /></div>
          <div className="field"><label>মন্তব্য (ঐচ্ছিক)</label><textarea rows={2} value={kc.remarks} onChange={(e) => upc('remarks', e.target.value)} /></div>
          <div className="grid g2">
            <div className="field"><label>বাঁ স্বাক্ষরের লেখা</label><input value={kc.sign_left} onChange={(e) => upc('sign_left', e.target.value)} /></div>
            <div className="field"><label>ডান স্বাক্ষরের লেখা</label><input value={kc.sign_right} onChange={(e) => upc('sign_right', e.target.value)} /></div>
          </div>
          <button className="btn" onClick={saveTexts}>সংরক্ষণ</button>
        </div>
      )}

      {tab === 'print' && (
        <>
          <div className="card form" style={{ marginBottom: 14 }}>
            <div className="grid g2">
              <div className="field"><label>শিক্ষার্থী খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
              <div className="field"><label>শিক্ষার্থী বাছুন</label><Select value={sid} onChange={(v) => { setSid(v); setReprint(null); const s = students.find((x) => x.id === v); if (s) up('last_class', cname[s.class_id] || '') }} options={options} placeholder="শিক্ষার্থী বাছুন" /></div>
            </div>
            <div className="grid g3">
              <div className="field"><label>প্রদানের তারিখ</label><input type="date" value={form.issue_date} onChange={(e) => up('issue_date', e.target.value)} /></div>
              <div className="field"><label>শ্রেণি (ফাঁকা রাখলে বর্তমান শ্রেণি)</label><input value={form.last_class} onChange={(e) => up('last_class', e.target.value)} /></div>
              <div className="field"><label>আচরণ</label><input value={form.conduct} onChange={(e) => up('conduct', e.target.value)} /></div>
            </div>
            {kind === 'tc' && <div className="field"><label>ছাড়ার কারণ</label><input value={form.reason} onChange={(e) => up('reason', e.target.value)} /></div>}
            {kind === 'farigh' && (
              <div className="grid g2">
                <div className="field"><label>ফলাফল (যেমন: মুমতাজ)</label><input value={form.result_text} onChange={(e) => up('result_text', e.target.value)} /></div>
                <div className="field"><label>শিক্ষাবর্ষ / সাল</label><input value={form.pass_year} onChange={(e) => up('pass_year', e.target.value)} /></div>
              </div>
            )}
            {KINDS[kind].status && !reprint && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={changeStatus} onChange={(e) => setChangeStatus(e.target.checked)} />
                প্রিন্টের সময় শিক্ষার্থীর অবস্থা "{KINDS[kind].statusLabel}" করে দিন
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <button className="btn" disabled={busy || !item} onClick={doPrint}>{reprint ? 'আবার প্রিন্ট' : `সংরক্ষণ ও প্রিন্ট (সনদ নং ${serialText(kind, nextSerial)})`}</button>
            {reprint && <button className="btn outline" onClick={() => setReprint(null)}>নতুন সনদে ফিরুন</button>}
            {reprint && <span className="muted">প্রদত্ত সনদ আবার ছাপা হচ্ছে: {reprint.data.cert_no}</span>}
          </div>
          <h3>প্রিভিউ</h3>
          <div className="adm-scroll" ref={ref}>
            {item ? <PageSheets layout={lay.cfg} items={[item]} mode="front" /> : <p className="muted">উপরে শিক্ষার্থী বাছলে সনদ এখানে দেখা যাবে।</p>}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>সনদ নং</th><th>ধরন</th><th>শিক্ষার্থী</th><th>তারিখ</th><th></th></tr></thead>
            <tbody>
              {issued.map((r) => (
                <tr key={r.id}>
                  <td>{serialText(r.kind, r.serial_no)}</td><td>{KINDS[r.kind]?.label}</td><td>{r.student_name}</td><td>{dateBn(r.issued_on)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn small outline" onClick={() => { setKind(r.kind); setReprint(r); setTab('print') }}>দেখুন / আবার প্রিন্ট</button>{' '}
                    <button className="btn small outline" onClick={() => del(r)}>মুছুন</button>
                  </td>
                </tr>
              ))}
              {!issued.length && <tr><td colSpan={5} className="muted">এখনো কোনো সনদ দেওয়া হয়নি।</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
