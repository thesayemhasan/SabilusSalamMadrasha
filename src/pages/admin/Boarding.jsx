import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { Select } from '../../components/Ui'
import Crud from './Crud'
import { nm, printNode } from './fin'
import { useClassList } from './Exams'

const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const byNo = (a, b) => String(a.student_no || '').localeCompare(String(b.student_no || ''), undefined, { numeric: true })

// বোর্ডিং: রুম তৈরি, শিক্ষার্থীর রুম ও সিট বরাদ্দ, রুমভিত্তিক তালিকা প্রিন্ট
export default function Boarding() {
  const classes = useClassList()
  const [tab, setTab] = useState('alloc')
  const [rooms, setRooms] = useState([])
  const [stu, setStu] = useState([])
  const [roomId, setRoomId] = useState('')
  const [addId, setAddId] = useState('')
  const [q, setQ] = useState('')
  const [onlyRes, setOnlyRes] = useState(true)
  const [msg, setMsg] = useState('')
  const ref = useRef(null)

  const load = useCallback(async () => {
    const r = await fetchAll((a, b) => supabase.from('boarding_rooms').select('*').order('sort', { ascending: true }).order('name').order('id').range(a, b))
    setRooms(r.data || [])
    const s = await fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,name_en,class_id,residence,room_id,seat_no,status').eq('status', 'active').order('id').range(a, b))
    setStu(s.data || [])
  }, [])
  useEffect(() => { if (tab !== 'rooms') load() }, [tab, load])
  useEffect(() => { if (!roomId && rooms[0]) setRoomId(rooms[0].id) }, [rooms, roomId])

  const cname = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, nm(c)])), [classes])
  const inRoom = useMemo(() => {
    const m = {}
    stu.forEach((s) => { if (s.room_id) (m[s.room_id] = m[s.room_id] || []).push(s) })
    Object.values(m).forEach((l) => l.sort(byNo))
    return m
  }, [stu])
  const room = rooms.find((r) => r.id === roomId)
  const occ = room ? inRoom[room.id] || [] : []
  const isRes = (s) => String(s.residence || '').includes('আবাসিক') && !String(s.residence || '').includes('অনাবাসিক')
  const free = useMemo(() => stu.filter((s) => !s.room_id && (!onlyRes || isRes(s))).sort(byNo), [stu, onlyRes])
  const options = useMemo(() => {
    const k = q.trim().toLowerCase()
    const list = k ? free.filter((s) => `${s.student_no || ''} ${s.name_bn || ''} ${s.name_en || ''}`.toLowerCase().includes(k)) : free
    return list.slice(0, 200).map((s) => [s.id, `${s.student_no || ''} — ${nm(s)}${cname[s.class_id] ? ` (${cname[s.class_id]})` : ''}`])
  }, [free, q, cname])
  const unassignedRes = stu.filter((s) => !s.room_id && isRes(s)).length

  async function assign() {
    if (!room || !addId) return
    if (occ.length >= room.capacity) return setMsg(`"${room.name}" রুম পূর্ণ (ধারণক্ষমতা ${bnum(room.capacity)} জন)। রুমের ধারণক্ষমতা বাড়ান বা অন্য রুম বাছুন।`)
    const { error } = await supabase.from('students').update({ room_id: room.id }).eq('id', addId)
    if (error) return setMsg(`বরাদ্দ হয়নি: ${error.message}`)
    setMsg(''); setAddId(''); load()
  }
  async function unassign(s) {
    const { error } = await supabase.from('students').update({ room_id: null, seat_no: null }).eq('id', s.id)
    if (error) return setMsg(error.message)
    load()
  }
  async function setSeat(s, v) {
    const seat = v.trim() || null
    if ((s.seat_no || null) === seat) return
    const { error } = await supabase.from('students').update({ seat_no: seat }).eq('id', s.id)
    if (error) return setMsg(error.message)
    setStu((a) => a.map((x) => (x.id === s.id ? { ...x, seat_no: seat } : x)))
  }

  return (
    <>
      <h2>বোর্ডিং ও রুম</h2>
      <div className="tabs">
        <button className={tab === 'alloc' ? 'on' : ''} onClick={() => setTab('alloc')}>সিট বরাদ্দ</button>
        <button className={tab === 'rooms' ? 'on' : ''} onClick={() => setTab('rooms')}>রুম তৈরি</button>
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>তালিকা প্রিন্ট</button>
      </div>
      {msg && <div className={`alert ${/হয়নি|পূর্ণ|ত্রুটি/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'rooms' && (
        <Crud
          table="boarding_rooms"
          title="রুম"
          hint="বোর্ডিংয়ের রুম বা কক্ষ এখানে যোগ করুন, প্রতিটির ধারণক্ষমতাসহ। তারপর 'সিট বরাদ্দ' ট্যাবে শিক্ষার্থী বসান।"
          order="sort"
          asc
          toggle={null}
          nameOf={(r) => r.name}
          blank={{ capacity: 4, sort: 0 }}
          fields={[
            { name: 'name', label: 'রুমের নাম / নম্বর', required: true },
            { name: 'building', label: 'ভবন / তলা (ঐচ্ছিক)' },
            { name: 'capacity', label: 'ধারণক্ষমতা (কতজন থাকতে পারবে)', type: 'number', required: true },
            { name: 'sort', label: 'ক্রম (ছোট সংখ্যা আগে)', type: 'number' },
            { name: 'note', label: 'নোট', type: 'textarea' },
          ]}
          summary={(r) => (<><b>{r.name}</b><div className="muted" style={{ fontSize: '.85rem' }}>{[r.building, `ধারণক্ষমতা ${bnum(r.capacity)} জন`].filter(Boolean).join(' · ')}</div></>)}
        />
      )}

      {tab === 'alloc' && (
        rooms.length === 0 ? <div className="card">আগে <b>রুম তৈরি</b> ট্যাব থেকে রুম যোগ করুন।</div> : (
          <>
            <p className="muted" style={{ marginTop: -6 }}>এখনো রুম পায়নি এমন আবাসিক শিক্ষার্থী: <b>{bnum(unassignedRes)}</b> জন।</p>
            <div className="grid g3" style={{ marginBottom: 14 }}>
              {rooms.map((r) => {
                const n = (inRoom[r.id] || []).length
                return (
                  <button type="button" key={r.id} className="card" onClick={() => setRoomId(r.id)} style={{ textAlign: 'start', cursor: 'pointer', outline: r.id === roomId ? '2px solid var(--primary)' : 'none' }}>
                    <b>{r.name}</b>{r.building && <span className="muted"> · {r.building}</span>}
                    <div className="muted" style={{ fontSize: '.9rem' }}>{bnum(n)} / {bnum(r.capacity)} জন{n >= r.capacity ? ' — পূর্ণ' : ''}</div>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--th)', marginTop: 6 }}><div style={{ height: 6, borderRadius: 4, width: `${Math.min(100, (n / Math.max(1, r.capacity)) * 100)}%`, background: n >= r.capacity ? 'var(--secondary)' : 'var(--primary)' }} /></div>
                  </button>
                )
              })}
            </div>
            {room && (
              <div className="card">
                <h3 style={{ marginTop: 0 }}>{room.name} — {bnum(occ.length)} / {bnum(room.capacity)} জন</h3>
                <div className="form" style={{ marginBottom: 12 }}>
                  <div className="grid g2">
                    <div className="field"><label>শিক্ষার্থী খুঁজুন (নাম বা আইডি)</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="লিখে খুঁজুন…" /></div>
                    <div className="field"><label>শিক্ষার্থী বাছুন</label><Select value={addId} onChange={setAddId} options={options} placeholder="শিক্ষার্থী বাছুন" /></div>
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><input type="checkbox" checked={onlyRes} onChange={(e) => setOnlyRes(e.target.checked)} /> শুধু আবাসিক শিক্ষার্থী দেখান</label>
                  <button className="btn" disabled={!addId} onClick={assign}>এই রুমে বসান</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>আইডি</th><th>নাম</th><th>শ্রেণি</th><th>সিট নং</th><th></th></tr></thead>
                    <tbody>
                      {occ.map((s) => (
                        <tr key={s.id}>
                          <td>{s.student_no}</td><td>{nm(s)}</td><td>{cname[s.class_id] || '—'}</td>
                          <td style={{ width: 110 }}><input defaultValue={s.seat_no || ''} key={`${s.id}-${s.seat_no || ''}`} onBlur={(e) => setSeat(s, e.target.value)} style={{ width: 90 }} /></td>
                          <td><button className="btn small outline" onClick={() => unassign(s)}>রুম থেকে সরান</button></td>
                        </tr>
                      ))}
                      {!occ.length && <tr><td colSpan={5} className="muted">এই রুমে এখনো কেউ নেই।</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      )}

      {tab === 'list' && (
        <>
          <div style={{ marginBottom: 12 }}><button className="btn" onClick={() => printNode(ref.current, 'A4', '12mm', 'portrait')}>প্রিন্ট (A4)</button></div>
          <div className="adm-scroll"><div ref={ref} style={{ background: '#fff', color: '#000', padding: 16, minWidth: 560 }}>
            <h2 style={{ textAlign: 'center', marginTop: 0 }}>বোর্ডিং — রুমভিত্তিক তালিকা</h2>
            {rooms.map((r) => (
              <div key={r.id} style={{ marginBottom: 16, breakInside: 'avoid' }}>
                <h3 style={{ margin: '8px 0 4px' }}>{r.name}{r.building ? ` (${r.building})` : ''} — {bnum((inRoom[r.id] || []).length)} / {bnum(r.capacity)} জন</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['ক্রম', 'আইডি', 'নাম', 'শ্রেণি', 'সিট'].map((h) => <th key={h} style={{ border: '1px solid #444', padding: '3px 6px', textAlign: 'start', background: '#eee' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(inRoom[r.id] || []).map((s, i) => (
                      <tr key={s.id}>{[bnum(i + 1), s.student_no, nm(s), cname[s.class_id] || '', s.seat_no || ''].map((c, j) => <td key={j} style={{ border: '1px solid #444', padding: '3px 6px' }}>{c}</td>)}</tr>
                    ))}
                    {!(inRoom[r.id] || []).length && <tr><td colSpan={5} style={{ border: '1px solid #444', padding: '3px 6px' }}>কেউ নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            ))}
            {rooms.length === 0 && <p>কোনো রুম নেই।</p>}
          </div></div>
        </>
      )}
    </>
  )
}
