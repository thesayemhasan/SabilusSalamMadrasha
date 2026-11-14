import { Link, useNavigate } from 'react-router-dom'
import { useSite } from '../lib/store'
import Countdown from './Countdown'

const EXT = /^(https?:|mailto:|tel:)/i

// নোটিশ/ইভেন্টের ঐচ্ছিক বাটন: ফটোকার্ড (মডিউল চালু থাকলে) বা অন্য লিংক
export function useItemButton(n) {
  const { t, modules } = useSite()
  if (!n) return null
  if (n.button_kind === 'photocard' && modules.photocard === true) return { to: '/photocard', text: n.button_text || t('pc.title'), ext: false }
  const u = (n.button_url || '').trim()
  if (n.button_kind === 'link' && u) return { to: EXT.test(u) ? u : u.startsWith('/') ? u : `/${u}`, text: n.button_text || u, ext: EXT.test(u) }
  return null
}

// nested = যে কার্ডটি নিজেই লিংক (হোমের ইভেন্ট কার্ড), তার ভেতরে লিংকের ভেতর লিংক এড়াতে বোতাম
export default function ItemButton({ n, nested = false }) {
  const b = useItemButton(n)
  const nav = useNavigate()
  if (!b) return null
  if (nested || b.ext) {
    const go = (e) => { e.preventDefault(); e.stopPropagation(); if (b.ext) window.open(b.to, '_blank', 'noopener'); else nav(b.to) }
    return <button type="button" className="btn small" onClick={go}>{b.text}</button>
  }
  return <Link className="btn small" to={b.to}>{b.text}</Link>
}

// টাইমারের পাশে (বা নিচে) ঐচ্ছিক বাটন; বাটন না থাকলে আগের মতোই শুধু টাইমার
export function EventRow({ e, nested = false }) {
  const has = Boolean(useItemButton(e))
  const timer = <Countdown date={e.event_date} start={e.start_at} end={e.end_at} showStart={e.show_start_timer} showEnd={e.show_end_timer} />
  if (!has) return timer
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>{timer}<ItemButton n={e} nested={nested} /></div>
}
