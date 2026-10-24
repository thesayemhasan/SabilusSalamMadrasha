// অ্যানিমেশন সহায়ক: স্ক্রলে ধীরে ধীরে আসা, সংখ্যা গোনা, ছবির স্লাইডার, হেডার ছোট হওয়া
// (React অ্যাপ ও প্রিভিউ, দুই জায়গাতেই একই কোড চলে)
const D_BN = '০১২৩৪৫৬৭৮৯'
const D_AR = '٠١٢٣٤٥٦٧٨٩'
const SEL = '.card, .list-item, .gallery figure, .page-head h1, .sec-title, .stat-item, .quick-link, .table-wrap, .apply-bar, .urgent, .split-img, .split-tx, .map, .stats, .seg, .cd'

function runCount(el, instant) {
  const text = el.textContent
  const m = text.match(/[0-9০-৯٠-٩]+/)
  if (!m || instant) return
  const raw = m[0]
  const script = /[০-৯]/.test(raw) ? D_BN : /[٠-٩]/.test(raw) ? D_AR : null
  const num = parseInt([...raw].map((c) => { const i = D_BN.indexOf(c); const j = D_AR.indexOf(c); return i >= 0 ? i : j >= 0 ? j : c }).join(''), 10)
  if (isNaN(num)) return
  const pre = text.slice(0, m.index)
  const post = text.slice(m.index + raw.length)
  const fmt = (n) => { let s = String(n); if (script) s = [...s].map((d) => script[d]).join(''); return pre + s + post }
  const t0 = performance.now()
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 1400)
    el.textContent = fmt(Math.round(num * (1 - Math.pow(1 - p, 3))))
    if (p < 1) requestAnimationFrame(step)
  }
  el.textContent = fmt(0)
  requestAnimationFrame(step)
}

export function initFx() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('in')
          io.unobserve(e.target)
          if (e.target.classList.contains('count')) runCount(e.target)
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null

  const prep = (el) => {
    if (el.__fx) return
    el.__fx = 1
    if (el.closest('.adm, .modal')) { el.classList.add('in'); return }
    const isCount = el.classList.contains('count')
    if (reduce || !io || window.__still) { el.classList.add('in'); return }
    if (!isCount) {
      el.classList.add('reveal')
      const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.__fx || c.matches(SEL)) : []
      el.style.setProperty('--d', Math.min(sibs.indexOf(el), 6) * 0.08 + 's')
    }
    io.observe(el)
  }
  const MATCH = SEL + ', .count'
  const scan = (root) => {
    if (!root.querySelectorAll) return
    root.querySelectorAll(MATCH).forEach(prep)
  }
  scan(document)
  const mo = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return
    if (n.matches && n.matches(MATCH)) prep(n)
    scan(n)
  })))
  mo.observe(document.body, { childList: true, subtree: true })

  const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 40)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  return () => { io && io.disconnect(); mo.disconnect(); window.removeEventListener('scroll', onScroll) }
}
