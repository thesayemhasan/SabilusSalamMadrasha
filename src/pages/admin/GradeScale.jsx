import { useEffect, useState } from 'react'
import { Select } from '../../components/Ui'
import { nm } from './fin'
import { useClassList } from './Exams'
import { DEFAULT_SCALE, cleanScale, useGradeScales } from '../../lib/gradeScale'

// সেকশনভিত্তিক গ্রেড স্কেল: সবার জন্য একটি ডিফল্ট, চাইলে কোনো শ্রেণির জন্য আলাদা
export default function GradeScale() {
  const classes = useClassList()
  const { cfg, save, ready } = useGradeScales()
  const [cls, setCls] = useState('')
  const [rows, setRows] = useState(DEFAULT_SCALE)
  const [own, setOwn] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!ready) return
    const s = cls ? cfg.byClass?.[cls] : null
    setOwn(Boolean(s))
    setRows((s || cfg.def || DEFAULT_SCALE).map((r) => [...r]))
    setMsg('')
  }, [cls, ready, cfg])

  const set = (i, j, v) => setRows((a) => a.map((r, k) => (k === i ? r.map((x, m) => (m === j ? v : x)) : r)))
  const editable = !cls || own

  async function persist(next) {
    const err = await save(next)
    setMsg(err ? `সংরক্ষণ হয়নি: ${err.message}` : 'সংরক্ষিত হয়েছে। নতুন স্কেলে ফলাফল হিসাব হবে।')
  }
  function submit() {
    const clean = cleanScale(rows)
    if (clean === DEFAULT_SCALE && rows.length < 2) return setMsg('কমপক্ষে দুটি সারি দিন (শেষটি ফেল গ্রেড)।')
    if (!cls) persist({ ...cfg, def: clean })
    else persist({ ...cfg, byClass: { ...cfg.byClass, [cls]: clean } })
  }
  function useDefault() {
    const by = { ...cfg.byClass }
    delete by[cls]
    persist({ ...cfg, byClass: by })
  }

  return (
    <>
      <h2>গ্রেড স্কেল</h2>
      <p className="muted" style={{ marginTop: -6 }}>কত শতাংশ নম্বরে কোন গ্রেড ও পয়েন্ট, তা এখানে ঠিক করুন। সবার জন্য একটি ডিফল্ট স্কেল থাকে; কোনো শ্রেণির জন্য আলাদা স্কেল চাইলে সেই শ্রেণি বেছে নিন। শেষ সারিটি (০%) ফেলের গ্রেড।</p>
      <div className="field" style={{ maxWidth: 360 }}>
        <label>কোন স্কেল দেখবেন</label>
        <Select value={cls} onChange={setCls} options={[['', 'ডিফল্ট (সব শ্রেণি)'], ...classes.map((c) => [c.id, `${nm(c)}${cfg.byClass?.[c.id] ? ' — আলাদা স্কেল' : ''}`])]} />
      </div>
      {cls && !own && (
        <div className="alert info" style={{ margin: '10px 0' }}>এই শ্রেণি এখন ডিফল্ট স্কেল ব্যবহার করছে।
          <div style={{ marginTop: 8 }}><button className="btn small" onClick={() => setOwn(true)}>এই শ্রেণির জন্য আলাদা স্কেল বানান</button></div>
        </div>
      )}
      <div className="table-wrap"><table>
        <thead><tr><th>ন্যূনতম শতাংশ (%)</th><th>গ্রেড</th><th>পয়েন্ট</th><th></th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input type="number" min="0" max="100" step="0.5" disabled={!editable} value={r[0]} onChange={(e) => set(i, 0, e.target.value)} style={{ maxWidth: 110 }} /></td>
              <td><input disabled={!editable} value={r[1]} onChange={(e) => set(i, 1, e.target.value)} style={{ maxWidth: 110 }} /></td>
              <td><input type="number" min="0" step="0.25" disabled={!editable} value={r[2]} onChange={(e) => set(i, 2, e.target.value)} style={{ maxWidth: 110 }} /></td>
              <td>{editable && rows.length > 2 && <button className="btn small outline" onClick={() => setRows((a) => a.filter((_, k) => k !== i))}>মুছুন</button>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {msg && <div className={`alert ${/হয়নি|কমপক্ষে/.test(msg) ? 'err' : 'ok'}`} style={{ marginTop: 10 }}>{msg}</div>}
      {editable && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn small outline" onClick={() => setRows((a) => [...a, [0, '', 0]])}>+ সারি যোগ</button>
          <button className="btn small outline" onClick={() => setRows(DEFAULT_SCALE.map((r) => [...r]))}>প্রচলিত স্কেল বসান</button>
          <button className="btn" onClick={submit}>সংরক্ষণ</button>
          {cls && cfg.byClass?.[cls] && <button className="btn outline" onClick={useDefault}>ডিফল্টে ফিরুন</button>}
        </div>
      )}
    </>
  )
}
