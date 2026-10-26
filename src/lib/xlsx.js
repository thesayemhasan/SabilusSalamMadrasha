// ছোট্ট নিজস্ব এক্সেল (.xlsx) লেখা ও পড়ার মডিউল (JSZip ভিত্তিক)। শুধু পাতা-বাঁধা সাধারণ ছক লাগে বলে বড় লাইব্রেরি নেওয়া হয়নি।
// writeXlsx: শিরোনাম-রং, ড্রপডাউন (তালিকা থেকে বাছাই), ফ্রিজ-করা প্রথম সারি, লুকানো তালিকার পাতাসহ ফাইল বানায়।
// readXlsx: যেকোনো এক্সেল/লিবারঅফিস/গুগল শিট থেকে নামানো .xlsx-এর সব পাতা পড়ে (তারিখ ঠিকভাবে চেনে)।

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
const colName = (i) => { let s = ''; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }
const colIndex = (ref) => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1 }

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF16A34A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC2410C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`

// sheet = { name, rows:[[...]], widths:[..], headerRow:true, required:[bool per col], textCols:[col idx], lists:[{col, range:"'তালিকা'!$A$1:$A$9"}], hidden, kind:'data'|'doc', maxRow }
function sheetXml(sh) {
  const rows = sh.rows || []
  const nCols = Math.max(0, ...rows.map((r) => r.length))
  const textCols = new Set(sh.textCols || [])
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  xml += `<sheetViews><sheetView workbookViewId="0">${sh.headerRow ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews>`
  xml += '<sheetFormatPr defaultRowHeight="15"/>'
  if (nCols) {
    xml += '<cols>'
    for (let c = 0; c < nCols; c++) xml += `<col min="${c + 1}" max="${c + 1}" width="${(sh.widths && sh.widths[c]) || 18}" customWidth="1"${textCols.has(c) ? ' style="3"' : ''}/>`
    xml += '</cols>'
  }
  xml += '<sheetData>'
  rows.forEach((row, r) => {
    const isHead = sh.headerRow && r === 0
    xml += `<row r="${r + 1}"${isHead ? ' ht="34" customHeight="1"' : ''}>`
    row.forEach((v, c) => {
      if (v === null || v === undefined || v === '') return
      const ref = `${colName(c)}${r + 1}`
      let s = 0
      if (isHead) s = sh.required && sh.required[c] ? 2 : 1
      else if (sh.kind === 'doc') s = r === 0 ? 5 : (sh.docStyle && sh.docStyle[c]) || 4
      else if (textCols.has(c)) s = 3
      if (typeof v === 'number') xml += `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`
      else xml += `<c r="${ref}"${s ? ` s="${s}"` : ''} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    })
    xml += '</row>'
  })
  xml += '</sheetData>'
  const lists = sh.lists || []
  if (lists.length) {
    xml += `<dataValidations count="${lists.length}">`
    lists.forEach((l) => {
      const a = `${colName(l.col)}2:${colName(l.col)}${sh.maxRow || 2000}`
      xml += `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="ভুল মান" error="তালিকা থেকে বাছুন" sqref="${a}"><formula1>${esc(l.range)}</formula1></dataValidation>`
    })
    xml += '</dataValidations>'
  }
  xml += '</worksheet>'
  return xml
}

export async function writeXlsx(sheets) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
  zip.file('xl/styles.xml', STYLES)
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function saveBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}

// ---------- পড়া ----------
const parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml')
const kids = (el, name) => Array.from(el.getElementsByTagName(name))
const textOf = (si) => kids(si, 't').map((t) => t.textContent).join('')
const DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58])
const isDateFmt = (code) => { const c = String(code).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').toLowerCase(); return /[ymd]/.test(c) && !/^general$/.test(c) }
export const serialToIso = (n) => {
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export async function readXlsx(buf) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  const get = async (p) => { const f = zip.file(p); return f ? f.async('string') : null }
  const wb = await get('xl/workbook.xml')
  if (!wb) throw new Error('এটি সঠিক .xlsx ফাইল নয়')
  const rels = parseXml(await get('xl/_rels/workbook.xml.rels'))
  const relMap = {}
  kids(rels, 'Relationship').forEach((r) => { relMap[r.getAttribute('Id')] = r.getAttribute('Target') })
  let shared = []
  const ss = await get('xl/sharedStrings.xml')
  if (ss) shared = kids(parseXml(ss), 'si').map(textOf)
  const dateXf = []
  const st = await get('xl/styles.xml')
  if (st) {
    const sx = parseXml(st)
    const custom = {}
    kids(sx, 'numFmt').forEach((n) => { custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') })
    const cx = sx.getElementsByTagName('cellXfs')[0]
    if (cx) Array.from(cx.children).forEach((xf, i) => { const id = xf.getAttribute('numFmtId'); dateXf[i] = DATE_IDS.has(Number(id)) || (custom[id] ? isDateFmt(custom[id]) : false) })
  }
  const out = []
  for (const sh of kids(parseXml(wb), 'sheet')) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    let target = relMap[rid]
    if (!target) continue
    target = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    const xml = await get(target)
    if (!xml) continue
    const doc = parseXml(xml)
    const rows = []
    kids(doc, 'row').forEach((row) => {
      const rn = Number(row.getAttribute('r')) - 1
      const arr = []
      Array.from(row.children).forEach((c) => {
        if (c.tagName !== 'c') return
        const ci = colIndex(c.getAttribute('r'))
        const t = c.getAttribute('t')
        const s = Number(c.getAttribute('s') || 0)
        const vEl = c.getElementsByTagName('v')[0]
        let v = null
        if (t === 's') v = vEl ? shared[Number(vEl.textContent)] : null
        else if (t === 'inlineStr') v = textOf(c)
        else if (t === 'str') v = vEl ? vEl.textContent : null
        else if (t === 'b') v = vEl && vEl.textContent === '1' ? 'TRUE' : 'FALSE'
        else if (t === 'e') v = null
        else if (vEl && vEl.textContent !== '') {
          const num = Number(vEl.textContent)
          v = dateXf[s] && Number.isFinite(num) ? serialToIso(num) : num
        }
        if (v !== null && v !== undefined) arr[ci] = v
      })
      rows[rn] = arr
    })
    out.push({ name: sh.getAttribute('name'), rows: Array.from(rows, (r) => r || []) })
  }
  return out
}
