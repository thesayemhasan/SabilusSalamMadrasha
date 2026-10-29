import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm } from '../../components/Ui'
import { useYear } from '../../lib/year'
import { nm } from './fin'

const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const all = (make) => fetchAll(make).then((r) => r.data || [])

// নির্বাচিত (উপরের সিলেক্টরের) শিক্ষাবর্ষে ছাত্র ভর্তি করা: আগের বর্ষ থেকে বেছে নতুন শ্রেণিতে তোলা
export default function Enroll() {
  const { year, years, reload: reloadYears } = useYear()
  const confirm = useConfirm()
  const [classes, setClasses] = useState([])
  const [stu, setStu] = useState({})
  const [target, setTarget] = useState([])
  const [source, setSource] = useState([])
  const [srcId, setSrcId] = useState('')
  const [srcCls, setSrcCls] = useState('')
  const [pick, setPick] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const others = useMemo(() => years.filter((y) => year && y.id !== year.id), [years, year])
  useEffect(() => {
    if (!year) return
    const prev = others.filter((y) => y.end_date < year.start_date).sort((a, b) => (a.end_date < b.end_date ? 1 : -1))[0] || others[0]
    setSrcId(prev ? prev.id : '')
    setPick({})
  }, [year?.id]) // eslint-disable-line
  useEffect(() => {
    all((a, b) => supabase.from('classes').select('*').order('sort', { ascending: true }).order('id').range(a, b)).then(setClasses)
    all((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,status').order('id').range(a, b)).then((r) => setStu(Object.fromEntries(r.map((s) => [s.id, s]))))
  }, [])
  const loadTarget = useCallback(async () => {
    if (!year) return setTarget([])
    setTarget(await all((a, b) => supabase.from('enrollments').select('id,student_id,class_id').eq('year_id', year.id).order('id').range(a, b)))
  }, [year?.id]) // eslint-disable-line
  useEffect(() => { loadTarget() }, [loadTarget])
  useEffect(() => {
    if (!srcId) return setSource([])
    all((a, b) => supabase.from('enrollments').select('id,student_id,class_id').eq('year_id', srcId).order('id').range(a, b)).then(setSource)
  }, [srcId])

  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const classOpts = useMemo(() => [['', '— শ্রেণি নেই —'], ...classes.map((c) => [c.id, nm(c)])], [classes])
  const nextOf = (id) => { const c = classes.find((x) => x.id === id); if (!c) return id; const i = classes.indexOf(c); const n = classes.slice(i + 1).find((x) => (x.department_id || '') === (c.department_id || '')); return n ? n.id : id }
  const done = useMemo(() => new Set(target.map((e) => e.student_id)), [target])
  const rows = useMemo(() => source.filter((e) => stu[e.student_id] && stu[e.student_id].status === 'active' && !done.has(e.student_id) && (!srcCls || e.class_id === srcCls))
    .sort((a, b) => String(stu[a.student_id].student_no || '').localeCompare(String(stu[b.student_id].student_no || ''), undefined, { numeric: true })), [source, stu, done, srcCls])
  const chosen = rows.filter((e) => pick[e.student_id]?.on)

  const setRow = (sid, patch) => setPick((o) => ({ ...o, [sid]: { ...(o[sid] || {}), ...patch } }))
  const clsOf = (e) => (pick[e.student_id]?.cls !== undefined ? pick[e.student_id].cls : e.class_id || '')
  const selectAll = (on) => setPick((o) => { const n = { ...o }; rows.forEach((e) => { n[e.student_id] = { ...(n[e.student_id] || {}), on } }); return n })
  const setAllClass = (fn) => setPick((o) => { const n = { ...o }; rows.forEach((e) => { n[e.student_id] = { ...(n[e.student_id] || {}), cls: fn(e) } }); return n })

  async function enroll(list) {
    if (!year || list.length === 0) return
    setBusy(true); setMsg('')
    const recs = list.map(([sid, cls]) => ({ student_id: sid, year_id: year.id, class_id: cls || null }))
    for (let i = 0; i < recs.length; i += 200) {
      const { error } = await supabase.from('enrollments').upsert(recs.slice(i, i + 200), { onConflict: 'student_id,year_id' })
      if (error) { setBusy(false); return setMsg(`ভর্তি হয়নি: ${error.message}`) }
    }
    setBusy(false)
    setMsg(`${bnum(recs.length)} জন ছাত্র ${year.name_bn}-এ ভর্তি হয়েছে।`)
    setPick({})
    await loadTarget()
  }
  async function allActive() {
    if (!(await confirm({ name: year.name_bn, text: 'সব সক্রিয় ছাত্রকে এই বর্ষে তাদের বর্তমান শ্রেণিতে ভর্তি করবেন? (যারা আগে থেকেই ভর্তি আছে তাদের শ্রেণি বদলাবে না)' }))) return
    const st = await all((a, b) => supabase.from('students').select('id,class_id').eq('status', 'active').order('id').range(a, b))
    await enroll(st.filter((s) => !done.has(s.id)).map((s) => [s.id, s.class_id]))
  }
  async function remove(e) {
    if (!(await confirm({ name: nm(stu[e.student_id]), text: `${year.name_bn} থেকে বাদ দেবেন? (ছাত্রের তথ্য মুছবে না, শুধু এই বর্ষের তালিকা থেকে সরবে)` }))) return
    const { error } = await supabase.from('enrollments').delete().eq('id', e.id)
    if (error) return setMsg(error.message)
    loadTarget()
  }
  async function changeClass(e, cls) {
    const { error } = await supabase.from('enrollments').update({ class_id: cls || null }).eq('id', e.id)
    if (error) return setMsg(error.message)
    loadTarget()
  }

  if (!year) {
    return (
      <>
        <h2>শিক্ষাবর্ষে ভর্তি ও উত্তীর্ণ</h2>
        <div className="card">আগে <b>শিক্ষাবর্ষ</b> পাতায় একটি শিক্ষাবর্ষ তৈরি করুন।</div>
      </>
    )
  }
  const counts = {}
  target.forEach((e) => { const k = cname[e.class_id] || 'শ্রেণি নেই'; counts[k] = (counts[k] || 0) + 1 })
  const tRows = target.filter((e) => stu[e.student_id]).sort((a, b) => String(stu[a.student_id].student_no || '').localeCompare(String(stu[b.student_id].student_no || ''), undefined, { numeric: true }))
  return (
    <>
      <div className="toolbar"><h2 style={{ margin: 0, flex: '1 1 auto' }}>শিক্ষাবর্ষে ভর্তি ও উত্তীর্ণ</h2></div>
      <p className="muted" style={{ marginTop: -6 }}>উপরের সিলেক্টরে যে শিক্ষাবর্ষ বাছা আছে (<b>{year.name_bn}</b>) সেখানে ছাত্র ভর্তি হবে। আগের বর্ষ থেকে ছাত্র বেছে নতুন শ্রেণিতে তুলুন। যারা অনুত্তীর্ণ তাদের একই শ্রেণি রাখুন, আর যারা পাশ করে বেরিয়ে গেছে তাদের এখানে না বেছে ছাত্র পাতায় অবস্থা "পাশ / ফারেগ" করে দিন।</p>
      {msg && <div className={`alert ${msg.startsWith('ভর্তি হয়নি') ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>১. আগের বর্ষ থেকে ভর্তি</h3>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <div style={{ minWidth: 200 }}><Select value={srcId} onChange={(v) => { setSrcId(v); setPick({}) }} options={[['', '— কোন বর্ষ থেকে —'], ...others.map((y) => [y.id, y.name_bn || y.name_en])]} /></div>
          <div style={{ minWidth: 200 }}><Select value={srcCls} onChange={setSrcCls} options={[['', 'সব শ্রেণি'], ...classes.map((c) => [c.id, nm(c)])]} /></div>
          <span className="muted">{bnum(rows.length)} জন বাকি, {bnum(chosen.length)} জন বাছাই</span>
        </div>
        {!srcId ? <p className="muted">কোন বর্ষ থেকে ছাত্র আনবেন তা বাছুন।</p> : rows.length === 0 ? <p className="muted">এই বর্ষে ভর্তি করার মতো কেউ বাকি নেই (সবাই ভর্তি হয়ে গেছে বা তালিকা ফাঁকা)।</p> : (
          <>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <button className="btn small outline" onClick={() => selectAll(true)}>সব বাছুন</button>
              <button className="btn small outline" onClick={() => selectAll(false)}>বাছাই তুলুন</button>
              <button className="btn small outline" onClick={() => setAllClass((e) => e.class_id || '')}>সবাই একই শ্রেণিতে</button>
              <button className="btn small outline" onClick={() => setAllClass((e) => nextOf(e.class_id))}>সবাই পরের শ্রেণিতে</button>
              <button className="btn" disabled={busy || chosen.length === 0} onClick={() => enroll(chosen.map((e) => [e.student_id, clsOf(e)]))}>{bnum(chosen.length)} জনকে {year.name_bn}-এ ভর্তি করুন</button>
            </div>
            <div className="table-wrap" style={{ maxHeight: 460, overflow: 'auto' }}>
              <table>
                <thead><tr><th></th><th>আইডি</th><th>নাম</th><th>আগের শ্রেণি</th><th>নতুন শ্রেণি</th></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td><input type="checkbox" checked={Boolean(pick[e.student_id]?.on)} onChange={(ev) => setRow(e.student_id, { on: ev.target.checked })} /></td>
                      <td>{stu[e.student_id].student_no}</td><td>{nm(stu[e.student_id])}</td><td>{cname[e.class_id] || '—'}</td>
                      <td style={{ minWidth: 190 }}><Select value={clsOf(e)} onChange={(v) => setRow(e.student_id, { cls: v })} options={classOpts} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: '1 1 auto' }}>২. {year.name_bn}-এ ভর্তি আছে: {bnum(target.length)} জন</h3>
          <button className="btn small outline" disabled={busy} onClick={allActive}>সব সক্রিয় ছাত্রকে এই বর্ষে ভর্তি করুন</button>
        </div>
        {Object.keys(counts).length > 0 && <p className="muted" style={{ marginTop: 0 }}>{Object.entries(counts).map(([k, v]) => `${k}: ${bnum(v)}`).join(' · ')}</p>}
        {tRows.length === 0 ? <p className="muted">এই বর্ষে এখনো কেউ ভর্তি নেই।</p> : (
          <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
            <table>
              <thead><tr><th>আইডি</th><th>নাম</th><th>শ্রেণি</th><th></th></tr></thead>
              <tbody>
                {tRows.map((e) => (
                  <tr key={e.id}>
                    <td>{stu[e.student_id].student_no}</td><td>{nm(stu[e.student_id])}</td>
                    <td style={{ minWidth: 190 }}><Select value={e.class_id || ''} onChange={(v) => changeClass(e, v)} options={classOpts} /></td>
                    <td><button className="btn small outline" onClick={() => remove(e)}>বাদ দিন</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
