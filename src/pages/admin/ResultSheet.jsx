import { fixLegacy } from '../../lib/bijoy'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { readXlsx, saveBlob, writeXlsx } from '../../lib/xlsx'
import { Select } from '../../components/Ui'
import { nm } from './fin'

/* মাদরাসার ছাপা রেজাল্ট শিট (ক্র. | আইডি | নাম | বিষয়গুলো… | প্রাপ্ত নম্বর | গড় নম্বর | বিভাগ | মেধাস্থান) থেকে ইম্পোর্ট */
const BND = '০১২৩৪৫৬৭৮৯'
const dig = (s) => String(s ?? '').replace(/[০-৯]/g, (d) => BND.indexOf(d))
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\s*‌‍]+/g, '').toLowerCase()
const nk = (s) => String(s ?? '').normalize('NFD').trim().replace(/\s+/g, ' ').toLowerCase()
const idKey = (v) => dig(v).replace(/\s+/g, '').toUpperCase()
const blank = (v) => v === null || v === undefined || String(v).trim() === ''
const bn = (n) => String(n).replace(/\d/g, (d) => BND[d])
const ABSENT = ['অনুপস্থিত', 'অনুপস্থিতি', 'অনু', 'absent', 'ab', 'a']

const FIELDS = [
  ['serial', ['ক্র', 'ক্র.', 'ক্রম', 'ক্রমিক', 'ক্রমিকনং', 'sl', 'serial']],
  ['no', ['আইডি', 'আইডিনং', 'আইডিনম্বর', 'id', 'রোল', 'রোলনং']],
  ['name', ['নাম', 'ছাত্রেরনাম', 'শিক্ষার্থীরনাম', 'name']],
  ['total', ['প্রাপ্তনম্বর', 'প্রাপ্তনম্বর', 'মোটনম্বর', 'মোট', 'total']],
  ['avg', ['গড়নম্বর', 'গড়', 'average', 'avg']],
  ['division', ['বিভাগ', 'গ্রেড', 'ফলাফল', 'division', 'grade']],
  ['merit', ['মেধাস্থান', 'মেধাক্রম', 'স্থান', 'মেধা', 'merit', 'position']],
]
const fieldOf = (h) => { const x = norm(h).replace(/\./g, ''); const f = FIELDS.find(([, ks]) => ks.some((k) => norm(k).replace(/\./g, '') === x)); return f ? f[0] : null }
const clean = (v) => {
  if (blank(v)) return null
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
  const s = String(v).trim()
  return /^[\d০-৯.,]+$/.test(s) ? dig(s) : s
}
const cleanAvg = (v) => {
  const c = clean(v)
  return c !== null && /^\d+(\.\d+)?$/.test(c) ? Number(c).toFixed(2) : c
}

function findHeader(sheet) {
  const rows = sheet ? sheet.rows : []
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = {}
    ;(rows[i] || []).forEach((h, ci) => { const f = fieldOf(h); if (f && m[f] === undefined) m[f] = ci })
    if (m.name !== undefined) return { at: i, map: m }
  }
  return null
}

