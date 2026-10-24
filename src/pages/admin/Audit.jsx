import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Select } from '../../components/Ui'

const T = { payments: 'আদায়', ledger: 'আয়/ব্যয়', staff_advances: 'অগ্রিম', salary_payments: 'বেতন', invoices: 'বিল' }
const A = { INSERT: 'যোগ', UPDATE: 'পরিবর্তন' }
export default function Audit() {
  const [rows, setRows] = useState([])
  const [t, setT] = useState('')
  const [people, setPeople] = useState({})
  useEffect(() => {
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300).then(({ data }) => setRows(data || []))
    supabase.from('profiles').select('id,email,full_name').then(({ data }) => setPeople(Object.fromEntries((data || []).map((p) => [p.id, p.full_name || p.email]))))
  }, [])
  const shown = rows.filter((r) => !t || r.table_name === t)
  const sum = (r) => { const d = r.data || {}; return [d.receipt_no, d.category_name, d.title, d.period, d.amount != null ? `৳${d.amount}` : d.net != null ? `৳${d.net}` : '', d.void ? `বাতিল: ${d.void_reason || ''}` : ''].filter(Boolean).join(' · ') }
  return (
    <>
      <h2>আর্থিক লগ</h2>
      <p className="muted">আদায়, বিল, আয়-ব্যয়, অগ্রিম ও বেতনের প্রতিটি যোগ ও পরিবর্তন এখানে নিজে থেকে জমা হয়। এটি মোছা বা বদলানো যায় না। সর্বশেষ ৩০০টি দেখাচ্ছে।</p>
      <div className="toolbar"><div style={{ minWidth: 200 }}><Select value={t} onChange={setT} options={[['', 'সব ধরন'], ...Object.entries(T)]} /></div></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>সময়</th><th>কে</th><th>ধরন</th><th>কাজ</th><th>বিবরণ</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan="5" className="muted">কোনো লগ নেই।</td></tr>}
            {shown.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString('bn-BD')}</td><td>{people[r.who] || (r.who ? String(r.who).slice(0, 8) : '—')}</td><td>{T[r.table_name] || r.table_name}</td><td>{A[r.action] || r.action}</td><td style={{ fontSize: '.88rem' }}>{sum(r)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  )
}
