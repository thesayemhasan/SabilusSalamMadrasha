import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/store'

export const ROLES = {
  none: 'কোনো অ্যাক্সেস নেই',
  super_admin: 'সুপার অ্যাডমিন',
  admin: 'অ্যাডমিন',
  accountant: 'হিসাবরক্ষক',
  teacher: 'শিক্ষক',
  parent: 'অভিভাবক',
}

export default function Users() {
  const { isSuper, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function setRole(id, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    setMsg(error ? error.message : '')
    load()
  }

  return (
    <>
      <h2>ব্যবহারকারী ও অনুমতি</h2>
      <div className="alert info" style={{ marginBottom: 14 }}>
        নতুন ব্যবহারকারী যোগ করতে Supabase → Authentication → Users → Add user এ ইমেইল ও পাসওয়ার্ড দিয়ে তৈরি করুন। তৈরি হলে এখানে দেখা যাবে, তখন তার ভূমিকা ঠিক করে দিন। নতুন ব্যবহারকারী শুরুতে "কোনো অ্যাক্সেস নেই" অবস্থায় থাকে।
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
                  <select disabled={!isSuper || r.id === profile?.id} value={r.role} onChange={(e) => setRole(r.id, e.target.value)}>
                    {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
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
