import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/store'
import { Select } from '../../components/Ui'
import Icon from '../../components/Icon'
import Crud from './Crud'
import { nm } from './fin'
import { ROLE_LABEL } from '../../lib/features'
import { useClassList } from './Exams'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')

export function useBranches() {
  const [list, setList] = useState([])
  useEffect(() => { supabase.from('branches').select('*').order('sort').order('name_bn').then(({ data }) => setList(data || [])) }, [])
  return list
}

// হেডারে চলতি শাখা: শাখা-সীমিত কর্মী শুধু নিজের শাখার নাম দেখেন; সীমাহীন ব্যবহারকারী বদলাতে পারেন
export function BranchPick() {
  const { profile } = useAuth()
  const list = useBranches()
  if (list.length < 2 && !profile?.branch_id) return null
  const fixed = profile?.branch_id
  const cur = fixed || profile?.active_branch_id || ''
  async function change(v) {
    const { error } = await supabase.rpc('set_active_branch', { p_branch: v || null })
    if (error) return window.alert(error.message)
    window.location.reload()
  }
  if (fixed) return <span className="yr-pick" title="আপনার শাখা"><Icon name="building" size={16} cls="cur" /> {nm(list.find((b) => b.id === fixed)) || ''}</span>
  return (
    <label className="yr-pick" title="শাখা">
      <Icon name="building" size={16} cls="cur" />
      <select value={cur} onChange={(e) => change(e.target.value)} aria-label="শাখা">
        <option value="">সব শাখা</option>
        {list.map((b) => <option key={b.id} value={b.id}>{b.name_bn || b.name_en}</option>)}
      </select>
    </label>
  )
}

function UsersTab({ branches }) {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id,full_name,email,role,branch_id').in('role', ['super_admin', 'admin', 'accountant', 'staff', 'teacher']).order('full_name')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  async function set(r, v) {
    setMsg('')
    const { error } = await supabase.rpc('admin_set_user_branch', { p_user: r.id, p_branch: v || null })
    if (error) return setMsg(`হয়নি: ${error.message}`)
    setRows((a) => a.map((x) => (x.id === r.id ? { ...x, branch_id: v || null } : x)))
  }
  return (
    <>
      <p className="muted" style={{ marginTop: -6 }}>কর্মীকে একটি শাখা দিলে সে শুধু ওই শাখার শিক্ষার্থী, শিক্ষক, শ্রেণি, ফি ও হিসাব দেখবে ও লিখবে। "সব শাখা" রাখলে সীমা থাকে না, আর হেডার থেকে শাখা বদলে দেখা যায়।</p>
      {msg && <div className="alert err" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="table-wrap"><table>
        <thead><tr><th>নাম</th><th>ইমেইল</th><th>ভূমিকা</th><th>শাখা</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.full_name}</td><td>{r.email}</td><td>{ROLE_LABEL[r.role] || r.role}</td>
              <td style={{ minWidth: 190 }}><Select value={r.branch_id || ''} onChange={(v) => set(r, v)} options={[['', 'সব শাখা'], ...branches.map((b) => [b.id, nm(b)])]} /></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="muted">কোনো ব্যবহারকারী নেই</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

function MoveTab({ branches }) {
  const classes = useClassList()
  const [cls, setCls] = useState('')
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!cls || !to) return
    if (!window.confirm('এই শ্রেণি ও এর সব শিক্ষার্থী (বিল ও রসিদসহ) নির্বাচিত শাখায় সরাতে চান?')) return
    setBusy(true); setMsg('')
    const { data, error } = await supabase.rpc('move_class_to_branch', { p_class: cls, p_branch: to })
    setBusy(false)
    setMsg(error ? `হয়নি: ${error.message}` : `সরানো হয়েছে। ${bn(data)} জন শিক্ষার্থী নতুন শাখায় গেছে।`)
  }
  return (
    <div className="card form">
      <p className="muted" style={{ marginTop: 0 }}>একটি শ্রেণি ও তার সব শিক্ষার্থীকে (তাদের বিল ও রসিদসহ) অন্য শাখায় সরান। চলতি শাখা "সব শাখা" থাকলে সব শ্রেণি এখানে দেখা যায়। শুধু সুপার অ্যাডমিন করতে পারেন।</p>
      <div className="grid g2">
        <div className="field"><label>শ্রেণি</label><Select value={cls} onChange={setCls} options={classes.map((c) => [c.id, nm(c)])} placeholder="শ্রেণি বাছুন" /></div>
        <div className="field"><label>নতুন শাখা</label><Select value={to} onChange={setTo} options={branches.map((b) => [b.id, nm(b)])} placeholder="শাখা বাছুন" /></div>
      </div>
      {msg && <div className={`alert ${/হয়নি/.test(msg) ? 'err' : 'ok'}`} style={{ marginBottom: 10 }}>{msg}</div>}
      <button className="btn" disabled={busy || !cls || !to} onClick={go}>সরান</button>
    </div>
  )
}

export default function Branches() {
  const branches = useBranches()
  const [tab, setTab] = useState('list')
  return (
    <>
      <h2>শাখা</h2>
      <div className="tabs">
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>শাখার তালিকা</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>কর্মীর শাখা</button>
        <button className={tab === 'move' ? 'on' : ''} onClick={() => setTab('move')}>শ্রেণি সরান</button>
      </div>
      {tab === 'list' && (
        <Crud
          table="branches"
          title="শাখা"
          hint="প্রথম শাখাটি আপনার বর্তমান সব তথ্য ধারণ করে (নাম বদলে নিন, যেমন 'ছাত্র শাখা')। নতুন শাখা যোগ করলে সেখানে নতুন শ্রেণি, শিক্ষার্থী ও কর্মী যোগ হবে। শাখায় তথ্য থাকলে সেটি মোছা যায় না।"
          order="sort"
          asc
          toggle={null}
          nameOf={(r) => nm(r)}
          blank={{ sort: 0 }}
          fields={[
            { name: 'name', label: 'শাখার নাম', i18n: true, required: true },
            { name: 'code', label: 'সংক্ষিপ্ত কোড (ঐচ্ছিক)' },
            { name: 'address', label: 'ঠিকানা' },
            { name: 'phone', label: 'ফোন' },
            { name: 'sort', label: 'ক্রম', type: 'number' },
          ]}
          summary={(r) => (<><b>{nm(r)}</b>{r.is_default && <span className="tag">মূল</span>}<div className="muted" style={{ fontSize: '.85rem' }}>{[r.code, r.address, r.phone].filter(Boolean).join(' · ')}</div></>)}
        />
      )}
      {tab === 'users' && <UsersTab branches={branches} />}
      {tab === 'move' && <MoveTab branches={branches} />}
    </>
  )
}
