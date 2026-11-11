// ফটোকার্ড: ছবি ও ফ্রেম এক ক্যানভাসে বসানোর সব হিসাব (পাবলিক পেজ ও অ্যাডমিন প্রিভিউ একই কোড ব্যবহার করে)

export const SHAPES = [['rect', 'চৌকো'], ['round', 'গোলাকার কোণা'], ['circle', 'গোল / ডিম্বাকার']]
export const LAYERS = [['under', 'ছবি ডিজাইনের পেছনে (ডিজাইনে ফাঁকা জায়গা থাকলে)'], ['over', 'ছবি ডিজাইনের ওপরে']]

export function loadImage(src, cors = true) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    if (cors) im.crossOrigin = 'anonymous'
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('ছবি লোড হয়নি'))
    im.src = src
  })
}

// ব্যবহারকারীর ছবি ছোট করে নেওয়া (ফোনের বড় ছবিতে মেমোরি বাঁচাতে); EXIF ঘোরানো ব্রাউজারই করে
export async function loadUserPhoto(file, maxSide = 2000) {
  const url = URL.createObjectURL(file)
  try {
    const im = await loadImage(url, false)
    const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight))
    if (k === 1) return im
    const c = document.createElement('canvas')
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k)
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
    return c
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

const dim = (s) => [s.naturalWidth || s.width, s.naturalHeight || s.height]
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// tf = { z: জুম (১ বা বেশি), fx, fy: বক্সের মাপের অনুপাতে সরানো }
export function clampTf(tf, photo, tpl, W, H) {
  const [iw, ih] = dim(photo)
  const bw = tpl.pw * W, bh = tpl.ph * H
  const base = Math.max(bw / iw, bh / ih)
  const z = clamp(tf.z, 1, 5)
  const dw = iw * base * z, dh = ih * base * z
  const mx = Math.max(0, (dw - bw) / 2 / bw), my = Math.max(0, (dh - bh) / 2 / bh)
  return { z, fx: clamp(tf.fx, -mx, mx), fy: clamp(tf.fy, -my, my) }
}

function boxPath(ctx, x, y, w, h, shape) {
  ctx.beginPath()
  if (shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  else if (shape === 'round') {
    const r = Math.min(w, h) * 0.12
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  } else ctx.rect(x, y, w, h)
}

export function drawCard(ctx, W, H, tpl, frame, photo, tfIn) {
  ctx.clearRect(0, 0, W, H)
  const drawPhoto = () => {
    if (!photo) return
    const tf = clampTf(tfIn || { z: 1, fx: 0, fy: 0 }, photo, tpl, W, H)
    const [iw, ih] = dim(photo)
    const bx = tpl.px * W, by = tpl.py * H, bw = tpl.pw * W, bh = tpl.ph * H
    const base = Math.max(bw / iw, bh / ih) * tf.z
    const dw = iw * base, dh = ih * base
    ctx.save()
    boxPath(ctx, bx, by, bw, bh, tpl.shape)
    ctx.clip()
    ctx.drawImage(photo, bx + bw / 2 + tf.fx * bw - dw / 2, by + bh / 2 + tf.fy * bh - dh / 2, dw, dh)
    ctx.restore()
  }
  if (tpl.layer === 'over') { if (frame) ctx.drawImage(frame, 0, 0, W, H); drawPhoto() } else { drawPhoto(); if (frame) ctx.drawImage(frame, 0, 0, W, H) }
}

// স্বচ্ছ (ফাঁকা) জায়গার সীমানা খুঁজে বক্সের মাপ আন্দাজ করা; না পেলে null
export function detectHole(im) {
  const [w0, h0] = dim(im)
  const k = Math.min(1, 300 / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h)
  const d = x.getImageData(0, 0, w, h).data
  // বাইরের কিনারা থেকে স্বচ্ছ অংশ বাদ: শুধু ভেতরের বদ্ধ ফাঁকা অংশ ধরা
  const seen = new Uint8Array(w * h), stack = []
  const clear = (i) => d[i * 4 + 3] < 24
  const push = (i) => { if (!seen[i] && clear(i)) { seen[i] = 1; stack.push(i) } }
  for (let i = 0; i < w; i++) { push(i); push((h - 1) * w + i) }
  for (let j = 0; j < h; j++) { push(j * w); push(j * w + w - 1) }
  while (stack.length) { const i = stack.pop(), cx = i % w, cy = (i - cx) / w; if (cx > 0) push(i - 1); if (cx < w - 1) push(i + 1); if (cy > 0) push(i - w); if (cy < h - 1) push(i + w) }
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0
  for (let i = 0; i < w * h; i++) if (clear(i) && !seen[i]) { const cx = i % w, cy = (i - cx) / w; n++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy }
  if (n < w * h * 0.01) return null
  return { px: x0 / w, py: y0 / h, pw: (x1 - x0 + 1) / w, ph: (y1 - y0 + 1) / h }
}

// অ্যাডমিনের আপলোড করা ডিজাইন ছোট (WebP, স্বচ্ছতা সহ) করে File বানানো — পাবলিকের ডাউনলোড খরচ কমাতে
export async function packDesign(file, maxSide = 1600) {
  const url = URL.createObjectURL(file)
  try {
    const im = await loadImage(url, false)
    const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k)
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
    let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.92))
    const webp = blob && blob.type === 'image/webp'
    if (!blob || !webp) blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    return { file: new File([blob], `design.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type }), width: c.width, height: c.height, canvas: c }
  } finally { URL.revokeObjectURL(url) }
}
