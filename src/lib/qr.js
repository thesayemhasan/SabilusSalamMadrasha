// ছোট্ট QR কোড তৈরির মডিউল (বাইট মোড, ত্রুটি-সংশোধন স্তর M, ভার্সন ১–১০)। বাইরের লাইব্রেরি লাগে না।
// অ্যালগরিদম: ISO/IEC 18004 অনুযায়ী (Reed–Solomon, মাস্ক, ফরম্যাট ও ভার্সন বিট)।

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]

const rawModules = (ver) => {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) { const na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36 }
  return r
}
const dataCodewords = (ver) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]

function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x } return z }
function rsDivisor(deg) {
  const r = Array(deg).fill(0); r[deg - 1] = 1
  let root = 1
  for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1] } root = gfMul(root, 2) }
  return r
}
function rsRemainder(data, div) {
  const r = Array(div.length).fill(0)
  data.forEach((b) => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f) }) })
  return r
}
const bit = (x, i) => ((x >>> i) & 1) !== 0

export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)))
  let ver = 1
  for (; ver <= 10; ver++) { const cc = ver < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(ver) * 8) break }
  if (ver > 10) throw new Error('QR-এর লেখা বেশি লম্বা')
  const bits = []
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1) }
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8))
  const cap = dataCodewords(ver) * 8
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))

  // ত্রুটি-সংশোধন কোড ও ইন্টারলিভ
  const nb = NUM_BLOCKS[ver]; const eccLen = ECC_PER_BLOCK[ver]
  const raw = Math.floor(rawModules(ver) / 8); const shortN = nb - (raw % nb); const shortLen = Math.floor(raw / nb)
  const div = rsDivisor(eccLen); const blocks = []
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortN ? 0 : 1)); k += dat.length
    const ecc = rsRemainder(dat, div)
    if (i < shortN) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const all = []
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= shortN) all.push(b[i]) })

  const size = ver * 4 + 17
  const mod = Array.from({ length: size }, () => Array(size).fill(false))
  const fn = Array.from({ length: size }, () => Array(size).fill(false))
  const setF = (x, y, d) => { mod[y][x] = d; fn[y][x] = true }
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0) }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); const x = cx + dx; const y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4) } }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  const pos = []
  if (ver > 1) { const na = Math.floor(ver / 7) + 2; const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2; pos.push(6); for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p) }
  pos.forEach((px, i) => pos.forEach((py, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))
  const formatBits = (mask) => {
    const d = (0 << 3) | mask // স্তর M = ০
    let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const b = ((d << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i))
    setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i))
    setF(8, size - 8, true)
  }
  formatBits(0)
  if (ver >= 7) {
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const b = (ver << 12) | rem
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3); const c = Math.floor(i / 3); setF(a, c, bit(b, i)); setF(c, a, bit(b, i)) }
  }
  // ডেটা বসানো (জিগজ্যাগ)
  let k = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j; const up = ((right + 1) & 2) === 0; const y = up ? size - 1 - vert : vert
      if (!fn[y][x] && k < all.length * 8) { mod[y][x] = bit(all[k >>> 3], 7 - (k & 7)); k++ }
    }
  }
  const inv = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0, (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0]
  const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && inv[m](x, y)) mod[y][x] = !mod[y][x] }
  const penalty = () => {
    let p = 0
    const run = (get) => { for (let a = 0; a < size; a++) { let n = 1; for (let b = 1; b < size; b++) { if (get(a, b) === get(a, b - 1)) { n++; if (n === 5) p += 3; else if (n > 5) p += 1 } else n = 1 } } }
    run((a, b) => mod[a][b]); run((a, b) => mod[b][a])
    const dark = mod.flat().filter(Boolean).length; const tot = size * size
    p += (Math.ceil(Math.abs(dark * 20 - tot * 10) / tot) - 1) * 10
    return p
  }
  let best = 0; let bestP = Infinity
  for (let m = 0; m < 8; m++) { applyMask(m); formatBits(m); const p = penalty(); if (p < bestP) { best = m; bestP = p } applyMask(m) }
  applyMask(best); formatBits(best)
  return mod
}