function parse(sheet, ctx, exam, cls, opt) {
  const rows = sheet ? sheet.rows : []
  const hd = findHeader(sheet)
  if (!hd) return { fatal: `"${sheet ? sheet.name : ''}" পাতায় শিরোনাম সারিতে "নাম" কলাম পাওয়া যায়নি।` }
  const { at, map } = hd
  const byName = map.no === undefined // আইডি কলাম না থাকলে নাম মিলিয়ে চেনা হয়
  const used = new Set(Object.values(map))
  const head = rows[at] || []
  const firstSummary = Math.min(...['total', 'avg', 'division', 'merit'].map((k) => (map[k] === undefined ? 9999 : map[k])))
  const subjCols = []
  head.forEach((h, ci) => { if (!blank(h) && !used.has(ci) && !Object.values(map).includes(ci)) subjCols.push({ ci, name: String(h).replace(/\s+/g, ' ').trim() }) })
  if (!subjCols.length) return { fatal: 'বিষয়ের কলাম পাওয়া যায়নি। নাম কলামের পরে প্রতিটি বিষয়ের নাম শিরোনামে লিখুন।' }
  const existing = ctx.subs
  const subjects = subjCols.map((s) => ({ ...s, site: existing[nk(s.name)] || null }))
  const out = []
  const warnSub = (s, full) => full
  for (let i = at + 1; i < rows.length; i++) {
    const cells = rows[i] || []
    if (!cells.some((v) => !blank(v))) continue
    const n = i + 1
    const issues = []
    const nameCell = blank(cells[map.name]) ? '' : String(cells[map.name]).trim()
    const no = byName ? '' : idKey(cells[map.no])
    const rec = { n, no, name: nameCell, issues, marks: [], stIssues: [] }
    if (byName) {
      if (!nameCell) continue
      const c = ctx.inClass.filter((x) => nk(x.name_bn) === nk(nameCell))
      if (c.length === 1) rec.st = c[0]
      else rec.stIssues.push(c.length ? 'এই নামে একাধিক শিক্ষার্থী আছে — তালিকা থেকে বাছুন' : 'নাম এই শ্রেণির কারও সাথে মেলেনি — তালিকা থেকে বাছুন')
    } else if (!no) {
      if (!nameCell) continue
      rec.stIssues.push('আইডি ফাঁকা — তালিকা থেকে বাছুন')
    } else if (ctx.byNo[no]) {
      rec.st = ctx.byNo[no]
      if (nameCell && nk(nameCell) !== nk(rec.st.name_bn)) rec.nameWarn = `শিটের নাম "${nameCell}", সাইটে "${rec.st.name_bn}" — আইডি অনুযায়ী ধরা হয়েছে`
    } else rec.stIssues.push(`আইডি "${no}" সাইটে পাওয়া যায়নি — তালিকা থেকে বাছুন`)
    let any = false
    subjects.forEach((s) => {
      const v = cells[s.ci]
      if (blank(v)) return
      const full = s.site ? Number(s.site.full_marks) : opt.full
      if (ABSENT.includes(nk(v))) { rec.marks.push({ s, marks: null, absent: true }); any = true; return }
      const x = Number(dig(String(v)).replace(/,/g, '').trim())
      if (!Number.isFinite(x)) { issues.push(['err', `"${s.name}" এর নম্বর সংখ্যা নয় ("${v}")`]); return }
      if (x < 0 || x > full) { issues.push(['err', `"${s.name}" — ${x} নম্বর ০ থেকে ${full} এর মধ্যে হতে হবে`]); return }
      rec.marks.push({ s, marks: x, absent: false }); any = true
    })
    if (!any && !issues.some((x) => x[0] === 'err')) issues.push(['err', 'কোনো বিষয়ে নম্বর নেই'])
    rec.result = {
      serial: map.serial === undefined ? null : clean(cells[map.serial]),
      total: map.total === undefined ? null : clean(cells[map.total]),
      avg: map.avg === undefined ? null : cleanAvg(cells[map.avg]),
      division: map.division === undefined ? null : (blank(cells[map.division]) ? null : fixLegacy(String(cells[map.division]).trim())),
      merit: map.merit === undefined ? null : clean(cells[map.merit]),
    }
    out.push(rec)
  }
  return { rows: out, subjects, byName, hasSummary: ['total', 'avg', 'division', 'merit'].filter((k) => map[k] !== undefined), warnSub, firstSummary }
}

