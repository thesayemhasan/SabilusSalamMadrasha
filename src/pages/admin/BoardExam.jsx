import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm } from '../../components/Ui'
import { downloadCsv } from './Crud'
import { nm, num, taka } from './fin'
import { useClassList } from './Exams'

const ST = { registered: 'নিবন্ধিত', appeared: 'পরীক্ষা দিয়েছে', passed: 'উত্তীর্ণ', failed: 'অনুত্তীর্ণ' }
const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const blank = { board: '', exam_name: '', exam_year: '', reg_no: '', roll_no: '', fee: '', status: 'registered', result: '', note: '' }

// বোর্ড পরীক্ষার নিবন্ধন: শিক্ষার্থীর বোর্ড, পরীক্ষা, রেজিস্ট্রেশন/রোল নম্বর, ফি ও ফলাফল
export default function BoardExam() {
  const confirm = useConfirm()
  const classes = useClassList()
  const [tab, setTab] = useState('list')
  const [students, setStudents] = useState([])
  const [recs, setRecs] = useState([])
  const [sid, setSid] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fBoard, setFBoard] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const s = await fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,class_id,status').order('student_no').order('id').range(a, b))
    setStudents(s.data || [])
    const r = await fetchAll((a, b) => supabase.from('board_registrations').select('*').order('created_at', { ascending: false }).order('id').range(a, b))
    setRecs(r.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const stu = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])
  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const boards = useMemo(() => [...new Set(recs.map((r) => r.board).filter(Boolean))], [recs])
  const shown = recs.filter((r) => (!fStatus || r.status === fStatus) && (!fBoard || r.board === fBoard))
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const list = k ? students.filter((s) => `${s.student_no || ''} ${s.name_bn || ''} ${s.name_en || ''}`.toLowerCase().includes(k)) : students.filter((s) => s.status === 'active')
    return list.slice(0, 200).map((s) => [s.id, `${s.student_no || ''} — ${nm(s)}${cname[s.class_id] ? ` (${cname[s.class_id]})` : ''}`])
  }, [students, q, cname])
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function edit(r) { setEditId(r.id); setSid(r.student_id); setForm({ ...blank, ...r, fee: r.fee || '' }); setTab('add') }
  function reset() { setEditId(''); setForm(blank); setSid('') }
  async function save() {
    if (!sid) return setMsg('আগে শিক্ষার্থী বাছুন।')
    if (!form.board.trim()) return setMsg('বোর্ডের নাম লিখুন।')
    setBusy(true); setMsg('')
    const row = { student_id: sid, board: form.board.trim(), exam_name: form.exam_name.trim() || null, exam_year: form.exam_year.trim() || null, reg_no: form.reg_no.trim() || null, roll_no: form.roll_no.trim() || null, fee: num(form.fee), status: form.status, result: form.result.trim() || null, note: form.note.trim() || null }
    const { error } = editId ? await supabase.from('board_registrations').update(row).eq('id', editId) : await supabase.from('board_registrations').insert(row)
    setBusy(false)
    if (error) return setMsg(`সংরক্ষণ হয়নি: ${error.message}`)
    setMsg('সংরক্ষিত হয়েছে।'); reset(); setTab('list'); load()
  }
  async function del(r) {
    if (!(await confirm({ name: `${nm(stu[r.student_id])} — ${r.board}`, text: 'এই নিবন্ধন মুছবেন?' }))) return
    const { error } = await supabase.from('board_registrations').delete().eq('id', r.id)
    if (error) return setMsg(error.message)
    load()
  }

  return (
    <>
      <h2>বোর্ড পরীক্ষা</h2>
      <div className="tabs">
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>নিবন্ধনের তালিকা ({bnum(recs.length)})</button>
        <button className={tab === 'add' ? 'on' : ''} onClick={() => setTab('add')}>{editId ? 'নিবন্ধন সম্পাদনা' : 'নতুন নিবন্ধন'}</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|আগে|লিখুন/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'add' && (
        <div className="card form">
          <div className="grid g2">
            <div className="field"><label>শিক্ষার্থী খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
            <div className="field"><label>শিক্ষার্থী বাছুন</label><Select value={sid} onChange={setSid} options={sid && !options.some(([v]) => v === sid) && stu[sid] ? [[sid, nm(stu[sid])], ...options] : options} placeholder="শিক্ষার্থী বাছুন" /></div>
          </div>
          <div className="grid g3">
            <div className="field"><label>বোর্ডের নাম</label><input value={form.board} onChange={(e) => up('board', e.target.value)} placeholder="যেমন: বেফাক" /></div>
            <div className="field"><label>পরীক্ষার নাম / স্তর</label><input value={form.exam_name} onChange={(e) => up('exam_name', e.target.value)} /></div>
            <div className="field"><label>পরীক্ষার সাল</label><input value={form.exam_year} onChange={(e) => up('exam_year', e.target.value)} /></div>
          </div>
          <div className="grid g3">
            <div className="field"><label>রেজিস্ট্রেশন নম্বর</label><input value={form.reg_no} onChange={(e) => up('reg_no', e.target.value)} /></div>
            <div className="field"><label>রোল নম্বর</label><input value={form.roll_no} onChange={(e) => up('roll_no', e.target.value)} /></div>
            <div className="field"><label>নিবন্ধন ফি (টাকা)</label><input type="number" min="0" value={form.fee} onChange={(e) => up('fee', e.target.value)} /></div>
          </div>
          <div className="grid g2">
            <div className="field"><label>অবস্থা</label><Select value={form.status} onChange={(v) => up('status', v)} options={Object.entries(ST)} /></div>
            <div className="field"><label>ফলাফল (যেমন: মুমতাজ / ৪.৫০)</label><input value={form.result} onChange={(e) => up('result', e.target.value)} /></div>
          </div>
          <div className="field"><label>নোট</label><input value={form.note} onChange={(e) => up('note', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" disabled={busy} onClick={save}>সংরক্ষণ</button>
            {editId && <button className="btn outline" onClick={() => { reset(); setTab('list') }}>বাতিল</button>}
          </div>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ minWidth: 180 }}><Select value={fStatus} onChange={setFStatus} options={[['', 'সব অবস্থা'], ...Object.entries(ST)]} /></div>
            <div style={{ minWidth: 180 }}><Select value={fBoard} onChange={setFBoard} options={[['', 'সব বোর্ড'], ...boards.map((b) => [b, b])]} /></div>
            <button className="btn outline" disabled={!shown.length} onClick={() => downloadCsv('বোর্ড-নিবন্ধন.csv', ['আইডি', 'নাম', 'শ্রেণি', 'বোর্ড', 'পরীক্ষা', 'সাল', 'রেজি. নং', 'রোল', 'ফি', 'অবস্থা', 'ফলাফল'], shown.map((r) => { const s = stu[r.student_id] || {}; return [s.student_no, nm(s), cname[s.class_id], r.board, r.exam_name, r.exam_year, r.reg_no, r.roll_no, r.fee, ST[r.status], r.result] }))}>Excel এক্সপোর্ট</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>আইডি</th><th>নাম</th><th>বোর্ড / পরীক্ষা</th><th>রেজি. / রোল</th><th>ফি</th><th>অবস্থা</th><th>ফলাফল</th><th></th></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const s = stu[r.student_id]
                  return (
                    <tr key={r.id}>
                      <td>{s?.student_no}</td><td>{s ? nm(s) : ''}</td>
                      <td>{[r.board, r.exam_name, r.exam_year].filter(Boolean).join(' · ')}</td><td>{[r.reg_no, r.roll_no].filter(Boolean).join(' / ')}</td>
                      <td>{r.fee ? taka(r.fee) : ''}</td><td>{ST[r.status]}</td><td>{r.result}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><button className="btn small outline" onClick={() => edit(r)}>সম্পাদনা</button>{' '}<button className="btn small outline" onClick={() => del(r)}>মুছুন</button></td>
                    </tr>
                  )
                })}
                {!shown.length && <tr><td colSpan={8} className="muted">কোনো নিবন্ধন নেই।</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
