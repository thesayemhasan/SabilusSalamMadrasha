import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select, useConfirm } from '../../components/Ui'
import Crud from './Crud'
import { addDays, dateBn, nm, todayStr } from './fin'

const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')

// লাইব্রেরি: বইয়ের তালিকা, প্রদান ও ফেরত
export default function Library() {
  const confirm = useConfirm()
  const [tab, setTab] = useState('loan')
  const [books, setBooks] = useState([])
  const [loans, setLoans] = useState([])
  const [students, setStudents] = useState([])
  const [staff, setStaff] = useState([])
  const [bookId, setBookId] = useState('')
  const [who, setWho] = useState('student')
  const [pid, setPid] = useState('')
  const [q, setQ] = useState('')
  const [days, setDays] = useState(14)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [b, l, s, t] = await Promise.all([
      fetchAll((a, z) => supabase.from('library_books').select('*').order('title').order('id').range(a, z)),
      fetchAll((a, z) => supabase.from('library_loans').select('*').order('issued_on', { ascending: false }).order('id').range(a, z)),
      fetchAll((a, z) => supabase.from('students').select('id,student_no,name_bn,name_en,status').order('student_no').order('id').range(a, z)),
      fetchAll((a, z) => supabase.from('staff').select('id,staff_no,name_bn,name_en,status').order('id').range(a, z)),
    ])
    setBooks(b.data || []); setLoans(l.data || []); setStudents(s.data || []); setStaff(t.data || [])
  }, [])
  useEffect(() => { if (tab !== 'books') load() }, [tab, load])

  const out = useMemo(() => {
    const m = {}
    loans.forEach((l) => { if (!l.returned_on) m[l.book_id] = (m[l.book_id] || 0) + 1 })
    return m
  }, [loans])
  const avail = (b) => Number(b.copies || 0) - (out[b.id] || 0)
  const bookMap = useMemo(() => Object.fromEntries(books.map((b) => [b.id, b])), [books])
  const sMap = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])
  const tMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff])
  const bookOpts = books.map((b) => [b.id, `${b.code ? `${b.code} — ` : ''}${b.title} (মজুত ${bnum(avail(b))})`])
  const people = useMemo(() => {
    const k = q.trim().toLowerCase()
    const src = who === 'student' ? students : staff
    const list = src.filter((p) => (k ? `${p.student_no || p.staff_no || ''} ${p.name_bn || ''} ${p.name_en || ''}`.toLowerCase().includes(k) : p.status === 'active'))
    return list.slice(0, 200).map((p) => [p.id, `${p.student_no || p.staff_no || ''} — ${nm(p)}`])
  }, [who, students, staff, q])
  const nameOf = (l) => (l.student_id ? nm(sMap[l.student_id]) : nm(tMap[l.staff_id]))
  const active = loans.filter((l) => !l.returned_on)

  async function issue() {
    const b = bookMap[bookId]
    if (!b || !pid) return setMsg('বই ও গ্রহীতা দুটোই বাছুন।')
    if (avail(b) <= 0) return setMsg(`"${b.title}" বইয়ের সব কপি এখন প্রদান করা আছে।`)
    setBusy(true); setMsg('')
    const { error } = await supabase.from('library_loans').insert({ book_id: b.id, [who === 'student' ? 'student_id' : 'staff_id']: pid, issued_on: todayStr(), due_on: addDays(todayStr(), Number(days) || 14) })
    setBusy(false)
    if (error) return setMsg(`প্রদান হয়নি: ${error.message}`)
    setMsg('বই প্রদান করা হয়েছে।'); setPid(''); load()
  }
  async function giveBack(l) {
    if (!(await confirm({ danger: false, name: `${bookMap[l.book_id]?.title || ''} — ${nameOf(l)}`, text: 'বইটি ফেরত নেওয়া হয়েছে বলে চিহ্নিত করবেন?', ok: 'হ্যাঁ, ফেরত' }))) return
    const { error } = await supabase.from('library_loans').update({ returned_on: todayStr() }).eq('id', l.id)
    if (error) return setMsg(error.message)
    load()
  }

  return (
    <>
      <h2>লাইব্রেরি</h2>
      <div className="tabs">
        <button className={tab === 'loan' ? 'on' : ''} onClick={() => setTab('loan')}>প্রদান / ফেরত</button>
        <button className={tab === 'books' ? 'on' : ''} onClick={() => setTab('books')}>বইয়ের তালিকা</button>
        <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>সব ইতিহাস</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|বাছুন|সব কপি/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'books' && (
        <Crud
          table="library_books"
          title="বই"
          hint="লাইব্রেরির বই কোড, লেখক, তাক ও কপি সংখ্যাসহ যোগ করুন। কপি সংখ্যা বাড়ালে মজুতও বাড়বে।"
          order="title"
          asc
          toggle={null}
          nameOf={(r) => r.title}
          blank={{ copies: 1 }}
          searchFields={['title', 'author', 'code']}
          fields={[
            { name: 'title', label: 'বইয়ের নাম', required: true },
            { name: 'author', label: 'লেখক' },
            { name: 'code', label: 'বইয়ের কোড / নম্বর' },
            { name: 'category', label: 'বিষয় / ধরন' },
            { name: 'shelf', label: 'তাক / আলমারি' },
            { name: 'copies', label: 'মোট কপি', type: 'number', required: true },
            { name: 'note', label: 'নোট', type: 'textarea' },
          ]}
          summary={(r) => (<><b>{r.title}</b><div className="muted" style={{ fontSize: '.85rem' }}>{[r.author, r.code, r.shelf, `${bnum(r.copies)} কপি`].filter(Boolean).join(' · ')}</div></>)}
        />
      )}

      {tab === 'loan' && (
        <>
          <div className="card form" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>বই প্রদান</h3>
            <div className="field"><label>বই</label><Select value={bookId} onChange={setBookId} options={bookOpts} placeholder="বই বাছুন" /></div>
            <div className="grid g3">
              <div className="field"><label>কাকে</label><Select value={who} onChange={(v) => { setWho(v); setPid('') }} options={[['student', 'শিক্ষার্থী'], ['staff', 'শিক্ষক / কর্মচারী']]} /></div>
              <div className="field"><label>খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
              <div className="field"><label>বাছুন</label><Select value={pid} onChange={setPid} options={people} placeholder="বাছুন" /></div>
            </div>
            <div className="field" style={{ maxWidth: 220 }}><label>কত দিনের জন্য</label><input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></div>
            <button className="btn" disabled={busy || !bookId || !pid} onClick={issue}>বই প্রদান করুন</button>
          </div>
          <h3>এখন যে বই বাইরে আছে ({bnum(active.length)}টি)</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>বই</th><th>গ্রহীতা</th><th>প্রদান</th><th>ফেরতের তারিখ</th><th></th></tr></thead>
              <tbody>
                {active.map((l) => (
                  <tr key={l.id}>
                    <td>{bookMap[l.book_id]?.title}</td><td>{nameOf(l)}</td><td>{dateBn(l.issued_on)}</td>
                    <td>{dateBn(l.due_on)}{l.due_on && l.due_on < todayStr() && <span className="tag" style={{ background: '#c0392b', color: '#fff', marginInlineStart: 6 }}>দেরি</span>}</td>
                    <td><button className="btn small" onClick={() => giveBack(l)}>ফেরত নিন</button></td>
                  </tr>
                ))}
                {!active.length && <tr><td colSpan={5} className="muted">এখন কোনো বই বাইরে নেই।</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'hist' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>বই</th><th>গ্রহীতা</th><th>প্রদান</th><th>ফেরত</th></tr></thead>
            <tbody>
              {loans.slice(0, 300).map((l) => (
                <tr key={l.id}><td>{bookMap[l.book_id]?.title}</td><td>{nameOf(l)}</td><td>{dateBn(l.issued_on)}</td><td>{l.returned_on ? dateBn(l.returned_on) : 'বাইরে আছে'}</td></tr>
              ))}
              {!loans.length && <tr><td colSpan={4} className="muted">এখনো কোনো প্রদান হয়নি।</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