export default function ResultSheet() {
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [examId, setExamId] = useState('')
  const [clsId, setClsId] = useState('')
  const [full, setFull] = useState('100')
  const [pass, setPass] = useState('33')
  const [book, setBook] = useState(null) // { sheets, cands }
  const [sheetName, setSheetName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [picks, setPicks] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [out, setOut] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    const [e, c, st, sb] = await Promise.all([
      supabase.from('exams').select('id,name_bn,name_en,year').order('created_at', { ascending: false }),
      supabase.from('classes').select('id,name_bn,name_en,sort').order('sort'),
      fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,class_id').order('student_no').range(a, b)),
      fetchAll((a, b) => supabase.from('exam_subjects').select('id,exam_id,class_id,name_bn,name_en,full_marks,pass_marks,sort').order('id').range(a, b)),
    ])
    setExams(e.data || []); setClasses(c.data || []); setStudents(st.data || []); setSubjects(sb.data || [])
    return { students: st.data || [], subjects: sb.data || [] }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setBook(null); setParsed(null); setPicks({}); setOut(null); setMsg('') }, [examId, clsId])

  const mk = (d) => {
    const byNo = {}; d.students.forEach((s) => { if (s.student_no) byNo[idKey(s.student_no)] = s })
    const subs = {}
    d.subjects.filter((s) => s.exam_id === examId && s.class_id === clsId).forEach((s) => { [s.name_bn, s.name_en].forEach((x) => { if (x) subs[nk(x)] = s }) })
    return { byNo, subs, inClass: d.students.filter((s) => s.class_id === clsId) }
  }

  async function template() {
    setMsg('')
    if (!examId || !clsId) return setMsg('আগে পরীক্ষা ও শ্রেণি বাছুন।')
    const d = await load()
    const ctx = mk(d)
    const subs = [...new Map(Object.values(ctx.subs).map((s) => [s.id, s])).values()].sort((a, b) => a.sort - b.sort)
    const list = ctx.inClass
    const head = ['ক্র.', 'আইডি', 'নাম', ...subs.map((s) => s.name_bn || s.name_en), 'প্রাপ্ত নম্বর', 'গড় নম্বর', 'বিভাগ', 'মেধাস্থান']
    const rows = list.map((s, i) => [String(i + 1), s.student_no || '', s.name_bn || ''])
    const doc = [
      ['নির্দেশনা'],
      ['১. "তথ্য" পাতায় আপনার ছাপা শিটের মতোই কলাম আছে। "আইডি" কলামটি বাড়তি — এটি থাকলে শিক্ষার্থী নির্ভুলভাবে চেনা হয়। (আইডি কলাম না থাকলেও চলে; তখন নাম মিলিয়ে চেনা হয়।)'],
      ['২. বিষয়ের কলামে নম্বর লিখুন। অনুপস্থিত হলে "অনুপস্থিত" লিখুন, নম্বর না দিতে চাইলে ঘর ফাঁকা রাখুন।'],
      ['৩. প্রাপ্ত নম্বর, গড় নম্বর, বিভাগ ও মেধাস্থান শিটে যা লিখবেন সাইটে হুবহু তাই দেখাবে — সাইট নিজে হিসাব করে না।'],
      ['৪. বিষয় সাইটে না থাকলে ইম্পোর্টের সময় নতুন বিষয় হিসেবে তৈরি হবে। বিষয়ের কলামের নাম আপনার পছন্দমতো দিতে পারেন।'],
    ]
    saveBlob(await writeXlsx([
      { name: 'তথ্য', rows: [head, ...rows], headerRow: true, widths: [8, 14, 24, ...subs.map(() => 14), 14, 14, 14, 12], textCols: [0, 1, 2], maxRow: rows.length + 50 },
      { name: 'নির্দেশনা', rows: doc, kind: 'doc', widths: [90] },
    ]), 'ফলাফল-শিট-টেমপ্লেট.xlsx')
  }

  async function runParse(sheets, name) {
    const d = await load()
    const sh = sheets.find((x) => x.name === name)
    setPicks({}); setOut(null); setMsg('')
    const r = parse(sh, mk(d), null, null, { full: Number(dig(full)) || 100 })
    if (r.fatal) { setMsg(r.fatal); setParsed(null) } else setParsed(r)
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]
    const inp = e.target
    setParsed(null); setBook(null); setOut(null); setMsg(''); setPicks({})
    if (!f) return
    setTimeout(() => { try { inp.value = '' } catch (x) { /* ignore */ } }, 0)
    if (!examId || !clsId) return setMsg('আগে পরীক্ষা ও শ্রেণি বাছুন, তারপর ফাইল দিন।')
    if (!/\.xlsx$/i.test(f.name)) return setMsg('শুধু .xlsx ফাইল চলবে। পুরোনো .xls হলে এক্সেলে খুলে "Save as .xlsx" করুন।')
    try {
      setBusy('read')
      const sheets = await readXlsx(await f.arrayBuffer())
      const cands = sheets.filter((x) => findHeader(x))
      if (!cands.length) { setMsg(`ফাইলের কোনো পাতায় "নাম" শিরোনাম পাওয়া যায়নি। পাতাগুলো: ${sheets.map((x) => x.name).join(', ')}। প্রথম সারিতে ক্র., নাম, বিষয়ের নাম… প্রাপ্ত নম্বর, গড় নম্বর, বিভাগ, মেধাস্থান লিখুন।`); return }
      const first = (cands.find((x) => x.name === 'তথ্য') || cands[0]).name
      setBook({ sheets, cands: cands.map((x) => x.name) }); setSheetName(first)
      await runParse(sheets, first)
    } catch (ex) { setMsg(`ফাইল পড়া যায়নি: ${ex.message}`) } finally { setBusy('') }
  }

  async function changeSheet(n) {
    setSheetName(n)
    try { setBusy('read'); await runParse(book.sheets, n) } finally { setBusy('') }
  }

  // ছাত্র চূড়ান্ত করা: নিজে বাছাই > স্বয়ংক্রিয় মিল; ফাইলে একই ছাত্র দুবার থাকলে ভুল
  const rows = useMemo(() => {
    if (!parsed) return []
    const byId = Object.fromEntries(students.map((s) => [s.id, s]))
    const used = {}
    return parsed.rows.map((r) => {
      const st = picks[r.n] ? byId[picks[r.n]] : r.st
      const errs = r.issues.filter((x) => x[0] === 'err').map((x) => x[1]); const warns = r.issues.filter((x) => x[0] === 'warn').map((x) => x[1])
      if (!st) errs.unshift(...(r.stIssues.length ? r.stIssues : ['শিক্ষার্থী বাছুন']))
      else {
        if (used[st.id]) errs.push('এই শিক্ষার্থী ফাইলে আগেও আছে')
        used[st.id] = true
        if (!picks[r.n] && r.nameWarn) warns.push(r.nameWarn)
        if (st.class_id && st.class_id !== clsId) warns.push('শিক্ষার্থী সাইটে অন্য শ্রেণিতে আছে — তবু ফলাফল যোগ হবে')
      }
      return { ...r, st, status: errs.length ? 'error' : warns.length ? 'warn' : 'ok', msgs: [...errs, ...warns] }
    })
  }, [parsed, picks, students, clsId])

  const good = rows.filter((r) => r.status === 'ok' || r.status === 'warn')
  const newSubs = parsed ? parsed.subjects.filter((s) => !s.site) : []

  async function doImport() {
    if (!good.length) return
    setBusy('save'); setMsg('')
    try {
      const fullN = Number(dig(full)) || 100; const passN = Number(dig(pass)) || 0
      const ids = {}
      parsed.subjects.forEach((s) => { if (s.site) ids[s.ci] = s.site.id })
      const base = subjects.filter((s) => s.exam_id === examId && s.class_id === clsId)
      const max = base.reduce((m, s) => Math.max(m, s.sort || 0), 0)
      let created = 0
      for (const s of newSubs) {
        const { data, error } = await supabase.from('exam_subjects').insert({ exam_id: examId, class_id: clsId, name_bn: s.name, full_marks: fullN, pass_marks: passN, sort: max + 1 + created }).select('id').single()
        if (error) throw new Error(`বিষয় "${s.name}" তৈরি হয়নি: ${error.message}`)
        ids[s.ci] = data.id; created += 1
      }
      const marks = good.flatMap((r) => r.marks.map((m) => ({ exam_id: examId, subject_id: ids[m.s.ci], student_id: r.st.id, marks: m.marks, absent: m.absent })))
      const results = good.map((r) => ({ exam_id: examId, student_id: r.st.id, class_id: clsId, serial: r.result.serial, total_text: r.result.total, avg_text: r.result.avg, division: r.result.division, merit_text: r.result.merit, updated_at: new Date().toISOString() }))
      let failed = 0; let firstErr = ''
      for (let i = 0; i < marks.length; i += 200) {
        const { error } = await supabase.from('exam_marks').upsert(marks.slice(i, i + 200), { onConflict: 'subject_id,student_id' })
        if (error) { failed += Math.min(200, marks.length - i); firstErr = firstErr || error.message }
      }
      let rfail = 0
      for (let i = 0; i < results.length; i += 200) {
        const { error } = await supabase.from('exam_results').upsert(results.slice(i, i + 200), { onConflict: 'exam_id,student_id' })
        if (error) { rfail += Math.min(200, results.length - i); firstErr = firstErr || error.message }
      }
      setOut({ students: good.length, marks: marks.length - failed, failed: failed + rfail, created, firstErr, skipped: rows.length - good.length })
      setParsed(null); setBook(null)
      await load()
    } catch (ex) { setMsg(ex.message) } finally { setBusy('') }
  }

  const exOpts = exams.map((x) => [x.id, `${nm(x)}${x.year ? ` (${x.year})` : ''}`])
  const clOpts = classes.map((x) => [x.id, nm(x)])
  const cnt = { ok: rows.filter((r) => r.status === 'ok').length, warn: rows.filter((r) => r.status === 'warn').length, error: rows.filter((r) => r.status === 'error').length }
  const stuOpts = students.filter((s) => s.class_id === clsId).map((s) => [s.id, `${s.name_bn || ''} (${s.student_no || '—'})`])

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>ছাপা রেজাল্ট শিট থেকে ফলাফল ইম্পোর্ট</h3>
      <p className="muted">আপনার ছাপা ফলাফলের ছকেই এক্সেল ফাইল দিন: <b>ক্র. | (আইডি) | নাম | বিষয়গুলো | প্রাপ্ত নম্বর | গড় নম্বর | বিভাগ | মেধাস্থান</b>। "আইডি" কলাম থাকলে শিক্ষার্থী আইডি দিয়ে চেনা হয়, না থাকলে নাম মিলিয়ে (না মিললে আপনি তালিকা থেকে বেছে দেবেন)। প্রাপ্ত নম্বর, গড়, বিভাগ ও মেধাস্থান শিটে যা আছে অভিভাবক সাইটে হুবহু তাই দেখবেন।</p>
      <div className="grid g2" style={{ marginBottom: 10 }}>
        <div className="field"><label>পরীক্ষা</label><Select placeholder="পরীক্ষা বাছুন" value={examId} onChange={setExamId} options={exOpts} /></div>
        <div className="field"><label>শ্রেণি</label><Select placeholder="শ্রেণি বাছুন" value={clsId} onChange={setClsId} options={clOpts} /></div>
        <div className="field"><label>নতুন বিষয়ের পূর্ণমান</label><input value={full} onChange={(e) => setFull(e.target.value)} inputMode="numeric" /></div>
        <div className="field"><label>নতুন বিষয়ের পাশ নম্বর</label><input value={pass} onChange={(e) => setPass(e.target.value)} inputMode="numeric" /></div>
      </div>
      <p className="muted" style={{ fontSize: '.85rem', marginTop: 0 }}>পূর্ণমান ও পাশ নম্বর শুধু সাইটে নেই এমন নতুন বিষয়ের জন্য। পাশ নম্বরের নিচে পেলে অভিভাবকের পাতায় নম্বর লাল দেখাবে। আগে থেকে থাকা বিষয় বদলাবে না।</p>
      <div className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn outline" onClick={template} disabled={Boolean(busy)}>টেমপ্লেট নামান</button>
        <label className="btn" style={{ cursor: busy ? 'wait' : 'pointer' }}>{busy === 'read' ? 'পড়া হচ্ছে…' : 'এক্সেল ফাইল বাছুন'}<input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} disabled={Boolean(busy)} style={{ display: 'none' }} /></label>
      </div>
      {msg && <div className="alert err" style={{ marginTop: 12 }}>{msg}</div>}

      {book && book.cands.length > 1 && (
        <div className="field" style={{ marginTop: 12, maxWidth: 360 }}>
          <label>ফাইলে একাধিক পাতা আছে — কোনটি ইম্পোর্ট করবেন?</label>
          <Select value={sheetName} onChange={changeSheet} options={book.cands} />
        </div>
      )}

      {parsed && (
        <div style={{ marginTop: 14 }}>
          <div className="alert">
            পাতা "{sheetName}": মোট {bn(rows.length)} জন শিক্ষার্থী — ঠিক {bn(cnt.ok)}, ওয়ার্নিং {bn(cnt.warn)}, ভুল {bn(cnt.error)} (ভুলের সারি বাদ যাবে)।
            {parsed.byName && ' ফাইলে "আইডি" কলাম নেই, তাই নাম মিলিয়ে শিক্ষার্থী চেনা হয়েছে।'}
            {' '}বিষয় পাওয়া গেছে {bn(parsed.subjects.length)} টি{newSubs.length ? `; এর মধ্যে সাইটে নেই, নতুন তৈরি হবে: ${newSubs.map((s) => s.name).join('، ')}` : ''}।
            {parsed.hasSummary.length < 4 && ' শিটে প্রাপ্ত নম্বর/গড়/বিভাগ/মেধাস্থানের সব কলাম নেই — যেগুলো নেই সেগুলো অভিভাবকের পাতায় দেখাবে না।'}
          </div>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>সারি</th><th>{parsed.byName ? 'শিটের নাম' : 'আইডি'}</th><th>শিক্ষার্থী</th><th>নম্বর</th><th>প্রাপ্ত</th><th>গড়</th><th>বিভাগ</th><th>মেধা</th><th>অবস্থা</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n}>
                    <td>{bn(r.n)}</td><td>{parsed.byName ? r.name : r.no}</td>
                    <td style={{ minWidth: 200 }}>{!r.st || picks[r.n] || r.stIssues.length ? <Select small placeholder="শিক্ষার্থী বাছুন" value={picks[r.n] || (r.st ? r.st.id : '')} onChange={(v) => setPicks({ ...picks, [r.n]: v })} options={stuOpts} /> : r.st.name_bn}</td>
                    <td>{bn(r.marks.length)}</td>
                    <td>{r.result?.total ?? ''}</td><td>{r.result?.avg ?? ''}</td><td>{r.result?.division ?? ''}</td><td>{r.result?.merit ?? ''}</td>
                    <td style={{ color: r.status === 'error' ? 'var(--secondary)' : undefined }}>{r.status === 'ok' ? 'ঠিক' : r.msgs.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 12 }} disabled={busy === 'save' || !good.length} onClick={doImport}>{busy === 'save' ? 'ইম্পোর্ট হচ্ছে…' : `${bn(good.length)} জনের ফলাফল ইম্পোর্ট করুন`}</button>
        </div>
      )}

      {out && (
        <div className={`alert ${out.failed ? 'err' : 'ok'}`} style={{ marginTop: 12 }}>
          <b>ইম্পোর্ট শেষ।</b> {bn(out.students)} জন শিক্ষার্থীর ফলাফল সংরক্ষিত, {bn(out.marks)} টি নম্বর। {out.created ? `নতুন বিষয় তৈরি হয়েছে ${bn(out.created)} টি। ` : ''}{out.skipped ? `ভুলের কারণে বাদ ${bn(out.skipped)} জন। ` : ''}{out.failed ? `সংরক্ষণ হয়নি ${bn(out.failed)} টি (${out.firstErr})।` : ''}
          <div className="muted" style={{ marginTop: 6 }}>পরীক্ষাটি "প্রকাশিত" থাকলে অভিভাবক এখন সাইটের ফলাফল পাতায় দেখতে পারবেন।</div>
        </div>
      )}
    </div>
  )
}
