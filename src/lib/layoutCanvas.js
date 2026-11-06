// ডিজাইনার-নকশা (লেআউট) ক্যানভাসে এঁকে ছবি/PDF বানানো — অভিভাবকের PDF ডাউনলোডের জন্য।
// অবস্থান ও মাপ ডিজাইনারের মতোই (মিমি)।
import { PT, tableCols, tableGeom } from './layout'
import { qrMatrix } from './qr'

const FONT = '"Noto Serif Bengali", serif'
const DPI = 150
export const PPM = DPI / 25.4

function loadImg(url) {
  return new Promise((res) => {
    if (!url) return res(null)
    const im = new Image(); im.crossOrigin = 'anonymous'
    const to = setTimeout(() => res(null), 8000)
    im.onload = () => { clearTimeout(to); res(im) }
    im.onerror = () => { clearTimeout(to); res(null) }
    im.src = url
  })
}

function wrapLines(ctx, text, max) {
  const out = []
  String(text).split('\n').forEach((para) => {
    const words = para.split(' '); let cur = ''
    words.forEach((w) => { const t = cur ? `${cur} ${w}` : w; if (cur && ctx.measureText(t).width > max) { out.push(cur); cur = w } else cur = t })
    out.push(cur)
  })
  return out
}

function drawImg(ctx, im, x, y, w, h, cover) {
  if (!im) return
  const r = Math.min(w / im.width, h / im.height); const rc = Math.max(w / im.width, h / im.height)
  const k = cover ? rc : r; const dw = im.width * k; const dh = im.height * k
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore()
}

export async function layoutCanvas(layout, side, data) {
  try { await document.fonts.load(`700 20px ${FONT}`); await document.fonts.load(`400 20px ${FONT}`) } catch (e) { /* ignore */ }
  const S = layout.sides[side] || { els: [] }
  const els = S.els || []
  const urls = new Set([S.bg_url])
  els.forEach((el) => { if (el.kind === 'image') urls.add(el.src); else if (el.kind === 'field' && (el.key === 'photo' || el.key === 'logo')) urls.add(data[el.key]) })
  const imgs = {}
  await Promise.all([...urls].filter(Boolean).map(async (u) => { imgs[u] = await loadImg(u) }))
  const W = Math.round(layout.size.w * PPM); const H = Math.round(layout.size.h * PPM)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)
  if (S.bg_url && imgs[S.bg_url]) ctx.drawImage(imgs[S.bg_url], 0, 0, W, H)
  const m = (v) => v * PPM
  els.forEach((el) => {
    const x = m(el.x); const y = m(el.y); const w = m(el.w); const h = m(el.h)
    if (el.kind === 'box') {
      if (el.fill) { ctx.fillStyle = el.fill; ctx.fillRect(x, y, w, h) }
      if (el.border) { const b = Math.max(1, m(el.border)); ctx.strokeStyle = el.color || '#000'; ctx.lineWidth = b; ctx.strokeRect(x + b / 2, y + b / 2, w - b, h - b) }
      return
    }
    if (el.kind === 'image' || (el.kind === 'field' && (el.key === 'photo' || el.key === 'logo'))) {
      const src = el.kind === 'image' ? el.src : data[el.key]
      drawImg(ctx, imgs[src], x, y, w, h, !(el.key === 'logo' || el.kind === 'image'))
      if (el.border) { ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, m(0.3)); ctx.strokeRect(x, y, w, h) }
      return
    }
    if (el.kind === 'field' && el.key === 'verify_qr') {
      let mx = null
      try { mx = data.verify_url ? qrMatrix(data.verify_url) : null } catch (e) { mx = null }
      if (!mx) return
      const n = mx.length + 4; const cell = Math.min(w, h) / n
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#000'
      mx.forEach((row, yy) => row.forEach((v, xx) => { if (v) ctx.fillRect(Math.floor(x + (xx + 2) * cell), Math.floor(y + (yy + 2) * cell), Math.ceil(cell), Math.ceil(cell)) }))
      return
    }
    if (el.kind === 'field' && el.key === 'marks_table') {
      const tb = data.marks_table; if (!tb) return
      const wp = !!el.passcol; const { rowH, fr } = tableGeom(el, wp); const cols = tableCols(tb, wp)
      const rh = m(rowH); let cy = y; const fsz = m((el.size || 10) * PT)
      const row = (vals, o = {}) => {
        let cx = x
        vals.forEach((v, i) => {
          const cw = w * fr[i]
          if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(cx, cy, cw, rh) }
          ctx.strokeStyle = '#8a949b'; ctx.lineWidth = Math.max(1, m(0.2)); ctx.strokeRect(cx, cy, cw, rh)
          ctx.font = `${o.bold || (o.redIdx === i) ? 700 : 400} ${fsz}px ${FONT}`; ctx.fillStyle = o.redIdx === i ? '#c0262d' : '#000'; ctx.textBaseline = 'middle'
          ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, rh); ctx.clip()
          if (i === 1) { ctx.textAlign = 'left'; ctx.fillText(String(v), cx + m(1.2), cy + rh / 2) } else { ctx.textAlign = 'center'; ctx.fillText(String(v), cx + cw / 2, cy + rh / 2) }
          ctx.restore(); cx += cw
        })
        cy += rh
      }
      row(cols.head, { bold: true, bg: el.fill || '#e8f5ec' })
      cols.rows.forEach((r) => row(r.slice(0, -1), { redIdx: r[r.length - 1] ? r.length - 2 : -1 }))
      if (cols.foot) row(cols.foot, { bold: true, bg: '#f4f6f7' })
      return
    }
    const val = el.kind === 'text' ? el.text : data[el.key]
    const has = el.kind === 'text' || (val !== undefined && val !== null && String(val) !== '')
    const text = el.kind === 'text' ? el.text : `${has ? el.prefix || '' : el.underline ? el.prefix || '' : ''}${has ? val : ''}`
    const fsz = m((el.size || 9) * PT)
    ctx.font = `${el.bold ? 700 : 400} ${fsz}px ${FONT}`; ctx.fillStyle = el.color || '#000'; ctx.textBaseline = 'middle'; ctx.textAlign = el.align || 'left'
    const lh = m(el.lh || (el.size || 9) * PT * 1.3)
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    const lines = el.multi || el.kind === 'text' ? wrapLines(ctx, text, w) : [text]
    const ax = el.align === 'center' ? x + w / 2 : el.align === 'right' ? x + w : x
    lines.forEach((ln, i) => ctx.fillText(ln, ax, y + lh * i + lh / 2))
    ctx.restore()
    if (el.underline) { ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, m(0.25)); ctx.setLineDash([m(0.5), m(0.5)]); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke(); ctx.restore() }
  })
  return c
}
