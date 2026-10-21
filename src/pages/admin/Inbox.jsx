import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS = { new: 'নতুন', contacted: 'যোগাযোগ হয়েছে', admitted: 'ভর্তি হয়েছে', rejected: 'বাতিল' }
const fmt = (d) => new Date(d).toLocaleString('bn-BD')

export function Applications() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('admission_applications').select('*').order('created_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function setStatus(id, status) {
    await supabase.from('admission_applications').update({ status }).eq('id', id)
    load()
  }
  async function remove(id) {
    if (!confirm('আবেদনটি মুছে ফেলবেন?')) return
    await supabase.from('admission_applications').delete().eq('id', id)
    load()
  }
  const shown = rows.filter((r) => !filter || r.status === filter)

  return (
    <>
      <h2>ভর্তির আবেদন</h2>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">সব অবস্থা ({rows.length})</option>
          {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l} ({rows.filter((r) => r.status === k).length})</option>)}
        </select>
      </div>
      <div className="stack">
        {shown.length === 0 && <div className="card muted">কোনো আবেদন নেই।</div>}
        {shown.map((r) => (
          <div className="card" key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <div>
                <b>{r.student_name}</b> <span className={`pill ${r.status === 'new' ? 'new' : ''}`}>{STATUS[r.status]}</span>
                <div className="muted" style={{ fontSize: '.85rem' }}>☎ {r.phone} · {r.department || '—'} · {fmt(r.created_at)}</div>
              </div>
              <span>{open === r.id ? '▲' : '▼'}</span>
            </div>
            {open === r.id && (
              <div style={{ marginTop: 12 }}>
                <div className="table-wrap">
                  <table><tbody>
                    <tr><th>পিতার নাম</th><td>{r.father_name || '—'}</td></tr>
                    <tr><th>মাতার নাম</th><td>{r.mother_name || '—'}</td></tr>
                    <tr><th>শ্রেণি</th><td>{r.class_name || '—'}</td></tr>
                    <tr><th>ঠিকানা</th><td>{r.address || '—'}</td></tr>
                    <tr><th>অতিরিক্ত তথ্য</th><td>{r.note || '—'}</td></tr>
                  </tbody></table>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <select style={{ width: 'auto' }} value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                    {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <a className="btn small outline" href={`tel:${r.phone}`}>কল করুন</a>
                  <button className="btn small danger" onClick={() => remove(r.id)}>মুছুন</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export function Messages() {
  const [rows, setRows] = useState([])
  const load = useCallback(async () => {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(r) {
    await supabase.from('contact_messages').update({ is_read: !r.is_read }).eq('id', r.id)
    load()
  }
  async function remove(id) {
    if (!confirm('বার্তাটি মুছে ফেলবেন?')) return
    await supabase.from('contact_messages').delete().eq('id', id)
    load()
  }

  return (
    <>
      <h2>যোগাযোগের বার্তা</h2>
      <div className="stack">
        {rows.length === 0 && <div className="card muted">কোনো বার্তা নেই।</div>}
        {rows.map((r) => (
          <div className="card" key={r.id} style={{ borderInlineStart: r.is_read ? undefined : '4px solid var(--secondary)' }}>
            <b>{r.name}</b> {!r.is_read && <span className="pill new">নতুন</span>}
            <div className="muted" style={{ fontSize: '.85rem' }}>{r.phone ? `☎ ${r.phone} · ` : ''}{fmt(r.created_at)}</div>
            <p className="pre" style={{ margin: '8px 0' }}>{r.message}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn small outline" onClick={() => toggle(r)}>{r.is_read ? 'অপঠিত করুন' : 'পড়া হয়েছে'}</button>
              {r.phone && <a className="btn small outline" href={`tel:${r.phone}`}>কল করুন</a>}
              <button className="btn small danger" onClick={() => remove(r.id)}>মুছুন</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
