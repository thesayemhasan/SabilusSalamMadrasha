import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useSite } from '../../lib/store'
import { Select } from '../../components/Ui'
import LayoutDesigner, { useLayout } from '../../components/LayoutDesigner'
import { PageSheets } from '../../lib/layout'
import { marksheetData, verifyLink } from '../../lib/marksheet'
import { canvasToPdf } from '../../lib/resultPdf'
import { layoutCanvas } from '../../lib/layoutCanvas'
import { saveBlob } from '../../lib/xlsx'
import { instData } from './IdCards'
import { nm, printNode } from './fin'

const bn = (n) => Number(n).toLocaleString('bn-BD')

// মার্কশিট: পরীক্ষা + শ্রেণি বেছে শিক্ষার্থীদের মার্কশিট ছাপা/PDF; আর ডিজাইনার (নড়াচড়া, নিজের ব্যাকগ্রাউন্ড)
export default function Marksheet({ exams, classes }) {
  const { settings, t } = useSite()
  const lay = useLayout('marksheet')
  const [tab, setTab] = useState('print')
  const [examId, setExamId] = useState('')
  const [clsId, setClsId] = useState('')
  const [items, setItems] = useState([])
  const [pick, setPick] = useState({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const ref = useRef(null)
  const inst = instData(settings, t)

  useEffect(() => {
    setItems([]); setPick({}); setMsg('')
    if (!examId || !clsId) return
    let dead = false
    ;(async () => {
      setBusy('load')
      const ex = exams.find((e) => e.id === examId)
      const { data: subs } = await supabase.from('exam_subjects').select('*').eq('exam_id', examId).eq('class_id', clsId).order('sort')
      const sIds = new Set((subs || []).map((x) => x.id))
      const marks = (await fetchAll((a, b) => supabase.from('exam_marks').select('student_id,subject_id,marks,absent').eq('exam_id', examId).order('id').range(a, b))).data || []
      const res = (await fetchAll((a, b) => supabase.from('exam_results').select('*').eq('exam_id', examId).order('id').range(a, b))).data || []
      const stu = (await fetchAll((a, b) => supabase.from('students').select('*').order('student_no').order('id').range(a, b))).data || []
      const mine = marks.filter((m) => sIds.has(m.subject_id))
      const ids = new Set(mine.map((m) => m.student_id))
      const cl = classes.find((c) => c.id === clsId)
      const { data: codes } = await supabase.rpc('admin_verify_codes', { p_exam: examId, p_students: [...ids] })
      const out = stu.filter((s) => ids.has(s.id)).map((s) => {
        const rr = res.find((r) => r.student_id === s.id)
        const subjects = (subs || []).map((x) => { const m = mine.find((q) => q.student_id === s.id && q.subject_id === x.id); return { name_bn: x.name_bn, name_en: x.name_en, full: x.full_marks, pass: x.pass_marks, marks: m ? m.marks : null, absent: m ? m.absent : false } })
        return { s, data: marksheetData({ inst, student: s, className: nm(cl), exam: ex, subjects, result: rr ? { total: rr.total_text, avg: rr.avg_text, division: rr.division, merit: rr.merit_text } : null, verifyUrl: verifyLink((codes || {})[s.id]) }) }
      })
      if (!dead) { setItems(out); setPick(Object.fromEntries(out.map((o) => [o.s.id, true]))); setBusy('') }
    })()
    return () => { dead = true }
  }, [examId, clsId]) // eslint-disable-line

  const chosen = items.filter((o) => pick[o.s.id])
  const sample = useMemo(() => marksheetData({
    inst,
    student: { name_bn: 'নমুনা শিক্ষার্থী', student_no: '260001', father_name: 'নমুনা পিতা', mother_name: 'নমুনা মাতা', dob: '2015-03-04' },
    className: 'নাজেরা', exam: { name_bn: 'বার্ষিক পরীক্ষা', year: '2026/27', date_from: '2026-11-01', date_to: '2026-11-07' },
    subjects: [['কুরআন তিলাওয়াত', 100, 95], ['নাহবেমীর', 100, 89], ['ইলমুস সরফ', 100, 38], ['আকাইদ', 100, 76], ['বাংলা ও ব্যাকরণ', 100, 80]].map(([n, f, m]) => ({ name_bn: n, full: f, pass: 40, marks: m, absent: false })),
    result: { total: '378', avg: '75.60', division: 'মুমতাজ', merit: '3' }, verifyUrl: verifyLink('SAMPLE000000'),
  }), [settings, t]) // eslint-disable-line

  async function pdfOne(o) {
    setBusy('pdf')
    try { saveBlob(await canvasToPdf(await layoutCanvas(lay.cfg, 'front', o.data)), `marksheet-${o.s.student_no}.pdf`) } catch (e) { setMsg(String(e.message || e)) }
    setBusy('')
  }

  return (
    <>
      <div className="tabs">
        <button className={tab === 'print' ? 'on' : ''} onClick={() => setTab('print')}>প্রিন্ট / PDF</button>
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>ডিজাইন (নড়াচড়া ও নিজের ব্যাকগ্রাউন্ড)</button>
      </div>
      {tab === 'design' && <LayoutDesigner type="marksheet" sample={sample} layoutHook={lay} />}
      {tab === 'print' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 240 }}><Select placeholder="পরীক্ষা বাছুন" value={examId} onChange={setExamId} options={exams.map((e) => [e.id, `${nm(e)}${e.year ? ` (${e.year})` : ''}`])} /></div>
            <div style={{ minWidth: 200 }}><Select placeholder="শ্রেণি বাছুন" value={clsId} onChange={setClsId} options={classes.map((c) => [c.id, nm(c)])} /></div>
            <button className="btn" disabled={!chosen.length} onClick={() => printNode(ref.current, 'A4', '0', 'portrait')}>প্রিন্ট ({bn(chosen.length)}টি, A4)</button>
          </div>
          <p className="muted">যাদের নম্বর ইম্পোর্ট/এন্ট্রি হয়েছে শুধু তারাই এখানে আসে। ডিজাইন বদলাতে "ডিজাইন" ট্যাব দেখুন।</p>
          {busy === 'load' && <p className="muted">লোড হচ্ছে…</p>}
          {msg && <div className="alert err">{msg}</div>}
          {items.length > 0 && (
            <div className="table-wrap"><table>
              <thead><tr><th></th><th>আইডি</th><th>নাম</th><th>মোট</th><th>বিভাগ</th><th>মেধা</th><th></th></tr></thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.s.id}>
                    <td><input type="checkbox" checked={!!pick[o.s.id]} onChange={(e) => setPick({ ...pick, [o.s.id]: e.target.checked })} /></td>
                    <td>{o.s.student_no}</td><td>{nm(o.s)}</td><td>{o.data.total}</td><td>{o.data.division}</td><td>{o.data.merit}</td>
                    <td><button className="btn small outline" disabled={busy === 'pdf'} onClick={() => pdfOne(o)}>PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          <h3 style={{ marginTop: 18 }}>প্রিভিউ</h3>
          <div className="adm-scroll" ref={ref}>{chosen.length ? <PageSheets layout={lay.cfg} items={chosen.map((o) => o.data)} mode="front" /> : <p className="muted">{examId && clsId ? 'এই পরীক্ষা-শ্রেণিতে কোনো ফলাফল নেই' : 'পরীক্ষা ও শ্রেণি বাছুন'}</p>}</div>
        </>
      )}
    </>
  )
}
