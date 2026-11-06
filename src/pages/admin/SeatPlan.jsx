import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { useYear, useEnrolled, inYearStudents, examInYear } from '../../lib/year'
import { Select, useConfirm } from '../../components/Ui'
import LayoutDesigner, { useLayout } from '../../components/LayoutDesigner'
import { CardSheets } from '../../lib/layout'
import Crud from './Crud'
import { instData, studentData } from './IdCards'
import { nm, printNode } from './fin'
import { useClassList } from './Exams'

const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const byNo = (a, b) => String(a.student_no || '').localeCompare(String(b.student_no || ''), undefined, { numeric: true })

// পরীক্ষার সিট প্ল্যান: কক্ষ, স্বয়ংক্রিয় সিট বরাদ্দ, সিট নং স্টিকার (A4 ল্যান্ডস্কেপে ৮টি) ও কক্ষভিত্তিক তালিকা
export default function SeatPlan() {
  const { settings, t } = useSite()
  const classes = useClassList()
  const confirm = useConfirm()
  const ay = useYear().year
  const en = useEnrolled()
  const lay = useLayout('seat_sticker')
  const [tab, setTab] = useState('plan')
  const [exams, setExams] = useState([])
  const [halls, setHalls] = useState([])
  const [students, setStudents] = useState([])
  const [seats, setSeats] = useState([])
  const [exam, setExam] = useState('')
  const [pickCls, setPickCls] = useState({})
  const [pickHall, setPickHall] = useState({})
  const [mode, setMode] = useState('mixed')
  const [numbering, setNumbering] = useState('continuous')
  const [start, setStart] = useState(1)
  const [fHall, setFHall] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    supabase.from('exams').select('*').order('created_at', { ascending: false }).then(({ data }) => setExams((data || []).filter((x) => examInYear(x, ay))))
  }, [ay?.id]) // eslint-disable-line
  const loadHalls = useCallback(() => supabase.from('exam_halls').select('*').order('sort', { ascending: true }).order('name').then(({ data }) => setHalls(data || [])), [])
  useEffect(() => { if (tab !== 'halls') loadHalls() }, [tab, loadHalls])
  useEffect(() => {
    fetchAll((a, b) => supabase.from('students').select('*').order('student_no').order('id').range(a, b)).then(({ data }) => setStudents(data || []))
  }, [])
  const loadSeats = useCallback(async () => {
    if (!exam) return setSeats([])
    const { data } = await fetchAll((a, b) => supabase.from('exam_seats').select('*').eq('exam_id', exam).order('seat_no').order('id').range(a, b))
    setSeats(data || [])
  }, [exam])
  useEffect(() => { loadSeats() }, [loadSeats])

  const ex = exams.find((e) => e.id === exam)
  const stuMap = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])
  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const chosenHalls = halls.filter((h) => pickHall[h.id])
  const capacity = chosenHalls.reduce((a, h) => a + Number(h.capacity || 0), 0)
  const pool = useMemo(() => {
    const act = students.filter((s) => s.status === 'active')
    return inYearStudents(act, en).filter((s) => pickCls[s.class_id])
  }, [students, en.active, en.ids, en.classOf, pickCls]) // eslint-disable-line

  // শিক্ষার্থীদের সাজানো: শ্রেণি ধরে ধরে, অথবা শ্রেণি মিশিয়ে (পাশাপাশি দুজন একই শ্রেণির না হওয়ার মতো)
  const ordered = useMemo(() => {
    const by = {}
    pool.forEach((s) => { (by[s.class_id] = by[s.class_id] || []).push(s) })
    const ids = classes.map((c) => c.id).filter((id) => by[id])
    ids.forEach((id) => by[id].sort(byNo))
    if (mode === 'class') return ids.flatMap((id) => by[id])
    const out = []
    const left = ids.map((id) => [...by[id]])
    while (left.some((l) => l.length)) left.forEach((l) => { if (l.length) out.push(l.shift()) })
    return out
  }, [pool, classes, mode])

  async function generate() {
    if (!exam || !chosenHalls.length || !ordered.length) return
    if (ordered.length > capacity) return setMsg(`কক্ষগুলোর মোট ধারণক্ষমতা ${bnum(capacity)} জন, কিন্তু শিক্ষার্থী ${bnum(ordered.length)} জন। আরও কক্ষ বাছুন বা কক্ষের ধারণক্ষমতা বাড়ান।`)
    if (seats.length && !(await confirm({ danger: false, name: nm(ex), text: `এই পরীক্ষার আগের সিট প্ল্যান (${bnum(seats.length)} জন) মুছে নতুন করে তৈরি হবে। নিশ্চিত?`, ok: 'হ্যাঁ, নতুন করে করুন' }))) return
    setBusy(true); setMsg('')
    const recs = []
    let hi = 0, used = 0, seatNo = Math.max(1, Number(start) || 1)
    ordered.forEach((s) => {
      while (hi < chosenHalls.length && used >= Number(chosenHalls[hi].capacity)) {
        hi += 1; used = 0
        if (numbering === 'perhall') seatNo = 1
      }
      const h = chosenHalls[hi]
      recs.push({ exam_id: exam, student_id: s.id, hall_id: h.id, hall_name: h.name, seat_no: seatNo })
      seatNo += 1; used += 1
    })
    const del = await supabase.from('exam_seats').delete().eq('exam_id', exam)
    if (del.error) { setBusy(false); return setMsg(`ত্রুটি: ${del.error.message}`) }
    for (let i = 0; i < recs.length; i += 300) {
      const { error } = await supabase.from('exam_seats').insert(recs.slice(i, i + 300))
      if (error) { setBusy(false); return setMsg(`ত্রুটি: ${error.message}`) }
    }
    setBusy(false)
    setMsg(`সিট প্ল্যান তৈরি হয়েছে: ${bnum(recs.length)} জন শিক্ষার্থী।`)
    loadSeats()
  }
  async function clearPlan() {
    if (!(await confirm({ name: nm(ex), text: 'এই পরীক্ষার পুরো সিট প্ল্যান মুছবেন?' }))) return
    const { error } = await supabase.from('exam_seats').delete().eq('exam_id', exam)
    if (error) return setMsg(error.message)
    loadSeats()
  }

  const inst = instData(settings, t)
  const rows = useMemo(() => seats.filter((r) => stuMap[r.student_id]).map((r) => ({ ...r, st: stuMap[r.student_id] })).sort((a, b) => a.seat_no - b.seat_no), [seats, stuMap])
  const hallNames = useMemo(() => {
    const present = new Set(rows.map((r) => r.hall_name || ''))
    const ord = halls.map((h) => h.name).filter((n) => present.has(n))
    return [...ord, ...[...present].filter((n) => !ord.includes(n))]
  }, [rows, halls])
  const shown = rows.filter((r) => !fHall || (r.hall_name || '') === fHall)
  const items = shown.map((r) => ({ ...inst, ...studentData(r.st, cname[r.st.class_id]), exam_name: nm(ex), year: ex?.year || '', hall: r.hall_name || '', seat_no: String(r.seat_no) }))
  const sample = { ...inst, ...studentData({ name_bn: 'নমুনা শিক্ষার্থী', student_no: '260001' }, 'নমুনা শ্রেণি'), exam_name: ex ? nm(ex) : 'বার্ষিক পরীক্ষা', year: ex?.year || '২০২৬', hall: 'কক্ষ ১', seat_no: '25' }
  const examSel = <div style={{ minWidth: 260 }}><Select value={exam} onChange={setExam} options={exams.map((e) => [e.id, nm(e)])} placeholder="পরীক্ষা বাছুন" /></div>

  return (
    <>
      <h2>পরীক্ষার সিট প্ল্যান</h2>
      <div className="tabs">
        <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>সিট প্ল্যান তৈরি</button>
        <button className={tab === 'sticker' ? 'on' : ''} onClick={() => setTab('sticker')}>সিট স্টিকার প্রিন্ট</button>
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>কক্ষভিত্তিক তালিকা</button>
        <button className={tab === 'halls' ? 'on' : ''} onClick={() => setTab('halls')}>কক্ষ</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>স্টিকারের ডিজাইন</button>
      </div>
      {msg && <div className={`alert ${/ত্রুটি|ধারণক্ষমতা/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'halls' && (
        <Crud
          table="exam_halls"
          title="পরীক্ষার কক্ষ"
          hint="যে কক্ষগুলোতে পরীক্ষা হবে সেগুলো ধারণক্ষমতাসহ যোগ করুন। পরীক্ষা বদলালেও কক্ষের তালিকা একই থাকবে।"
          order="sort"
          asc
          toggle={null}
          nameOf={(r) => r.name}
          blank={{ capacity: 30, sort: 0 }}
          fields={[
            { name: 'name', label: 'কক্ষের নাম / নম্বর', required: true },
            { name: 'capacity', label: 'ধারণক্ষমতা (কতজন বসতে পারবে)', type: 'number', required: true },
            { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
            { name: 'note', label: 'নোট', type: 'textarea' },
          ]}
          summary={(r) => (<><b>{r.name}</b><div className="muted" style={{ fontSize: '.85rem' }}>ধারণক্ষমতা {bnum(r.capacity)} জন</div></>)}
        />
      )}

      {tab === 'design' && <LayoutDesigner key="seat_sticker" type="seat_sticker" sample={sample} layoutHook={lay} />}

      {tab === 'plan' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>{examSel}</div>
          {!exam ? <p className="muted">আগে পরীক্ষা বাছুন।</p> : halls.length === 0 ? <div className="card">আগে <b>কক্ষ</b> ট্যাব থেকে পরীক্ষার কক্ষ যোগ করুন।</div> : (
            <>
              <div className="card form" style={{ marginBottom: 14 }}>
                <h3 style={{ marginTop: 0 }}>কোন শ্রেণি</h3>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                  {classes.map((c) => <label key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!pickCls[c.id]} onChange={(e) => setPickCls({ ...pickCls, [c.id]: e.target.checked })} />{nm(c)}</label>)}
                  <button className="btn small outline" onClick={() => setPickCls(Object.fromEntries(classes.map((c) => [c.id, true])))}>সব শ্রেণি</button>
                </div>
                <h3>কোন কক্ষ</h3>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                  {halls.map((h) => <label key={h.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!pickHall[h.id]} onChange={(e) => setPickHall({ ...pickHall, [h.id]: e.target.checked })} />{h.name} ({bnum(h.capacity)})</label>)}
                  <button className="btn small outline" onClick={() => setPickHall(Object.fromEntries(halls.map((h) => [h.id, true])))}>সব কক্ষ</button>
                </div>
                <div className="grid g3">
                  <div className="field"><label>বসানোর ধরন</label><Select value={mode} onChange={setMode} options={[['mixed', 'শ্রেণি মিশিয়ে (পাশাপাশি আলাদা শ্রেণি)'], ['class', 'শ্রেণি ধরে ধরে']]} /></div>
                  <div className="field"><label>সিট নম্বর</label><Select value={numbering} onChange={setNumbering} options={[['continuous', 'ধারাবাহিক (সব কক্ষ মিলিয়ে)'], ['perhall', 'প্রতি কক্ষে ১ থেকে']]} /></div>
                  <div className="field"><label>শুরুর সিট নম্বর</label><input type="number" min="1" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                </div>
                <p className="muted">বাছাই করা শিক্ষার্থী: <b>{bnum(ordered.length)}</b> জন · কক্ষের মোট ধারণক্ষমতা: <b>{bnum(capacity)}</b> জন</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn" disabled={busy || !ordered.length || !chosenHalls.length} onClick={generate}>{seats.length ? 'নতুন করে সিট প্ল্যান তৈরি' : 'সিট প্ল্যান তৈরি ও সংরক্ষণ'}</button>
                  {seats.length > 0 && <button className="btn outline" onClick={clearPlan}>প্ল্যান মুছুন</button>}
                </div>
              </div>
              {seats.length > 0 && (
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>বর্তমান প্ল্যান: {bnum(rows.length)} জন</h3>
                  <p className="muted" style={{ margin: 0 }}>{hallNames.map((h) => `${h || '—'}: ${bnum(rows.filter((r) => (r.hall_name || '') === h).length)} জন`).join(' · ')}</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'sticker' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {examSel}
            <div style={{ minWidth: 200 }}><Select value={fHall} onChange={setFHall} options={[['', 'সব কক্ষ'], ...hallNames.map((h) => [h, h || '—'])]} /></div>
            <button className="btn" disabled={!items.length} onClick={() => printNode(ref.current, 'A4', '0', 'landscape')}>প্রিন্ট ({bnum(items.length)}টি স্টিকার, A4 ল্যান্ডস্কেপ)</button>
          </div>
          <p className="muted">এক পাতায় ৮টি করে স্টিকার ছাপা হয় (২ সারি × ৪ লাইন)। মাপ বা সাজানো বদলাতে "স্টিকারের ডিজাইন" ট্যাব দেখুন।</p>
          <div className="adm-scroll" ref={ref}>{items.length ? <CardSheets layout={lay.cfg} items={items} mode="front" page={{ w: 297, h: 210 }} margin={6} pad={1} /> : <p className="muted">{exam ? 'এই পরীক্ষার সিট প্ল্যান এখনো তৈরি হয়নি।' : 'পরীক্ষা বাছুন।'}</p>}</div>
        </>
      )}

      {tab === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {examSel}
            <button className="btn" disabled={!rows.length} onClick={() => printNode(ref.current, 'A4', '12mm', 'portrait')}>প্রিন্ট (A4)</button>
          </div>
          <div className="adm-scroll"><div ref={ref} style={{ background: '#fff', color: '#000', padding: 16, minWidth: 560 }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 2px' }}>{t('site.name') || 'মাদরাসা'}</h2>
            <h3 style={{ textAlign: 'center', margin: '0 0 12px' }}>{ex ? nm(ex) : ''} — সিট প্ল্যান</h3>
            {hallNames.map((h) => (
              <div key={h} style={{ marginBottom: 16, breakInside: 'avoid' }}>
                <h3 style={{ margin: '8px 0 4px' }}>কক্ষ: {h || '—'} ({bnum(rows.filter((r) => (r.hall_name || '') === h).length)} জন)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['সিট নং', 'আইডি', 'নাম', 'শ্রেণি'].map((x) => <th key={x} style={{ border: '1px solid #444', padding: '3px 6px', textAlign: 'start', background: '#eee' }}>{x}</th>)}</tr></thead>
                  <tbody>
                    {rows.filter((r) => (r.hall_name || '') === h).map((r) => (
                      <tr key={r.id}>{[bnum(r.seat_no), r.st.student_no, nm(r.st), cname[r.st.class_id] || ''].map((c, j) => <td key={j} style={{ border: '1px solid #444', padding: '3px 6px' }}>{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {!rows.length && <p>{exam ? 'এই পরীক্ষার সিট প্ল্যান এখনো তৈরি হয়নি।' : 'পরীক্ষা বাছুন।'}</p>}
          </div></div>
        </>
      )}
    </>
  )
}
