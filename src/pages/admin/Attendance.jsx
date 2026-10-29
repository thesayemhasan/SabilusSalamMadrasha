import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useYearDay, useYearMonth, useEnrolled } from '../../lib/year'
import { useSite } from '../../lib/store'
import { dig } from '../../lib/util'
import { Select, useConfirm } from '../../components/Ui'
import Icon from '../../components/Icon'
import { downloadCsv } from './Crud'

const ST = [['present', 'উপস্থিত', 'p'], ['absent', 'অনুপস্থিত', 'a'], ['late', 'দেরি', 'l'], ['leave', 'ছুটি', 'v']]
const ST_L = Object.fromEntries(ST.map(([k, l]) => [k, l]))
const nm = (r) => r.name_bn || r.name_en || '(নামহীন)'
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) : '')

// মডিউল বন্ধ থাকলে পেইজ দেখাবে না
export function Gate({ mod, name, children }) {
  const { modules } = useSite()
  if (modules[mod] === false) {
    return (
      <div className="card">
        <h3>{name} মডিউল বন্ধ আছে</h3>
        <p className="muted">এটি চালু করতে মডিউল সুইচ পেইজে যান।</p>
        <Link className="btn" to="/admin/modules">মডিউল সুইচ</Link>
      </div>
    )
  }
  return children
}

function useSessions() {
  const [list, setList] = useState([['day', 'দৈনিক']])
  useEffect(() => {
    supabase.from('lookups').select('*').eq('kind', 'session').order('sort', { ascending: true }).then(({ data }) => {
      const l = (data || []).filter((r) => r.published !== false).map((r) => [r.code || r.id, nm(r)])
      if (l.length) setList(l)
    })
  }, [])
  return list
}

function useClasses() {
  const [list, setList] = useState([])
  useEffect(() => {
    supabase.from('classes').select('*').order('sort', { ascending: true }).then(({ data }) => setList((data || []).map((r) => [r.id, nm(r)])))
  }, [])
  return list
}

