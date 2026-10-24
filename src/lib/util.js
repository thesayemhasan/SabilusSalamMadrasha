const LOCALE = { bn: 'bn-BD', en: 'en-GB' }
export const fmtDate = (d, lang) => {
  if (!d) return ''
  const dt = d.length <= 10 ? new Date(d + 'T00:00:00') : new Date(d)
  return dt.toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
export const fmtDateTime = (d, lang) =>
  d ? new Date(d).toLocaleString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
export const dig = (n, l) => (l === 'bn' ? String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(n))

// ইউটিউব লিংক থেকে ভিডিও আইডি
export function youtubeId(url = '') {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
}

// সোশ্যাল মিডিয়ার ধরন
export const SOCIAL_TYPES = [
  ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'],
  ['telegram', 'Telegram'], ['linkedin', 'LinkedIn'], ['x', 'X (Twitter)'], ['tiktok', 'TikTok'],
  ['mail', 'ইমেইল'], ['phone', 'ফোন'], ['globe', 'ওয়েবসাইট'],
]
export function socialHref(type, url = '') {
  const u = String(url).trim()
  if (!u) return ''
  if (type === 'whatsapp' && !/^https?:/i.test(u)) return `https://wa.me/${u.replace(/\D/g, '')}`
  if (type === 'mail' && !/^mailto:/i.test(u)) return `mailto:${u}`
  if (type === 'phone' && !/^tel:/i.test(u)) return `tel:${u}`
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u
  return `https://${u}`
}

// ডিফল্ট মেনু; অ্যাডমিন সেটিংস থেকে বদলানো যায়
export const DEFAULT_MENU = [
  { to: '/', key: 'nav.home', show: true },
  { to: '/about', key: 'nav.about', show: true },
  { to: '/departments', key: 'nav.departments', show: true },
  { to: '/admission', key: 'nav.admission', show: true },
  { to: '/notices', key: 'nav.notices', show: true },
  { to: '/events', key: 'nav.events', show: true },
  { to: '/gallery', key: 'nav.gallery', show: true },
  { to: '/teachers', key: 'nav.teachers', show: true },
  { to: '/donate', key: 'nav.donate', show: true },
  { to: '/contact', key: 'nav.contact', show: true },
]
export const menuOf = (settings) => (Array.isArray(settings.menu) && settings.menu.length ? settings.menu : DEFAULT_MENU)
export const isExternal = (to = '') => /^(https?:|mailto:|tel:)/i.test(to)

export const ROLES = {
  none: 'কোনো অ্যাক্সেস নেই',
  super_admin: 'সুপার অ্যাডমিন',
  admin: 'অ্যাডমিন',
  accountant: 'হিসাবরক্ষক',
  teacher: 'শিক্ষক',
  parent: 'অভিভাবক',
}
