import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import { MODULES, BUILT } from '../../lib/modules'
import Icon from '../../components/Icon'

export default function Dashboard() {
  const { modules } = useSite()
  const [c, setC] = useState({})
  useEffect(() => {
    const count = (t, f) => {
      let q = supabase.from(t).select('*', { count: 'exact', head: true })
      if (f) q = f(q)
      return q.then((r) => r.count ?? 0)
    }
    Promise.all([
      count('admission_applications', (q) => q.eq('status', 'new')),
      count('contact_messages', (q) => q.eq('is_read', false)),
      count('notices'),
      count('events'),
    ]).then(([apps, msgs, notices, events]) => setC({ apps, msgs, notices, events }))
  }, [])

  const enabled = MODULES.filter((m) => (BUILT.has(m.key) ? modules[m.key] !== false : modules[m.key])).length
  const tiles = [
    ['নতুন আবেদন', c.apps, '/admin/applications'],
    ['অপঠিত বার্তা', c.msgs, '/admin/messages'],
    ['নোটিশ', c.notices, '/admin/notices'],
    ['ইভেন্ট', c.events, '/admin/events'],
  ]

  return (
    <>
      <h2>ড্যাশবোর্ড</h2>
      <div className="quick">
        {[['megaphone', 'নতুন নোটিশ', '/admin/notices'], ['calendar', 'নতুন ইভেন্ট', '/admin/events'], ['image', 'হোম স্লাইড', '/admin/slides'], ['building', 'হোমে নতুন রো', '/admin/home-blocks'], ['apply', 'ভর্তি ফরম', '/admin/admission-form'], ['edit', 'লেখা বদলান', '/admin/texts'], ['gear', 'সেটিংস', '/admin/settings']].map(([ic, label, to]) => (
          <Link to={to} key={to}><span className="big"><Icon name={ic} size={34} /></span>{label}</Link>
        ))}
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {tiles.map(([label, n, to]) => (
          <Link to={to} className="card stat" key={label}>
            <b>{n ?? '…'}</b>
            <span className="muted">{label}</span>
          </Link>
        ))}
      </div>
      <div className="card">
        <h3>সিস্টেমের অবস্থা</h3>
        <p>ধাপ ১ চালু: পাবলিক ওয়েবসাইট, অ্যাডমিন লগইন, লেখা ও ছবি সম্পাদনা, ভর্তির আবেদন, মডিউল সুইচ।</p>
        <p className="muted" style={{ margin: 0 }}>
          চালু মডিউল: {enabled} / {MODULES.length}। বাকি মডিউল (ছাত্র, হাজিরা, হিসাব, পরীক্ষা, হিফজ ইত্যাদি) পরের ধাপগুলোতে যোগ হবে।
        </p>
      </div>
    </>
  )
}
