import { useCallback, useEffect, useState } from 'react'
import { supabase, signedUrl } from '../../lib/supabase'
import Icon from '../../components/Icon'
import { Select, useConfirm } from '../../components/Ui'

const STATUS = { new: 'নতুন', contacted: 'যোগাযোগ হয়েছে', admitted: 'ভর্তি হয়েছে', rejected: 'বাতিল' }
const fmt = (d) => new Date(d).toLocaleString('bn-BD')
const isImg = (v) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(v)
function FileView({ path }) {
  const [url, setUrl] = useState('')
  useEffect(() => { signedUrl(path).then(setUrl) }, [path])
  if (!url) return <span className="muted">…</span>
  return <a className="file-link" href={url} target="_blank" rel="noreferrer">{isImg(path) ? <img src={url} alt="" /> : null}<span>ফাইল খুলুন</span></a>
}

export function Applications() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(null)
  const confirm = useConfirm()
  const load = useCallback(async () => {
    const { data } = await supabase.from('admission_applications').select('*').order('created_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function setStatus(r, status) {
    if (!(await confirm({ danger: false, name: r.student_name || 'আবেদন', text: `অবস্থা বদলে "${STATUS[status]}" করবেন?`, ok: 'হ্যাঁ, বদলান' }))) return
    await supabase.from('admission_applications').update({ status }).eq('id', r.id)
    load()
  }
  async function remove(r) {
    if (!(await confirm({ name: r.student_name || 'এই আবেদন', text: 'আবেদনটি মুছে ফেলবেন? আর ফিরিয়ে আনা যাবে না।' }))) return
    await supabase.from('admission_applications').delete().eq('id', r.id)
    load()
  }
  async function admit(r) {
    if (!(await confirm({ danger: false, name: r.student_name || 'এই আবেদন', text: 'এই আবেদনের তথ্য দিয়ে ছাত্র হিসেবে ভর্তি করবেন? ছাত্র তালিকায় যুক্ত হবে এবং আবেদনের অবস্থা "ভর্তি হয়েছে" হবে।', ok: 'হ্যাঁ, ভর্তি করুন' }))) return
    const [{ data: deps }, { data: cls }] = await Promise.all([supabase.from('departments').select('*'), supabase.from('classes').select('*')])
    const same = (a, b) => a && b && String(a).trim() === String(b).trim()
    const dep = (deps || []).find((d) => same(d.name_bn, r.department) || same(d.name_en, r.department))
    const cl = (cls || []).find((c) => same(c.name_bn, r.class_name) || same(c.name_en, r.class_name))
    const notes = [r.note, !cl && r.class_name && `আবেদনের শ্রেণি: ${r.class_name}`, !dep && r.department && `আবেদনের বিভাগ: ${r.department}`].filter(Boolean).join('\n')
    const { error } = await supabase.from('students').insert({
      name_bn: nameOf(r), father_name: r.father_name, mother_name: r.mother_name, guardian_phone: phoneOf(r), address: r.address,
      department_id: dep?.id || null, class_id: cl?.id || null, application_id: r.id, note: notes || null, status: 'active',
    })
    if (error) return window.alert(`ভর্তি হয়নি: ${error.message}`)
    await supabase.from('admission_applications').update({ status: 'admitted' }).eq('id', r.id)
    load()
  }
  const shown = rows.filter((r) => !filter || r.status === filter)
  const phoneOf = (r) => r.phone || Object.values(r.data || {}).find((x) => x.type === 'phone')?.value
  const nameOf = (r) => r.student_name || Object.values(r.data || {})[0]?.value || '(নামহীন)'

  return (
    <>
      <h2>ভর্তির আবেদন</h2>
      <div className="toolbar">
        <Select value={filter} onChange={setFilter} placeholder={`সব অবস্থা (${rows.length})`} options={[['', `সব অবস্থা (${rows.length})`], ...Object.entries(STATUS).map(([k, l]) => [k, `${l} (${rows.filter((r) => r.status === k).length})`])]} />
      </div>
      <div className="stack">
        {shown.length === 0 && <div className="card muted">কোনো আবেদন নেই।</div>}
        {shown.map((r) => {
          const data = Object.entries(r.data || {})
          return (
            <div className="card" key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <div>
                  <b>{nameOf(r)}</b> <span className={`pill ${r.status === 'new' ? 'new' : ''}`}>{STATUS[r.status]}</span>
                  <div className="muted" style={{ fontSize: '.85rem' }}><Icon name="phone" size={14} /> {phoneOf(r) || '—'} · {r.department || '—'} · {fmt(r.created_at)}</div>
                </div>
                <Icon name={open === r.id ? 'chevup' : 'chevdown'} size={20} />
              </div>
              {open === r.id && (
                <div style={{ marginTop: 12 }}>
                  <div className="table-wrap">
                    <table><tbody>
                      {data.length ? data.map(([k, x]) => (
                        <tr key={k}>
                          <th>{x.label}</th>
                          <td>{x.type === 'file' ? <FileView path={x.value} /> : x.value}</td>
                        </tr>
                      )) : (
                        <>
                          <tr><th>পিতার নাম</th><td>{r.father_name || '—'}</td></tr>
                          <tr><th>মাতার নাম</th><td>{r.mother_name || '—'}</td></tr>
                          <tr><th>শ্রেণি</th><td>{r.class_name || '—'}</td></tr>
                          <tr><th>ঠিকানা</th><td>{r.address || '—'}</td></tr>
                          <tr><th>অতিরিক্ত তথ্য</th><td>{r.note || '—'}</td></tr>
                        </>
                      )}
                    </tbody></table>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ minWidth: 190 }}><Select value={r.status} onChange={(x) => setStatus(r, x)} options={Object.entries(STATUS)} /></div>
                    {r.status !== 'admitted' && <button className="btn small" onClick={() => admit(r)}><Icon name="check" size={15} cls="cur" /> ছাত্র হিসেবে ভর্তি করুন</button>}
                    {phoneOf(r) && <a className="btn small outline" href={`tel:${phoneOf(r)}`}><Icon name="phone" size={15} cls="cur" /> কল করুন</a>}
                    <button className="btn small danger" onClick={() => remove(r)}><Icon name="trash" size={15} cls="cur" /> মুছুন</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function Messages() {
  const [rows, setRows] = useState([])
  const confirm = useConfirm()
  const load = useCallback(async () => {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(r) {
    await supabase.from('contact_messages').update({ is_read: !r.is_read }).eq('id', r.id)
    load()
  }
  async function remove(r) {
    if (!(await confirm({ name: `${r.name} এর বার্তা`, text: 'বার্তাটি মুছে ফেলবেন?' }))) return
    await supabase.from('contact_messages').delete().eq('id', r.id)
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
            <div className="muted" style={{ fontSize: '.85rem' }}>{r.phone && <><Icon name="phone" size={14} /> {r.phone} · </>}{fmt(r.created_at)}</div>
            <p className="pre" style={{ margin: '8px 0' }}>{r.message}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn small outline" onClick={() => toggle(r)}>{r.is_read ? 'অপঠিত করুন' : 'পড়া হয়েছে'}</button>
              {r.phone && <a className="btn small outline" href={`tel:${r.phone}`}>কল করুন</a>}
              <button className="btn small danger" onClick={() => remove(r)}><Icon name="trash" size={15} cls="cur" /> মুছুন</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
