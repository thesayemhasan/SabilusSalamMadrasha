import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/store'
import { Select, useConfirm } from '../../components/Ui'

import { ROLES } from '../../lib/util'
export { ROLES }

export default function Users() {
  const confirm = useConfirm()
  const { isSuper, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function setRole(r, role) {
    if (role === r.role) return
    const id = r.id
    if (!(await confirm({ name: r.full_name || r.email, action: 'change', question: `এর ভূমিকা “${ROLES[role]}” করবেন?`, yes: 'হ্যাঁ, বদলান' }))) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    setMsg(error ? error.message : '')
    load()
  }

  return (
    <>
      <h2>ব্যবহারকারী ও অনুমতি</h2>
      <div className="alert info" style={{ marginBottom: 14 }}>
        কেউ ওয়েবসাইটে সাইন আপ করলে বা Supabase → Authentication → Users থেকে যোগ করলে এখানে দেখা যাবে। নতুন ব্যবহারকারী শুরুতে "কোনো অ্যাক্সেস নেই" অবস্থায় থাকে; আপনি ভূমিকা ঠিক করে দিলে তবেই সে অ্যাডমিন বা অন্য সুবিধা পাবে।
      </div>
      {!isSuper && <div className="alert warn" style={{ marginBottom: 14 }}>ভূমিকা বদলাতে পারেন শুধু সুপার অ্যাডমিন।</div>}
      {msg && <div className="alert err">{msg}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>নাম / ইমেইল</th><th>ভূমিকা</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.full_name || '—'}</b><div className="muted" style={{ fontSize: '.85rem' }}>{r.email}</div></td>
                <td>
                  <Select disabled={!isSuper || r.id === profile?.id} value={r.role} onChange={(x) => setRole(r, x)} options={Object.entries(ROLES)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>শিক্ষক, হিসাবরক্ষক ও অভিভাবকের নির্দিষ্ট পোর্টাল ও অনুমতি পরের ধাপগুলোতে যোগ হবে।</p>
    </>
  )
}
