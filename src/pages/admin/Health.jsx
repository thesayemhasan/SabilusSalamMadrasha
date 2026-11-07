import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm } from '../../components/Ui'
import { dateBn, nm, num, taka, todayStr } from './fin'

const KIND = { illness: 'অসুস্থতা', injury: 'আঘাত', checkup: 'স্বাস্থ্য পরীক্ষা', other: 'অন্যান্য' }

// স্বাস্থ্য ব্যবস্থাপনা: অসুস্থতা, আঘাত, চিকিৎসা ও চিকিৎসা ব্যয়ের খাতা
export default function Health() {
  const confirm = useConfirm()
  const [tab, setTab] = useState('one')
  const [students, setStudents] = useState([])
  const [all, setAll] = useState([])
  const [sid, setSid] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ kind: 'illness', rec_date: todayStr(), problem: '', treatment: '', cost: '', note: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const s = await fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,status').order('student_no').order('id').range(a, b))
    setStudents(s.data || [])
    const h = await fetchAll((a, b) => supabase.from('health_records').select('*').order('rec_date', { ascending: false }).order('id').range(a, b))
    setAll(h.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const stu = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])
  const st = stu[sid]
  const mine = all.filter((r) => r.student_id === sid)
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const list = k ? students.filter((s) => `${s.student_no || ''} ${s.name_bn || ''} ${s.name_en || ''}`.toLowerCase().includes(k)) : students.filter((s) => s.status === 'active')
    return list.slice(0, 200).map((s) => [s.id, `${s.student_no || ''} — ${nm(s)}`])
  }, [students, q])
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!st) return setMsg('আগে শিক্ষার্থী বাছুন।')
    if (!form.problem.trim()) return setMsg('সমস্যা বা বিবরণ লিখুন।')
    setBusy(true); setMsg('')
    const { error } = await supabase.from('health_records').insert({ student_id: st.id, kind: form.kind, rec_date: form.rec_date || todayStr(), problem: form.problem.trim(), treatment: form.treatment.trim() || null, cost: num(form.cost), note: form.note.trim() || null })
    setBusy(false)
    if (error) return setMsg(`সংরক্ষণ হয়নি: ${error.message}`)
    setForm({ ...form, problem: '', treatment: '', cost: '', note: '' })
    setMsg('সংরক্ষিত হয়েছে।')
    load()
  }
  async function del(r) {
    if (!(await confirm({ name: r.problem, text: 'এই রেকর্ড মুছবেন?' }))) return
    const { error } = await supabase.from('health_records').delete().eq('id', r.id)
    if (error) return setMsg(error.message)
    load()
  }
  const rows = (list, withName) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>তারিখ</th>{withName && <th>শিক্ষার্থী</th>}<th>ধরন</th><th>সমস্যা</th><th>চিকিৎসা</th><th>খরচ</th><th></th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td>{dateBn(r.rec_date)}</td>{withName && <td>{stu[r.student_id] ? `${stu[r.student_id].student_no || ''} ${nm(stu[r.student_id])}` : ''}</td>}
              <td>{KIND[r.kind]}</td><td>{r.problem}</td><td>{r.treatment}</td><td>{r.cost ? taka(r.cost) : ''}</td>
              <td><button className="btn small outline" onClick={() => del(r)}>মুছুন</button></td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={withName ? 7 : 6} className="muted">কোনো রেকর্ড নেই।</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <h2>স্বাস্থ্য ব্যবস্থাপনা</h2>
      <div className="tabs">
        <button className={tab === 'one' ? 'on' : ''} onClick={() => setTab('one')}>শিক্ষার্থীর স্বাস্থ্য খাতা</button>
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>সাম্প্রতিক সব ({all.length.toLocaleString('bn-BD')})</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|আগে|লিখুন/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      {tab === 'one' && (
        <>
          <div className="card form" style={{ marginBottom: 14 }}>
            <div className="grid g2">
              <div className="field"><label>শিক্ষার্থী খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
              <div className="field"><label>শিক্ষার্থী বাছুন</label><Select value={sid} onChange={setSid} options={options} placeholder="শিক্ষার্থী বাছুন" /></div>
            </div>
            {st && (
              <>
                <div className="grid g2">
                  <div className="field"><label>ধরন</label><Select value={form.kind} onChange={(v) => up('kind', v)} options={Object.entries(KIND)} /></div>
                  <div className="field"><label>তারিখ</label><input type="date" value={form.rec_date} onChange={(e) => up('rec_date', e.target.value)} /></div>
                </div>
                <div className="field"><label>সমস্যা / বিবরণ</label><input value={form.problem} onChange={(e) => up('problem', e.target.value)} placeholder="যেমন: জ্বর ও গলাব্যথা" /></div>
                <div className="grid g2">
                  <div className="field"><label>চিকিৎসা / ঔষধ</label><input value={form.treatment} onChange={(e) => up('treatment', e.target.value)} /></div>
                  <div className="field"><label>চিকিৎসা খরচ (টাকা)</label><input type="number" min="0" value={form.cost} onChange={(e) => up('cost', e.target.value)} /></div>
                </div>
                <div className="field"><label>নোট (ঐচ্ছিক)</label><input value={form.note} onChange={(e) => up('note', e.target.value)} /></div>
                <button className="btn" disabled={busy} onClick={save}>সংরক্ষণ</button>
              </>
            )}
          </div>
          {st && <><p className="muted">{nm(st)} — মোট {mine.length.toLocaleString('bn-BD')}টি রেকর্ড · মোট চিকিৎসা খরচ {taka(mine.reduce((a, r) => a + num(r.cost), 0))}</p>{rows(mine, false)}</>}
        </>
      )}
      {tab === 'all' && rows(all.slice(0, 200), true)}
    </>
  )
}
