import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useEnrolled, inYearStudents } from '../../lib/year'
import { useSite } from '../../lib/store'
import { Select } from '../../components/Ui'
import LayoutDesigner, { useLayout } from '../../components/LayoutDesigner'
import { CardSheets } from '../../lib/layout'
import { dateBn, nm, printNode } from './fin'
import { useClassList } from './Exams'

export const instData = (settings, t) => ({ inst_name: t('site.name') || 'সাবিলুস সালাম মাদরাসা', inst_addr: t('site.address') || '', inst_phone: settings.phone || '', logo: settings.logo_url })
export const studentData = (s, clsName) => ({
  name_bn: s.name_bn || '', name_en: s.name_en || '', student_no: s.student_no || '', class: clsName || '', father_name: s.father_name || '', mother_name: s.mother_name || '',
  dob: s.dob ? dateBn(s.dob) : '', gender: s.gender === 'female' ? 'মেয়ে' : s.gender === 'male' ? 'ছেলে' : '', guardian_phone: s.guardian_phone || '', phone2: s.phone2 || '',
  address: s.address || '', blood_group: s.blood_group || '', residence: s.residence || '', admission_date: s.admission_date ? dateBn(s.admission_date) : '', photo: s.photo_url || '',
})
export const staffData = (p) => ({ name_bn: p.name_bn || '', name_en: p.name_en || '', staff_no: p.staff_no || '', designation: p.designation_bn || (p.kind === 'teacher' ? 'শিক্ষক' : 'কর্মচারী'), phone: p.phone || '', address: p.address || '', nid: p.nid || '', join_date: p.join_date ? dateBn(p.join_date) : '', photo: p.photo_url || '' })

export default function IdCards() {
  const { settings, t } = useSite()
  const classes = useClassList()
  const [kind, setKind] = useState('student')
  const [tab, setTab] = useState('print')
  const [cls, setCls] = useState('')
  const [rows, setRows] = useState([])
  const [pick, setPick] = useState({})
  const type = kind === 'staff' ? 'idcard_staff' : 'idcard_student'
  const hookS = useLayout('idcard_student')
  const hookT = useLayout('idcard_staff')
  const lay = kind === 'staff' ? hookT : hookS
  const [mode, setMode] = useState('')
  const ref = useRef(null)
  const en = useEnrolled()
  useEffect(() => {
    setPick({})
    if (kind === 'staff') fetchAll((a, b) => supabase.from('staff').select('*').eq('status', 'active').order('staff_no').range(a, b)).then(({ data }) => setRows(data || []))
    else fetchAll((a, b) => { let q = supabase.from('students').select('*').eq('status', 'active').order('student_no').order('id'); if (cls && !en.active) q = q.eq('class_id', cls); return q.range(a, b) }).then(({ data }) => setRows(inYearStudents(data || [], en).filter((s) => !cls || s.class_id === cls)))
  }, [kind, cls, en.active, en.ids, en.classOf]) // eslint-disable-line
  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const inst = instData(settings, t)
  const chosen = rows.filter((r) => pick[r.id])
  const items = chosen.map((r) => ({ ...inst, ...(kind === 'staff' ? staffData(r) : studentData(r, cname[r.class_id])) }))
  const eff = mode || lay.cfg.print || 'front'
  const sample = { ...inst, ...(kind === 'staff' ? staffData({ name_bn: 'নমুনা শিক্ষক', staff_no: 'T001', designation_bn: 'মুহাদ্দিস', phone: '01700000000' }) : studentData({ name_bn: 'নমুনা ছাত্র', student_no: '260001', father_name: 'নমুনা পিতা', guardian_phone: '01700000000', blood_group: 'A+', address: 'ঢাকা', dob: '2015-01-01' }, 'হিফজ ১ম হালকা')) }
  const toggleAll = (v) => setPick(v ? Object.fromEntries(rows.map((r) => [r.id, true])) : {})
  return (
    <>
      <h2>আইডি কার্ড</h2>
      <div className="tabs">
        <button className={tab === 'print' ? 'on' : ''} onClick={() => setTab('print')}>প্রিন্ট</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>ডিজাইন (নিজের নকশা বসান)</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 180 }}><Select value={kind} onChange={setKind} options={[['student', 'ছাত্র-ছাত্রী'], ['staff', 'শিক্ষক ও কর্মচারী']]} /></div>
        {tab === 'print' && kind === 'student' && <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি / হালকা" value={cls} onChange={setCls} options={[['', 'সব'], ...classes.map((c) => [c.id, nm(c)])]} /></div>}
      </div>
      {tab === 'design' && <LayoutDesigner key={type} type={type} sample={sample} layoutHook={lay} />}
      {tab === 'print' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 200 }}><Select value={eff} onChange={setMode} options={[['front', 'শুধু সামনের পাশ'], ['back', 'শুধু পেছনের পাশ'], ['both', 'দুই পাশ']]} /></div>
            {eff === 'both' && <div style={{ minWidth: 260 }}><Select value={lay.cfg.mirror || 'cols'} onChange={(v) => lay.setCfg({ ...lay.cfg, mirror: v })} options={[['cols', 'দুই পাশের প্রিন্ট: ডান-বাম উল্টে (সাধারণত ঠিক)'], ['rows', 'উপর-নিচ উল্টে'], ['none', 'উল্টাবে না']]} /></div>}
            <button className="btn outline" onClick={() => toggleAll(true)}>সব বাছুন</button>
            <button className="btn outline" onClick={() => toggleAll(false)}>বাছাই বাদ</button>
            <button className="btn" disabled={!chosen.length} onClick={() => printNode(ref.current, 'A4', '0')}>প্রিন্ট ({chosen.length}টি, A4)</button>
          </div>
          {eff === 'both' && <p className="muted">দুই পাশ প্রিন্টে প্রথমে সামনের পাতা, তারপর পেছনের পাতা আসে। প্রিন্টারে "দুই পাশে প্রিন্ট" দিলে কার্ড মিলে যায়; না মিললে উপরের উল্টানোর অপশন বদলে একটি পাতা পরীক্ষা করুন।</p>}
          <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16 }}><table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td style={{ width: 40 }}><input type="checkbox" checked={!!pick[r.id]} onChange={(e) => setPick({ ...pick, [r.id]: e.target.checked })} /></td><td>{kind === 'staff' ? r.staff_no : r.student_no}</td><td>{nm(r)}</td></tr>
              ))}
              {!rows.length && <tr><td className="muted">কেউ নেই</td></tr>}
            </tbody>
          </table></div>
          <h3>প্রিভিউ</h3>
          <div className="adm-scroll" ref={ref}>
            {chosen.length ? <CardSheets layout={lay.cfg} items={items} mode={eff} page={{ w: 210, h: 297 }} margin={6} pad={1} /> : <p className="muted">উপরের তালিকা থেকে বেছে নিলে কার্ড এখানে দেখা যাবে।</p>}
          </div>
        </>
      )}
    </>
  )
}
