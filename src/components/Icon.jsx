import { icon } from '../lib/icons'

// <Icon name="book" size={28} /> — নিজস্ব আইকন সেট। গাঢ় ব্যাকগ্রাউন্ডে cls="cur" দিন।
export default function Icon({ name, size = 24, cls = '', style }) {
  return <span className="icn" style={style} dangerouslySetInnerHTML={{ __html: icon(name, size, cls) }} />
}
