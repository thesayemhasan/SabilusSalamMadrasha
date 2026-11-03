// ফলাফল সরাসরি PDF হিসেবে নামানো: ক্যানভাসে এঁকে (ব্রাউজার বাংলা যুক্তাক্ষর ঠিকভাবে বসায়) JPEG বানিয়ে ছোট্ট PDF-এ মুড়ে দেওয়া হয়। কোনো বাড়তি লাইব্রেরি লাগে না।
const FONT = '"Noto Serif Bengali", serif'

function wrap(ctx, text, max) {
  const words = String(text).split(' '); const lines = []; let cur = ''
  words.forEach((w) => { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w } else cur = t })
  if (cur) lines.push(cur)
  return lines
}

// d = { title, rows:[[label,value]...], head:[a,b,c], table:[[name,full,marks,red]...], boxes:[[label,value]...] }
export async function resultCanvas(d) {
  try { await document.fonts.load(`700 28px ${FONT}`); await document.fonts.load(`400 28px ${FONT}`) } catch (e) { /* ignore */ }
  const W = 1240; const P = 80
  const mk = (h) => { const c = document.createElement('canvas'); c.width = W; c.height = h; return c }
  const draw = (ctx, dry) => {
    let y = 110
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#0b2a6b'; ctx.font = `700 46px ${FONT}`; ctx.textAlign = 'center'
    wrap(ctx, d.title, W - 2 * P).forEach((l) => { ctx.fillText(l, W / 2, y); y += 62 })
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(P, y - 20); ctx.lineTo(W - P, y - 20); ctx.stroke()
    y += 30
    ctx.textAlign = 'left'
    d.rows.forEach(([a, b]) => {
      ctx.font = `400 30px ${FONT}`; ctx.fillStyle = '#555'; ctx.fillText(`${a}:`, P, y)
      ctx.font = `700 32px ${FONT}`; ctx.fillStyle = '#111'; ctx.fillText(b, P + 300, y); y += 52
    })
    y += 20
    const cx = [P, P + 620, P + 840]; const rh = 64
    ctx.fillStyle = '#eef2f5'; ctx.fillRect(P, y, W - 2 * P, rh)
    ctx.fillStyle = '#111'; ctx.font = `700 29px ${FONT}`
    d.head.forEach((h, i) => { ctx.textAlign = i ? 'right' : 'left'; ctx.fillText(h, i ? (i === 1 ? P + 780 : W - P - 20) : P + 20, y + 42) })
    y += rh
    d.table.forEach(([n, f, m, red]) => {
      ctx.strokeStyle = '#d6dde3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P, y + rh); ctx.lineTo(W - P, y + rh); ctx.stroke()
      ctx.font = `400 30px ${FONT}`; ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.fillText(n, P + 20, y + 42)
      ctx.textAlign = 'right'; ctx.fillText(f, P + 780, y + 42)
      ctx.fillStyle = red ? '#c0262d' : '#111'; ctx.font = `${red ? 700 : 400} 30px ${FONT}`; ctx.fillText(m, W - P - 20, y + 42)
      y += rh
    })
    y += 40
    const bw = (W - 2 * P - 30) / 2
    d.boxes.forEach(([a, b], i) => {
      const bx = P + (i % 2) * (bw + 30); const by = y + Math.floor(i / 2) * 120
      ctx.strokeStyle = '#cfd8df'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 100)
      ctx.textAlign = 'left'; ctx.fillStyle = '#555'; ctx.font = `400 26px ${FONT}`; ctx.fillText(a, bx + 20, by + 38)
      ctx.fillStyle = '#111'; ctx.font = `700 34px ${FONT}`; ctx.fillText(b, bx + 20, by + 80)
    })
    y += Math.ceil(d.boxes.length / 2) * 120
    return y
  }
  const probe = mk(10).getContext('2d')
  const h = Math.max(1754, draw(probe, true) + 80)
  const c = mk(h); const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, h)
  draw(ctx, false)
  return c
}

export async function canvasToPdf(canvas) {
  const jpg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
  const img = new Uint8Array(await jpg.arrayBuffer())
  const pw = 595; const ph = Math.round((595 * canvas.height) / canvas.width)
  const enc = new TextEncoder(); const parts = []; const offs = []; let len = 0
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length }
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); push(body); push('\nendobj\n') }
  push('%PDF-1.4\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)
  offs[4] = len; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`); push(img); push('\nendstream\nendobj\n')
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  const xref = len
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offs[n]).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob(parts, { type: 'application/pdf' })
}
