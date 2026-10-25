import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { Select } from '../../components/Ui'
import { nm, printNode } from './fin'
import { useClassList } from './Exams'

function Card({ p, kind, cls, settings, t }) {
  const staff = kind === 'staff'
  return (
    <div className="idc">
      <div className="idc-top">
        {settings.logo_url && <img src={settings.logo_url} alt="" />}
        <div><b>{t('site.name') || 'সাবিলুস সালাম মাদরাসা'}</b><small>{staff ? 'পরিচয়পত্র' : 'ছাত্র পরিচয়পত্র'}</small></div>
      </div>
      <div className="idc-body">
        <div className="idc-photo">{p.photo_url ? <img src={p.photo_url} alt="" /> : <span>{nm(p).charAt(0)}</span>}</div>
        <div className="idc-info">
          <h4>{nm(p)}</h4>
          <div>আইডি: <b>{staff ? p.staff_no : p.student_no}</b></div>
          {staff ? <div>{p.designation_bn || (p.kind === 'teacher' ? 'শিক্ষক' : 'কর্মচারী')}</div> : <div>শ্রেণি: {cls || '—'}</div>}
          {!staff && p.father_name && <div>পিতা: {p.father_name}</div>}
          <div>{staff ? p.phone : p.guardian_phone ? `যোগাযোগ: ${p.guardian_phone}` : ''}</div>
          {!staff && p.blood_group && <div>রক্ত: {p.blood_group}</div>}
        </div>
      </div>
      <div className="idc-foot">{t('site.address')}{settings.phone ? ` · ${settings.phone}` : ''}</div>
    </div>
  )
}

export default function IdCards() {
  const { settings, t } = useSite()
  const classes = useClassList()
  const [kind, setKind] = useState('student')
  const [cls, setCls] = useState('')
  const [rows, setRows] = useState([])
  const [pick, setPick] = useState({})
  const ref = useRef(null)
  useEffect(() => {
    setPick({})
    if (kind === 'staff') fetchAll((a, b) => supabase.from('staff').select('*').eq('status', 'active').order('staff_no').range(a, b)).then(({ data }) => setRows(data || []))
    else fetchAll((a, b) => { let q = supabase.from('students').select('*').eq('status', 'active').order('student_no'); if (cls) q = q.eq('class_id', cls); return q.range(a, b) }).then(({ data }) => setRows(data || []))
  }, [kind, cls])
  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const chosen = rows.filter((r) => pick[r.id])
  const toggleAll = (v) => setPick(v ? Object.fromEntries(rows.map((r) => [r.id, true])) : {})
  return (
    <>
      <h2>আইডি কার্ড</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 180 }}><Select value={kind} onChange={setKind} options={[['student', 'ছাত্র-ছাত্রী'], ['staff', 'শিক্ষক ও কর্মচারী']]} /></div>
        {kind === 'student' && <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি / হালকা" value={cls} onChange={setCls} options={[['', 'সব'], ...classes.map((c) => [c.id, nm(c)])]} /></div>}
        <button className="btn outline" onClick={() => toggleAll(true)}>সব বাছুন</button>
        <button className="btn outline" onClick={() => toggleAll(false)}>বাছাই বাদ</button>
        <button className="btn" disabled={!chosen.length} onClick={() => printNode(ref.current, 'A4')}>প্রিন্ট ({chosen.length}টি কার্ড, A4)</button>
      </div>
      <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16 }}><table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td style={{ width: 40 }}><input type="checkbox" checked={!!pick[r.id]} onChange={(e) => setPick({ ...pick, [r.id]: e.target.checked })} /></td><td>{kind === 'staff' ? r.staff_no : r.student_no}</td><td>{nm(r)}</td></tr>
          ))}
          {!rows.length && <tr><td className="muted">কেউ নেই</td></tr>}
        </tbody>
      </table></div>
      <h3>প্রিভিউ</h3>
      <div ref={ref} className="idc-sheet">
        {chosen.map((p) => <Card key={p.id} p={p} kind={kind} cls={cname[p.class_id]} settings={settings} t={t} />)}
      </div>
      {!chosen.length && <p className="muted">উপরের তালিকা থেকে বেছে নিলে কার্ড এখানে দেখা যাবে। প্রতি A4 পাতায় ১০টি কার্ড (৮৫.৬ × ৫৪ মিমি) ছাপা হয়; ছাপার পর কেটে ল্যামিনেট করা যায়।</p>}
    </>
  )
}