/* ---------------- হাজিরা নিন ---------------- */
function Take({ type, sessions, classes }) {
  const { date, setDate, min: dMin, max: dMax } = useYearDay()
  const en = useEnrolled()
  const enIds = en.ids; const enActive = en.active
  const keep = useCallback((id) => !enActive || (enIds ? enIds.has(id) : false), [enActive, enIds])
  const [session, setSession] = useState('day')
  const [cls, setCls] = useState('')
  const [people, setPeople] = useState([])
  const [marks, setMarks] = useState({})
  const [orig, setOrig] = useState({})
  const [times, setTimes] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    const table = type === 'student' ? 'students' : 'staff'
    const ppl = await fetchAll((a, b) => {
      let q = supabase.from(table).select('*').eq('status', 'active').order('created_at', { ascending: true }).order('id').range(a, b)
      if (type === 'student' && cls) q = q.eq('class_id', cls)
      return q
    })
    const att = await fetchAll((a, b) => supabase.from('attendance').select('*').eq('person_type', type).eq('date', date).eq('session', session).order('id').range(a, b))
    const m = {}; const t = {}
    ;(att.data || []).forEach((r) => { m[r.person_id] = r.status; t[r.person_id] = { src: r.source, in: r.in_time, out: r.out_time } })
    setPeople((ppl.data || []).filter((p) => type !== 'student' || keep(p.id))); setMarks(m); setOrig(m); setTimes(t); setMsg('')
  }, [type, date, session, cls, keep])
  useEffect(() => { load() }, [load])

  const changed = useMemo(() => Object.keys(marks).filter((id) => marks[id] !== orig[id]), [marks, orig])
  const count = (k) => people.filter((p) => marks[p.id] === k).length
  const left = people.filter((p) => !marks[p.id]).length

  function allPresent() {
    setMarks((o) => { const n = { ...o }; people.forEach((p) => { if (!n[p.id]) n[p.id] = 'present' }); return n })
  }

  async function save() {
    if (!changed.length) return setMsg('কোনো পরিবর্তন নেই।')
    if (!(await confirm({ danger: false, name: `${date} এর হাজিরা`, text: `${changed.length} জনের হাজিরা সংরক্ষণ করবেন?`, ok: 'হ্যাঁ, সংরক্ষণ করুন' }))) return
    setBusy(true)
    const rows = changed.map((id) => ({ person_type: type, person_id: id, date, session, status: marks[id], source: 'manual' }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'person_type,person_id,date,session' })
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg('হাজিরা সংরক্ষণ হয়েছে।')
    load()
  }

  return (
    <>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><input type="date" value={date} min={dMin} max={dMax} onChange={(e) => setDate(e.target.value)} /></div>
        <div style={{ minWidth: 160 }}><Select value={session} onChange={setSession} options={sessions} /></div>
        {type === 'student' && <div style={{ minWidth: 200 }}><Select value={cls} onChange={setCls} options={[['', 'সব শ্রেণি'], ...classes]} /></div>}
        <button className="btn outline" onClick={allPresent}><Icon name="check" size={17} cls="cur" /> বাকি সবাই উপস্থিত</button>
      </div>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        {[['উপস্থিত', count('present')], ['অনুপস্থিত', count('absent')], ['দেরি', count('late')], ['ছুটি', count('leave')]].map(([l, n]) => (
          <div className="card stat" key={l}><b>{dig(n, 'bn')}</b><span className="muted">{l}</span></div>
        ))}
      </div>
      {people.length === 0 && <div className="card muted">{type === 'student' ? 'এই শ্রেণিতে কোনো সক্রিয় ছাত্র নেই। আগে "ছাত্র-ছাত্রী" পেইজে ছাত্র যোগ করুন।' : 'কোনো সক্রিয় শিক্ষক/কর্মচারী নেই।'}</div>}
      <div className="stack">
        {people.map((p) => (
          <div className="card att-row" key={p.id}>
            <div className="who">
              <span className="avatar-sm">{p.photo_url ? <img src={p.photo_url} alt="" /> : nm(p).charAt(0)}</span>
              <div style={{ minWidth: 0 }}>
                <b>{nm(p)}</b> <span className="tag">{p.student_no || p.staff_no}</span>
                {times[p.id]?.src === 'device' && <span className="tag built">মেশিন {hhmm(times[p.id].in)}{times[p.id].out ? ` – ${hhmm(times[p.id].out)}` : ''}</span>}
              </div>
            </div>
            <div className="seg-att">
              {ST.map(([k, l, c]) => (
                <button type="button" key={k} className={`${c} ${marks[p.id] === k ? 'on' : ''}`} onClick={() => setMarks((o) => ({ ...o, [p.id]: k }))}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {people.length > 0 && (
        <div className="card att-bar">
          <span className="muted">{left > 0 ? `${dig(left, 'bn')} জনের হাজিরা বাকি · ` : ''}{changed.length ? `${dig(changed.length, 'bn')} জনের পরিবর্তন সংরক্ষণ হয়নি` : 'সব সংরক্ষিত'}</span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {msg && <span className={msg.includes('হয়েছে') ? 'pill ok' : 'pill'}>{msg}</span>}
            <button className="btn" disabled={busy || !changed.length} onClick={save}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'হাজিরা সংরক্ষণ'}</button>
          </span>
        </div>
      )}
    </>
  )
}

/* ---------------- মাসিক রিপোর্ট ---------------- */
function Report({ type, sessions, classes }) {
  const { month, setMonth, min: mMin, max: mMax } = useYearMonth()
  const en = useEnrolled()
  const enIds = en.ids; const enActive = en.active
  const [session, setSession] = useState('day')
  const [cls, setCls] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    (async () => {
      const [y, m] = month.split('-').map(Number)
      const from = `${month}-01`
      const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
      const table = type === 'student' ? 'students' : 'staff'
      const ppl = await fetchAll((a, b) => {
        let q = supabase.from(table).select('*').order('created_at', { ascending: true }).order('id').range(a, b)
        if (type === 'student' && cls) q = q.eq('class_id', cls)
        return q
      })
      const att = await fetchAll((a, b) => supabase.from('attendance').select('*').eq('person_type', type).eq('session', session).gte('date', from).lte('date', to).order('id').range(a, b))
      const by = {}
      ;(att.data || []).forEach((r) => { (by[r.person_id] = by[r.person_id] || { present: 0, absent: 0, late: 0, leave: 0 })[r.status] += 1 })
      setRows((ppl.data || []).filter((p) => (p.status === 'active' || by[p.id]) && (type !== 'student' || !enActive || (enIds && enIds.has(p.id)))).map((p) => {
        const c = by[p.id] || { present: 0, absent: 0, late: 0, leave: 0 }
        const base = c.present + c.late + c.absent
        return { p, ...c, pct: base ? Math.round(((c.present + c.late) / base) * 100) : null }
      }))
    })()
  }, [type, month, session, cls, enIds, enActive])

  const tot = rows.reduce((a, r) => ({ present: a.present + r.present, absent: a.absent + r.absent, late: a.late + r.late, leave: a.leave + r.leave }), { present: 0, absent: 0, late: 0, leave: 0 })
  const base = tot.present + tot.late + tot.absent

  return (
    <>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><input type="month" value={month} min={mMin} max={mMax} onChange={(e) => setMonth(e.target.value)} /></div>
        <div style={{ minWidth: 160 }}><Select value={session} onChange={setSession} options={sessions} /></div>
        {type === 'student' && <div style={{ minWidth: 200 }}><Select value={cls} onChange={setCls} options={[['', 'সব শ্রেণি'], ...classes]} /></div>}
        <button className="btn outline" onClick={() => downloadCsv(`হাজিরা-${month}.csv`, ['আইডি', 'নাম', 'উপস্থিত', 'দেরি', 'অনুপস্থিত', 'ছুটি', 'উপস্থিতির হার %'], rows.map((r) => [r.p.student_no || r.p.staff_no, nm(r.p), r.present, r.late, r.absent, r.leave, r.pct ?? '']))}>
          <Icon name="upload" size={17} cls="cur" /> Excel এক্সপোর্ট
        </button>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        মোট উপস্থিত <b>{dig(tot.present, 'bn')}</b> · দেরি <b>{dig(tot.late, 'bn')}</b> · অনুপস্থিত <b>{dig(tot.absent, 'bn')}</b> · ছুটি <b>{dig(tot.leave, 'bn')}</b> · গড় উপস্থিতি <b>{base ? dig(Math.round(((tot.present + tot.late) / base) * 100), 'bn') + '%' : '—'}</b>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>আইডি</th><th>নাম</th><th>উপস্থিত</th><th>দেরি</th><th>অনুপস্থিত</th><th>ছুটি</th><th>হার</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="7" className="muted">কোনো তথ্য নেই।</td></tr>}
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td>{r.p.student_no || r.p.staff_no}</td><td>{nm(r.p)}</td>
                <td>{dig(r.present, 'bn')}</td><td>{dig(r.late, 'bn')}</td><td>{dig(r.absent, 'bn')}</td><td>{dig(r.leave, 'bn')}</td>
                <td className="pct">{r.pct === null ? '—' : `${dig(r.pct, 'bn')}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ---------------- মেশিন (ZKTeco) ---------------- */
function Device() {
  const [cfg, setCfg] = useState(null)
  const [punches, setPunches] = useState([])
  const [counts, setCounts] = useState({ s: 0, t: 0 })
  useEffect(() => {
    supabase.from('integrations').select('*').eq('key', 'zkteco').maybeSingle().then(({ data }) => setCfg(data || { enabled: false, config: {} }))
    supabase.from('device_punches').select('*').order('punched_at', { ascending: false }).limit(30).then(({ data }) => setPunches(data || []))
    Promise.all([
      fetchAll((a, b) => supabase.from('students').select('id,device_user_id').eq('status', 'active').order('id').range(a, b)),
      fetchAll((a, b) => supabase.from('staff').select('id,device_user_id').eq('status', 'active').order('id').range(a, b)),
    ]).then(([a, b]) => setCounts({ s: (a.data || []).filter((x) => x.device_user_id).length, t: (b.data || []).filter((x) => x.device_user_id).length }))
  }, [])
  const on = cfg?.enabled && cfg?.config?.push_key
  const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://আপনার-প্রজেক্ট.supabase.co'}/rest/v1/rpc/ingest_device_punch`
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>ZKTeco হাজিরা মেশিন <span className={`pill ${on ? 'ok' : ''}`}>{on ? 'চালু' : 'বন্ধ'}</span></h3>
        {on ? (
          <p>মেশিন থেকে পাঞ্চ এলে ছাত্র/শিক্ষকের হাজিরা নিজে থেকে "উপস্থিত" হিসেবে বসে যাবে। প্রথম পাঞ্চ আগমনের সময়, পরের পাঞ্চ (১০ মিনিট পর) প্রস্থানের সময় হিসেবে ধরা হয়।</p>
        ) : (
          <p>মেশিন এখনো চালু করা হয়নি। হাতে হাজিরা নিতে কোনো সমস্যা নেই। মেশিন কিনলে <Link to="/admin/integrations">"মেশিন ও বাইরের সেবা"</Link> পেইজে ZKTeco-র তথ্য ও "পুশ সার্ভার কী" দিয়ে "চালু" করুন, বাকি কাজ নিজে থেকে হবে।</p>
        )}
        <p className="muted" style={{ marginBottom: 0 }}>মেশিনের আইডি দেওয়া আছে: {dig(counts.s, 'bn')} জন ছাত্র, {dig(counts.t, 'bn')} জন শিক্ষক-কর্মচারী। ছাত্র বা কর্মচারীর ফর্মে "হাজিরা মেশিনের আইডি" ঘরে মেশিনে নথিভুক্ত আইডি বসাতে হবে।</p>
      </div>
      <details className="card" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: 'pointer' }}><b>ডেভেলপারের জন্য সংযোগের তথ্য</b></summary>
        <p className="muted">মেশিনের ডেটা পাঠানোর ব্রিজ প্রোগ্রাম (বা মেশিনের পুশ সেটিং) নিচের ঠিকানায় POST করলে হবে। apikey হিসেবে সাইটের Publishable (anon) key ব্যবহার হবে, কখনো Secret key নয়।</p>
        <pre className="pre" style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{`POST ${url}
apikey: <Publishable key>
Content-Type: application/json

{ "p_key": "<পুশ সার্ভার কী>", "p_serial": "<মেশিনের সিরিয়াল>", "p_user": "<মেশিনের ইউজার আইডি>", "p_time": "2026-01-15T07:42:10+06:00" }`}</pre>
      </details>
      <div className="card table-wrap">
        <h3 style={{ marginTop: 0 }}>সর্বশেষ পাঞ্চ</h3>
        <table>
          <thead><tr><th>সময়</th><th>মেশিনের আইডি</th><th>মেশিন</th><th>মিলেছে</th></tr></thead>
          <tbody>
            {punches.length === 0 && <tr><td colSpan="4" className="muted">এখনো কোনো পাঞ্চ আসেনি।</td></tr>}
            {punches.map((p) => <tr key={p.id}><td>{new Date(p.punched_at).toLocaleString('bn-BD')}</td><td>{p.device_user_id}</td><td>{p.serial_no}</td><td>{p.matched_type ? (p.matched_type === 'student' ? 'ছাত্র' : 'স্টাফ') : 'মেলেনি'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Attendance() {
  const [tab, setTab] = useState('take')
  const [type, setType] = useState('student')
  const sessions = useSessions()
  const classes = useClasses()
  return (
    <>
      <h2>হাজিরা</h2>
      <div className="tabs" style={{ marginBottom: 10 }}>
        {[['take', 'হাজিরা নিন'], ['report', 'মাসিক রিপোর্ট'], ['device', 'মেশিন (ZKTeco)']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab !== 'device' && (
        <div className="tabs" style={{ marginBottom: 14 }}>
          {[['student', 'ছাত্র-ছাত্রী'], ['staff', 'শিক্ষক ও কর্মচারী']].map(([k, l]) => <button type="button" key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}
        </div>
      )}
      {tab === 'take' && <Take key={type} type={type} sessions={sessions} classes={classes} />}
      {tab === 'report' && <Report key={type} type={type} sessions={sessions} classes={classes} />}
      {tab === 'device' && <Device />}
    </>
  )
}
