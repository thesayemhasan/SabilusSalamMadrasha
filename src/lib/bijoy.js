// পুরনো বাংলা ফন্ট (SutonnyMJ / বিজয় ANSI) এ টাইপ করা লেখাকে ইউনিকোডে বদলায়।
// এক্সেলে এই ফন্টে লিখলে ঘরে আসলে ইংরেজি অক্ষরের জট থাকে (যেমন gygZvR = মুমতাজ)।
const MAP = {
  A: 'অ', B: 'ই', C: 'ঈ', D: 'উ', E: 'ঊ', F: 'ঋ', G: 'এ', H: 'ঐ', I: 'ও', J: 'ঔ',
  K: 'ক', L: 'খ', M: 'গ', N: 'ঘ', O: 'ঙ', P: 'চ', Q: 'ছ', R: 'জ', S: 'ঝ', T: 'ঞ', U: 'ট', V: 'ঠ', W: 'ড', X: 'ঢ', Y: 'ণ',
  Z: 'ত', _: 'থ', '`': 'দ', a: 'ধ', b: 'ন', c: 'প', d: 'ফ', e: 'ব', f: 'ভ', g: 'ম', h: 'য', i: 'র', j: 'ল', k: 'শ', l: 'ষ', m: 'স', n: 'হ',
  o: '\u09DC', p: '\u09DD', q: '\u09DF', r: 'ৎ', s: 'ং', t: 'ঃ', u: 'ঁ',
  v: 'া', w: 'ি', x: 'ী', y: 'ু', z: 'ু', '~': 'ূ', '‡': 'ে', '†': 'ে', 'ˆ': 'ৈ', '‰': 'ৈ', 'Š': 'ৗ',
  '¨': '্য', 'ª': '্র', '©': '\u0001', '¦': '্ব', '¬': '্ল', '¯': 'স্', 'Ï': 'দ্দ', '|': '।',
}
const CONS = 'কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ\u09DC\u09DD\u09DFৎ'
const isCons = (c) => c && CONS.includes(c)
const PREFIX = new Set(['ি', 'ে', 'ৈ'])

export function hasBengali(s) { return /[ঀ-৿]/.test(s) }
// ইংরেজি গ্রেড/শব্দ হলে বদলানো হবে না
const ENGLISH_OK = /^(a\+?|a-|b\+?|b|c|d|f|gpa.*|first|second|third|pass|fail|distinction|merit|passed|failed|[a-z]{0,3}\d.*|\d+)$/i
export function looksBijoy(s) {
  const t = String(s ?? '').trim()
  if (!t || hasBengali(t) || ENGLISH_OK.test(t)) return false
  return /[A-Za-z_`~‡†ˆ‰Š¨ªÏ©¦¬¯]/.test(t)
}

export function bijoyToUnicode(src) {
  let s = String(src).replace(/Av/g, 'আ')
  let chars = []
  for (const ch of s) chars.push(MAP[ch] !== undefined ? MAP[ch] : ch)
  // ক্লাস্টার ধরে প্রিফিক্স কার (ি ে ৈ) ও রেফ সরানো
  const flat = chars.join('').split('')
  const out = []
  let i = 0
  const readCluster = (j) => {
    // ব্যঞ্জন ( ্ ব্যঞ্জন )* এবং যুক্ত ফলা (্য ্র ্ব ্ল)
    let k = j + 1
    for (;;) {
      if (flat[k] === '্' && (isCons(flat[k + 1]) )) k += 2
      else if (flat[k] === '্' ) k += 2 // ফলা (্য ্র ...)
      else break
    }
    return k
  }
  while (i < flat.length) {
    const c = flat[i]
    if (PREFIX.has(c) && isCons(flat[i + 1])) {
      const e = readCluster(i + 1)
      out.push(...flat.slice(i + 1, e), c)
      i = e
      continue
    }
    if (isCons(c)) {
      const e = readCluster(i)
      const cl = flat.slice(i, e)
      if (flat[e] === '\u0001') { out.push('র', '্', ...cl); i = e + 1; continue }
      out.push(...cl); i = e; continue
    }
    out.push(c); i++
  }
  return out.join('').replace(/\u0001/g, 'র্').replace(/ো/g, 'ো').replace(/ৌ/g, 'ৌ')
}

export const fixLegacy = (v) => (typeof v === 'string' && looksBijoy(v) ? bijoyToUnicode(v.trim()) : v)
