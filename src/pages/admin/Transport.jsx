import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select } from '../../components/Ui'
import Crud from './Crud'
import { nm, taka, printNode } from './fin'
import { useClassList } from './Exams'

const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const byNo = (a, b) => String(a.student_no || '').localeCompare(String(b.student_no || ''), undefined, { numeric: true })
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '')

// ট্রান্সপোর্ট: বাস/রুট তৈরি, শিক্ষার্থী বরাদ্দ, রুটভিত্তিক তালিকা, লাইভ ট্র্যাকিং লিংক
export default function Transport() {
  const classes = useClassList()
  const [tab, setTab] = useState('alloc')
  const [routes, setRoutes] = useState([])
  const [stu, setStu] = useState([])
  const [rid, setRid] = useState('')
  const [addId, setAddId] = useState('')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const ref = useRef(null)

  const load = useCallback(async () => {
    const r = await fetchAll((a, b) => supabase.from('transport_routes').select('*').order('sort', { ascending: true }).order('name').order('id').range(a, b))
    setRoutes(r.data || [])
    const s = await fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,class_id,transport_route_id,status').eq('status', 'active').order('id').range(a, b))
    setStu(s.data || [])
  }, [])
  useEffect(() => { if (tab !== 'routes') load() }, [tab, load])
  useEffect(() => { if (!rid && routes[0]) setRid(routes[0].id) }, [routes, rid])

  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const onRoute = useMemo(() => {
    const m = {}
    stu.forEach((s) => { if (s.transport_route_id) (m[s.transport_route_id] = m[s.transport_route_id] || []).push(s) })
    Object.values(m).forEach((l) => l.sort(byNo))
    return m
  }, [stu])
  const route = routes.find((r) => r.id === rid)
  const occ = route ? onRoute[route.id] || [] : []
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const free = stu.filter((s) => !s.transport_route_id).sort(byNo)
    const list = k ? free.filter((s) => `${s.student_no || ''} ${s.name_bn || ''} ${s.name_en || ''}`.toLowerCase().includes(k)) : free
    return list.slice(0, 200).map((s) => [s.id, `${s.student_no || ''} — ${nm(s)}${cname[s.class_id] ? ` (${cname[s.class_id]})` : ''}`])
  }, [stu, q, cname])

  async function assign() {
    if (!route || !addId) return
    if (route.capacity > 0 && occ.length >= route.capacity) return setMsg(`"${route.name}" বাস পূর্ণ (আসন ${bnum(route.capacity)} টি)। আসন সংখ্যা বাড়ান বা অন্য রুট বাছুন।`)
    const { error } = await supabase.from('students').update({ transport_route_id: route.id }).eq('id', addId)
    if (error) return setMsg(`বরাদ্দ হয়নি: ${error.message}`)
    setMsg(''); setAddId(''); load()
  }
  async function unassign(s) {
    const { error } = await supabase.from('students').update({ transport_route_id: null }).eq('id', s.id)
    if (error) return setMsg(`হয়নি: ${error.message}`)
    load()
  }

  return (
    <>
      <h2>ট্রান্সপোর্ট ও বাস</h2>
      <div className="tabs">
        <button className={tab === 'alloc' ? 'on' : ''} onClick={() => setTab('alloc')}>শিক্ষার্থী বরাদ্দ</button>
        <button className={tab === 'routes' ? 'on' : ''} onClick={() => setTab('routes')}>বাস / রুট</button>
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>তালিকা প্রিন্ট</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|পূর্ণ/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'routes' && (
        <Crud
          table="transport_routes"
          title="বাস / রুট"
          hint="প্রতিটি বাস বা রুট যোগ করুন। লাইভ ট্র্যাকিংয়ের লিংক (যেমন GPS সেবার পেজ) দিলে বরাদ্দ ট্যাবে সেটি খোলার বোতাম আসবে।"
          order="sort"
          asc
          toggle={null}
          nameOf={(r) => r.name}
          blank={{ fare: 0, capacity: 0, sort: 0 }}
          fields={[
            { name: 'name', label: 'রুটের নাম', required: true },
            { name: 'vehicle_no', label: 'গাড়ির নম্বর' },
            { name: 'driver_name', label: 'চালকের নাম' },
            { name: 'driver_phone', label: 'চালকের ফোন' },
            { name: 'tracking_url', label: 'লাইভ ট্র্যাকিং লিংক (https://…)' },
            { name: 'fare', label: 'মাসিক ভাড়া (টাকা)', type: 'number' },
            { name: 'capacity', label: 'আসন সংখ্যা (০ = সীমা নেই)', type: 'number' },
            { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
            { name: 'note', label: 'নোট', type: 'textarea' },
          ]}
          summary={(r) => (<><b>{r.name}</b><div className="muted" style={{ fontSize: '.85rem' }}>{[r.vehicle_no, r.driver_name, r.driver_phone, r.fare ? `ভাড়া ${taka(r.fare)}` : ''].filter(Boolean).join(' · ')}</div></>)}
        />
      )}

      {tab === 'alloc' && (
        routes.length === 0 ? <div className="card">আগে <b>বাস / রুট</b> ট্যাব থেকে রুট যোগ করুন।</div> : (
          <>
            <div className="grid g3" style={{ marginBottom: 14 }}>
              {routes.map((r) => {
                const n = (onRoute[r.id] || []).length
                const full = r.capacity > 0 && n >= r.capacity
                return (
                  <button type="button" key={r.id} className="card" onClick={() => setRid(r.id)} style={{ textAlign: 'start', cursor: 'pointer', outline: r.id === rid ? '2px solid var(--primary)' : 'none' }}>
                    <b>{r.name}</b>{r.vehicle_no && <span className="muted"> · {r.vehicle_no}</span>}
                    <div className="muted" style={{ fontSize: '.9rem' }}>{bnum(n)}{r.capacity > 0 ? ` / ${bnum(r.capacity)}` : ''} জন{full ? ' — পূর্ণ' : ''}</div>
                  </button>
                )
              })}
            </div>
            {route && (
              <div className="card">
                <h3 style={{ marginTop: 0 }}>{route.name} — {bnum(occ.length)} জন</h3>
                <p className="muted" style={{ marginTop: -6 }}>{[route.driver_name && `চালক: ${route.driver_name}`, route.driver_phone].filter(Boolean).join(' · ')}</p>
                {safeUrl(route.tracking_url) && <p><a className="btn small" href={safeUrl(route.tracking_url)} target="_blank" rel="noreferrer">লাইভ ট্র্যাকিং খুলুন</a></p>}
                <div className="form" style={{ marginBottom: 12 }}>
                  <div className="grid g2">
                    <div className="field"><label>শিক্ষার্থী খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
                    <div className="field"><label>শিক্ষার্থী বাছুন</label><Select value={addId} onChange={setAddId} options={options} placeholder="শিক্ষার্থী বাছুন" /></div>
                  </div>
                  <button className="btn" disabled={!addId} onClick={assign}>এই বাসে বসান</button>
                </div>
                <div className="table-wrap"><table>
                  <thead><tr><th>আইডি</th><th>নাম</th><th>শ্রেণি</th><th></th></tr></thead>
                  <tbody>
                    {occ.map((s) => <tr key={s.id}><td>{s.student_no}</td><td>{nm(s)}</td><td>{cname[s.class_id] || '—'}</td><td><button className="btn small outline" onClick={() => unassign(s)}>বাস থেকে সরান</button></td></tr>)}
                    {!occ.length && <tr><td colSpan={4} className="muted">এই বাসে এখনো কেউ নেই।</td></tr>}
                  </tbody>
                </table></div>
              </div>
            )}
          </>
        )
      )}

      {tab === 'list' && (
        <>
          <div style={{ marginBottom: 12 }}><button className="btn" onClick={() => printNode(ref.current, 'A4', '12mm', 'portrait')}>প্রিন্ট (A4)</button></div>
          <div className="adm-scroll"><div ref={ref} style={{ background: '#fff', color: '#000', padding: 16, minWidth: 560 }}>
            <h2 style={{ textAlign: 'center', marginTop: 0 }}>ট্রান্সপোর্ট — রুটভিত্তিক তালিকা</h2>
            {routes.map((r) => (
              <div key={r.id} style={{ marginBottom: 16, breakInside: 'avoid' }}>
                <h3 style={{ margin: '8px 0 4px' }}>{r.name}{r.vehicle_no ? ` (${r.vehicle_no})` : ''} — {bnum((onRoute[r.id] || []).length)} জন</h3>
                <div style={{ fontSize: '.85rem', marginBottom: 4 }}>{[r.driver_name && `চালক: ${r.driver_name}`, r.driver_phone, r.fare ? `মাসিক ভাড়া ${taka(r.fare)}` : ''].filter(Boolean).join(' · ')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['ক্রম', 'আইডি', 'নাম', 'শ্রেণি'].map((h) => <th key={h} style={{ border: '1px solid #444', padding: '3px 6px', textAlign: 'start', background: '#eee' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(onRoute[r.id] || []).map((s, i) => <tr key={s.id}>{[bnum(i + 1), s.student_no, nm(s), cname[s.class_id] || ''].map((c, j) => <td key={j} style={{ border: '1px solid #444', padding: '3px 6px' }}>{c}</td>)}</tr>)}
                    {!(onRoute[r.id] || []).length && <tr><td colSpan={4} style={{ border: '1px solid #444', padding: '3px 6px' }}>কেউ নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            ))}
            {routes.length === 0 && <p>কোনো রুট নেই।</p>}
          </div></div>
        </>
      )}
    </>
  )
}
